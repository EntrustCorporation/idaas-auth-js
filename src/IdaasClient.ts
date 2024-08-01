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
import type {
  AuthorizeResponse,
  FallbackAuthorizationOptions,
  GetAccessTokenOptions,
  IdaasClientOptions,
  LoginOptions,
  LogoutOptions,
  UserClaims,
} from "./models";
import { listenToPopup, openPopup } from "./utils/browser";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { expiryToEpochSeconds, formatUrl, sanitizeUri } from "./utils/format";
import { validateIdToken, validateUserInfoToken } from "./utils/jwt";

/**
 * A validated token response, contains the TokenResponse as well as the decoded and encoded id token.
 */
export interface ValidatedTokenResponse {
  tokenResponse: TokenResponse;
  decodedIdToken: JWTPayload;
  encodedIdToken: string;
}

export class IdaasClient {
  private readonly persistenceManager: PersistenceManager;
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly globalScope: string;
  private readonly globalAudience: string | undefined;
  private readonly globalUseRefreshToken: boolean;

  private config?: OidcConfig;

  constructor({ issuerUrl, clientId, globalAudience, globalScope, globalUseRefreshToken }: IdaasClientOptions) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
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
   * */
  public async login({
    audience,
    scope,
    redirectUri,
    useRefreshToken = false,
    popup = false,
    acrValues,
  }: LoginOptions = {}) {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempting to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.loginWithPopup({ audience, scope, redirectUri, useRefreshToken, acrValues });
    }

    await this.loginWithRedirect({ audience, scope, redirectUri, useRefreshToken, acrValues });

