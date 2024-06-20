import type { JWTPayload } from "jose";
import { type AccessToken, PersistenceManager } from "./PersistenceManager";
import {
  type AccessTokenRequest,
  type OidcConfig,
  type RefreshTokenRequest,
  type TokenResponse,
  fetchOpenidConfiguration,
  getUserInfo,
  requestToken,
} from "./api";
import type { AuthorizeResponse, GetAccessTokenOptions, IdaasClientOptions, LoginOptions, UserClaims } from "./models";
import { listenToPopup, openPopup } from "./utils/browser";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { expiryToEpochSeconds, formatUrl } from "./utils/format";
import { validateIdToken, validateUserInfoToken } from "./utils/jwt";

/**
 * A validated token response, contains the TokenResponse as well as the decoded and encoded id token.
 */
interface ValidatedTokenResponse {
  tokenResponse: TokenResponse;
  decodedIdToken: JWTPayload;
  encodedIdToken: string;
}

export class IdaasClient {
  private readonly persistenceManager: PersistenceManager;
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly defaultScope: string;
  private readonly defaultAudience: string | undefined;
  private readonly defaultUseRefreshToken: boolean;

  private config?: OidcConfig;

  constructor({ issuerUrl, clientId, defaultAudience, defaultScope, defaultUseRefreshToken }: IdaasClientOptions) {
    this.defaultAudience = defaultAudience;
    this.defaultScope = defaultScope ?? "openid profile email";
    this.defaultUseRefreshToken = defaultUseRefreshToken ?? false;
    this.issuerUrl = formatUrl(issuerUrl);
    this.persistenceManager = new PersistenceManager(clientId);
    this.clientId = clientId;
  }

  /**
   * Perform the authorization code flow by authenticating the user to obtain an access token and optionally refresh and
   * ID tokens.
   *
   * If using redirect (i.e. popup=false), your application must also be configured to call handleRedirect at the redirectUri
   * to complete the flow.
   *
   * @param redirectUri to navigate to after a successful authentication
   * @param audience the intended audience for the received access token once login is complete
   * @param scope the intended scope for the received access token once login is complete
   * @param useRefreshToken determines if the received access token can be refreshed using refresh tokens
   * @param popup whether the authentication will occur in a new popup window, defaults to false. When false the browser will
   *  navigate to the OP to authenticate the user.
   */
  public async login({ audience, scope, redirectUri, useRefreshToken, popup = false }: LoginOptions) {
    const { response_modes_supported } = await this.getConfig();
    if (popup) {
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        throw new Error("Attempting to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.loginWithPopup({ audience, scope, redirectUri, useRefreshToken });
    }

    await this.loginWithRedirect({ audience, scope, redirectUri, useRefreshToken });

    return null;
  }

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   *
   * @param redirectUri to navigate to after a successful authentication
   * @param audience the intended audience for the received access token once login is complete
   * @param scope the intended scope for the received access token once login is complete
   * @param useRefreshToken determines if the received access token can be refreshed using refresh tokens
   */
  private async loginWithPopup({
    audience,
    scope,
    redirectUri,
    useRefreshToken,
  }: LoginOptions): Promise<string | null> {
    redirectUri = redirectUri ?? window.location.origin;

    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "web_message",
      redirectUri,
      useRefreshToken,
      scope,
      audience,
    );

    const popup = openPopup(url);

    const authorizeResponse = await listenToPopup(popup);
    const authorizeCode = this.validateAuthorizeResponse(authorizeResponse, state);
    const validatedTokenResponse = await this.requestAndValidateTokens(authorizeCode, codeVerifier, redirectUri, nonce);

    this.parseAndSaveTokenResponse(validatedTokenResponse);

    // redirect only if the redirectUri is not the current uri
    if (formatUrl(redirectUri) !== formatUrl(window.location.href)) {
      window.location.href = redirectUri;
    }

    return validatedTokenResponse.tokenResponse.access_token;
  }

  /**
   * Perform the authorization code flow by redirecting to the OpenID Provider (OP) to authenticate the user and then redirect
   * with the necessary state and code.
   *
   * @param redirectUri to navigate to after a successful authentication
   * @param audience the intended audience for the received access token once login is complete
   * @param scope the intended scope for the received access token once login is complete
   * @param useRefreshToken determines if the received access token can be refreshed using refresh tokens
   *
   */
  private async loginWithRedirect({ audience, scope, redirectUri, useRefreshToken }: LoginOptions) {
    redirectUri = redirectUri ?? window.location.origin;

    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "query",
      redirectUri,
      useRefreshToken,
      scope,
      audience,
    );

    this.persistenceManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri,
    });

    window.location.href = url;
  }

  /**
   * Handle the callback to the login redirectUri post-authorize and pass the received code to the token endpoint to get
   * the access token, ID token, and optionally refresh token (optional). Additionally, validate the ID token claims.
   */
  public async handleRedirect() {
    const authorizeResponse = this.parseRedirectSearchParams();

    // The current url is not an authorized callback url
    if (!authorizeResponse) {
      return;
    }

    const clientParams = this.persistenceManager.getClientParams();
    if (!clientParams) {
      throw new Error("Failed to recover IDaaS client state from local storage");
    }
    const { codeVerifier, redirectUri, state, nonce } = clientParams;

    const authorizeCode = this.validateAuthorizeResponse(authorizeResponse, state);

    const validatedTokenResponse = await this.requestAndValidateTokens(authorizeCode, codeVerifier, redirectUri, nonce);
    this.parseAndSaveTokenResponse(validatedTokenResponse);
  }

  /**
   * Fetch the user information stored in the id_token
   * @returns returns the decodedIdToken containing the user info.
   */
  public getIdToken(): UserClaims | null {
    const idToken = this.persistenceManager.getIdToken();
    if (!idToken?.decoded) {
      return null;
    }

    return idToken.decoded as UserClaims;
  }

  public isAuthenticated() {
    return !!this.persistenceManager.getIdToken();
  }

  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   *
   * @param redirectUri optional url to redirect to after logout, must be one of the allowed logout redirect URLs defined
   * in the OIDC application. If not provided, the user will remain at the OP.
   */
  public async logout(redirectUri?: string) {
    const idToken = this.persistenceManager.getIdToken();
    if (!idToken) {
      // Discontinue logout, the user is not authenticated
      return;
    }
    const { encoded: encodedIdToken } = idToken;

    this.persistenceManager.remove();

    window.location.href = await this.generateLogoutUrl(encodedIdToken, redirectUri);
  }

  /**
   * Returns an access token with the required scopes and audience that is unexpired or refreshable.
   * The `fallback` parameter determines the result if there are no access tokens with the required scopes and audience that are unexpired or refreshable.
   *
   * To store and return an access token with the required scopes and audience if there are none available, set `fallback` to `popup`.
   * To store an access token with the required scopes and audience if there are none available, set `fallback` to `redirect`.
   *
   * @throws error if there are no access tokens with the required scopes and audience that are unexpired or refreshable, and `fallback` is not specified.
   *
   * @param audience the audience of the token to be fetched
   * @param scope the scope of the token to be fetched
   * @param fallback the method to use to fetch the requested token if it is not stored
   * @param redirectUri the URI to redirect to after execution of a `fallback` method.
   * @param useRefreshToken determines if the new token returned by the fallback method can use refresh tokens.
   */
  public async getAccessToken({
    audience,
    scope,
    fallback,
    redirectUri,
    useRefreshToken,
  }: GetAccessTokenOptions): Promise<string | null> {
    const usedScope = scope ?? this.defaultScope;
    const usedAudience = audience ?? this.defaultAudience;
    const accessTokens = this.persistenceManager.getAccessTokens();
    const requestedScopes = usedScope.split(" ");

    // No access tokens stored
    if (!accessTokens) {
      return null;
    }

    // 1. Find all tokens with the required audience that possess all required scopes
    // Tokens that have the required audience
    const tokensWithAudience = accessTokens.filter((token) => token.audience === usedAudience);

    // Tokens that have the required audience and all scopes
    const possibleTokens = tokensWithAudience.filter((token) => {
      const tokenScopes = token.scope.split(" ");
      return requestedScopes.every((scope) => tokenScopes.includes(scope));
    });

    // Sorts tokens by number of scopes in ascending order
    const sortedPossibleTokens = possibleTokens.sort(
      (token1, token2) => token1.scope.split(" ").length - token2.scope.split(" ").length,
    );

    // 2. Moving from the tokens found above with the fewest number of scopes to those with the most number of scopes
    // - If the token is not expired, return it
    // - If the token is expired and not refreshable, remove it from storage
    // - If the token is expired but refreshable, refresh it, remove it from storage, store the refreshed token, then return the refreshed token
    for (const possibleAccessToken of sortedPossibleTokens) {
      const { refreshToken, accessToken, expiresAt, scope, audience } = possibleAccessToken;
      // buffer (in seconds) to refresh early, ensuring unexpired token is returned
      const buffer = 15;

      const now = new Date();
      const expDate = new Date((expiresAt - buffer) * 1000);

      // Token not expired
      if (expDate > now) {
        return accessToken;
      }

      // No refresh token
      if (!refreshToken) {
        this.persistenceManager.removeAccessToken(possibleAccessToken);
        continue;
      }
      const {
        refresh_token: newRefreshToken,
        access_token: newEncodedAccessToken,
        expires_in,
      } = await this.requestTokenUsingRefreshToken(refreshToken);
      const newExpiration = expiryToEpochSeconds(expires_in);

      // the refreshed access token to be stored, maintaining expired token's scope and audience
      const newAccessToken: AccessToken = {
        accessToken: newEncodedAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiration,
        audience,
        scope,
      };

      this.persistenceManager.removeAccessToken(possibleAccessToken);
      this.persistenceManager.saveAccessToken(newAccessToken);
      return newEncodedAccessToken;
    }

    // 3. If no suitable tokens were found or all suitable tokens were expired and not refreshable, determine how to proceed based on the 'fallback' param
    // No suitable tokens found
    if (fallback === "redirect") {
      await this.login({
        scope: usedScope,
        audience: usedAudience,
        redirectUri,
        useRefreshToken,
      });

      // not possible to retrieve the access token created from redirect login flow, return undefined
      return null;
    }
    if (fallback === "popup") {
      return await this.login({ audience, scope, popup: true, useRefreshToken });
    }

    throw new Error("Requested token not found, no fallback method specified");
  }

  private parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse) {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;

    const expiresAt = expiryToEpochSeconds(expires_in);
    const { audience, scope } = this.persistenceManager.getTokenParams();
    this.persistenceManager.removeTokenParams();

    const newAccessToken: AccessToken = {
      refreshToken: refresh_token,
      accessToken: access_token,
      expiresAt,
      audience,
      scope,
    };

    this.persistenceManager.saveIdToken({ encoded: encodedIdToken, decoded: decodedIdToken });
    this.persistenceManager.saveAccessToken(newAccessToken);
  }

  /**
   * Get the user claims from the OpenId Provider using the userinfo endpoint.
   *
   * @param accessToken when provided its scopes will be used to determine the claims returned from the userinfo endpoint.
   * If not provided, the access token with the default scopes and audience will be used if available.
   */
  public async getUserInfo(accessToken?: string): Promise<UserClaims | null> {
    const { userinfo_endpoint, issuer, jwks_uri } = await this.getConfig();

    const userInfoAccessToken = accessToken ?? (await this.getAccessToken({}));

    if (!userInfoAccessToken) {
      throw new Error("Client is not authorized to access the UserInfo endpoint");
    }

    const userInfo = await getUserInfo(userinfo_endpoint, userInfoAccessToken);

    let claims: UserClaims | null;

    // 1. Check if userInfo is a JWT. If it is, its signature must be verified.
    claims = await validateUserInfoToken({
      userInfoToken: userInfo,
      clientId: this.clientId,
      jwksEndpoint: jwks_uri,
      issuer,
    });

    // 2. If not a jwt, treat the response as an unsigned JSON
    if (!claims) {
      claims = JSON.parse(userInfo) as UserClaims;
    }

    // 3. Finally, validate that the sub claim in the UserInfo response exactly matches the sub claim in the ID token
    const idToken = this.persistenceManager.getIdToken();
    if (idToken?.decoded.sub !== claims.sub) {
      return null;
    }

    return claims;
  }

  private parseRedirectSearchParams(): AuthorizeResponse | null {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    if (searchParams.toString() === "") {
      return null;
    }

    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    // Authorization response must always contain state
    if (!state) {
      return null;
    }

    // Authorization response must contain code OR error
    if (!(code || error)) {
      return null;
    }

    url.search = "";
    window.history.replaceState(null, document.title, url.toString());

    return {
      state,
      code,
      error,
      error_description,
    };
  }

  private validateAuthorizeResponse(
    { state, code, error, error_description }: AuthorizeResponse,
    expectedState: string,
  ) {
    if (error) {
      throw new Error("Error during authorization", { cause: error_description });
    }

    if (!(code && state)) {
      throw new Error("URL must contain state and code for the authorization flow");
    }

    if (expectedState !== state) {
      throw new Error(
        "State received during redirect does not match the state from the beginning of the OIDC ceremony",
      );
    }

    return code;
  }

  private async requestAndValidateTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    nonce: string,
  ): Promise<ValidatedTokenResponse> {
    const { token_endpoint, id_token_signing_alg_values_supported, acr_values_supported } = await this.getConfig();

    const tokenRequest: AccessTokenRequest = {
      client_id: this.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResponse = await requestToken(token_endpoint, tokenRequest);

    const { decodedJwt: decodedIdToken, idToken } = validateIdToken({
      clientId: this.clientId,
      idToken: tokenResponse.id_token,
      issuer: this.issuerUrl,
      nonce,
      idTokenSigningAlgValuesSupported: id_token_signing_alg_values_supported,
      acrValuesSupported: acr_values_supported,
    });

    return { tokenResponse, decodedIdToken, encodedIdToken: idToken };
  }

  private async requestTokenUsingRefreshToken(refreshToken: string): Promise<TokenResponse> {
    const { token_endpoint } = await this.getConfig();

    const tokenRequest: RefreshTokenRequest = {
      client_id: this.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    return await requestToken(token_endpoint, tokenRequest);
  }

  /**
   * Generate the authorization url by generating searchParams. codeVerifier will need to be stored for use after redirect.
   */
  private async generateAuthorizationUrl(
    responseMode: "query" | "web_message",
    redirectUri?: string,
    refreshToken?: boolean,
    scope?: string,
    audience?: string,
  ) {
    const usedRedirectUri = redirectUri ?? window.location.origin;
    const usedRefreshToken = refreshToken ?? this.defaultUseRefreshToken;
    const tempScope = scope ?? this.defaultScope;
    const usedAudience = audience ?? this.defaultAudience;
    const { authorization_endpoint } = await this.getConfig();
    const scopeAsArray = tempScope.split(" ");

    scopeAsArray.push("openid");
    if (usedRefreshToken) {
      scopeAsArray.push("offline_access");
    }

    // removes duplicate values
    const usedScope = [...new Set(scopeAsArray)].join(" ");

    const state = base64UrlStringEncode(createRandomString());
    const nonce = base64UrlStringEncode(createRandomString());
    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();
    const url = new URL(authorization_endpoint);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", this.clientId);
    url.searchParams.append("redirect_uri", usedRedirectUri);
    if (usedAudience) {
      url.searchParams.append("audience", usedAudience);
    }
    url.searchParams.append("scope", usedScope);
    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("response_mode", responseMode);
    url.searchParams.append("code_challenge", codeChallenge);
    // Note: The PKCE spec defines an additional code_challenge_method 'plain', but it is explicitly NOT recommended
    // https://datatracker.ietf.org/doc/html/rfc7636#section-7.2
    url.searchParams.append("code_challenge_method", "S256");

    this.persistenceManager.saveTokenParams({ audience: usedAudience, scope: usedScope });

    return { url: url.toString(), nonce, state, codeVerifier };
  }

  /**
   * Generate the endsession url with the required query params to log out the user from the OpenID Provider
   */
  private async generateLogoutUrl(idToken: string, redirectUri?: string): Promise<string> {
    const { end_session_endpoint } = await this.getConfig();

    const url = new URL(end_session_endpoint);
    url.searchParams.append("id_token_hint", idToken);
    url.searchParams.append("client_id", this.clientId);
    if (redirectUri) {
      url.searchParams.append("post_logout_redirect_uri", redirectUri);
    }

    return url.toString();
  }

  private async getConfig(): Promise<OidcConfig> {
    return this.config ? this.config : await fetchOpenidConfiguration(this.issuerUrl);
  }
}