    return null;
  }

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   */
  private async loginWithPopup({
    audience,
    scope,
    redirectUri,
    useRefreshToken,
    acrValues,
  }: LoginOptions): Promise<string | null> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);

    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "web_message",
      finalRedirectUri,
      useRefreshToken,
      scope,
      audience,
      acrValues,
    );

    const popup = openPopup(url);
    const authorizeResponse = await listenToPopup(popup, url);
    const authorizeCode = this.validateAuthorizeResponse(authorizeResponse, state);
    const validatedTokenResponse = await this.requestAndValidateTokens(
      authorizeCode,
      codeVerifier,
      finalRedirectUri,
      nonce,
    );

    this.parseAndSaveTokenResponse(validatedTokenResponse);

    // redirect only if the redirectUri is not the current uri
    if (formatUrl(window.location.href) !== formatUrl(finalRedirectUri)) {
      window.location.href = finalRedirectUri;
    }

    return validatedTokenResponse.tokenResponse.access_token;
  }

  /**
   * Perform the authorization code flow by redirecting to the OpenID Provider (OP) to authenticate the user and then redirect
   * with the necessary state and code.
   */
  private async loginWithRedirect({ audience, scope, redirectUri, useRefreshToken, acrValues }: LoginOptions) {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);

    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "query",
      finalRedirectUri,
      useRefreshToken,
      scope,
      audience,
      acrValues,
    );

    this.persistenceManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: finalRedirectUri,
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
  public getIdTokenClaims(): UserClaims | null {
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
   */
  public async logout({ redirectUri }: LogoutOptions = {}) {
    if (!this.isAuthenticated()) {
      // Discontinue logout, the user is not authenticated
      return;
    }

    this.persistenceManager.remove();

    window.location.href = await this.generateLogoutUrl(redirectUri);
  }

  /**
   * Returns an access token with the required scopes and audience that is unexpired or refreshable.
   * The `fallbackAuthorizationOptions` parameter determines the result if there are no access tokens with the required scopes and audience that are unexpired or refreshable.
   */
  public async getAccessToken({
    audience = this.globalAudience,
    scope = this.globalScope,
    fallbackAuthorizationOptions,
  }: GetAccessTokenOptions = {}): Promise<string | null> {
    const accessTokens = this.persistenceManager.getAccessTokens();
    const requestedScopes = scope.split(" ");

    if (accessTokens) {
      // 1. Find all tokens with the required audience that possess all required scopes
      // Tokens that have the required audience
      const tokensWithAudience = accessTokens.filter((token) => token.audience === audience);

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
    }

    // 3. If no suitable tokens were found or all suitable tokens were expired and not refreshable, attempt to login using the fallbackAuthorizationOptions
    // No suitable tokens found
    if (fallbackAuthorizationOptions) {
      const { redirectUri, useRefreshToken, popup } = fallbackAuthorizationOptions;

      return await this.login({ scope, audience, popup, useRefreshToken, redirectUri });
    }

    throw new Error("Requested token not found, no fallback login specified");
  }

  private parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse) {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;

    const expiresAt = expiryToEpochSeconds(expires_in);
    const tokenParams = this.persistenceManager.getTokenParams();
    if (!tokenParams) {
      throw new Error("No token params stored, unable to parse");
    }
    const { audience, scope } = tokenParams;
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
   * Returns true if `desired` is defined and included in `arr`.
   *
   * @param arr the array of options
   * @param desired the element to search for
   */
  private isIncluded = (arr: string[], desired: string | undefined): boolean => {
    if (!desired) {
      return false;
    }

    return arr.includes(desired);
  };

  private getIdTokenAcr = (): string | undefined => {
    const idToken = this.persistenceManager.getIdToken();
    return idToken?.decoded.acr as string | undefined;
  };

  /**
   * Determines if the current ID token's acr claim is an element in `desiredAcr`.
   * If `fallbackAuthorization` is defined and the current ID token's acr claim is not desired, a login will be attempted to fetch an ID token with an acr claim that is an element in `desiredAcr`.
   *
   * @param desiredAcr an array of acr values that are acceptable for the ID token to have
   * @param fallbackAuthorization the fallback login options to retrieve an ID token with desiredAcr
   */
  public async isAcrDesired({
    desiredAcr,
    fallbackAuthorization,
  }: { desiredAcr: string[]; fallbackAuthorization?: FallbackAuthorizationOptions }): Promise<boolean> {
    const currentAcr = this.getIdTokenAcr();

    // no fallback specified, so return the result regardless
    if (!fallbackAuthorization) {
      return this.isIncluded(desiredAcr, currentAcr);
    }

    // fallback specified, return only if currentAcr is desired
    if (this.isIncluded(desiredAcr, currentAcr)) {
      return true;
    }

    // not authenticated and/or ID token does not have desired acr claim, login with the desired acr claim
    await this.login({ ...fallbackAuthorization, acrValues: desiredAcr });

    // check if new ID token has desired acr claim
    return this.isIncluded(desiredAcr, this.getIdTokenAcr());
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
    redirectUri: string = window.location.href,
    refreshToken: boolean = this.globalUseRefreshToken,
    scope: string = this.globalScope,
    audience: string | undefined = this.globalAudience,
    acrValues: string[] = [],
  ) {
    const { authorization_endpoint } = await this.getConfig();
    const scopeAsArray = scope.split(" ");

    scopeAsArray.push("openid");
    if (refreshToken) {
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
    url.searchParams.append("redirect_uri", redirectUri);
    if (audience) {
      url.searchParams.append("audience", audience);
    }
    url.searchParams.append("scope", usedScope);
    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("response_mode", responseMode);
    url.searchParams.append("code_challenge", codeChallenge);
    // Note: The PKCE spec defines an additional code_challenge_method 'plain', but it is explicitly NOT recommended
    // https://datatracker.ietf.org/doc/html/rfc7636#section-7.2
    url.searchParams.append("code_challenge_method", "S256");

    if (acrValues.length > 0) {
      const claimRequest = JSON.stringify({
        id_token: {
          acr: {
            essential: true,
            values: acrValues,
          },
        },
      });
      url.searchParams.append("claims", claimRequest);
    }

    this.persistenceManager.saveTokenParams({ audience, scope: usedScope });

    return { url: url.toString(), nonce, state, codeVerifier };
  }

  /**
   * Generate the endsession url with the required query params to log out the user from the OpenID Provider
   */
  private async generateLogoutUrl(redirectUri?: string): Promise<string> {
    const { end_session_endpoint } = await this.getConfig();

    const url = new URL(end_session_endpoint);
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
