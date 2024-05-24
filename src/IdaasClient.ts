import type { JWTPayload } from "jose";
import { type AccessToken, PersistenceManager } from "./PersistenceManager";
import {
  type AccessTokenRequest,
  type OidcConfig,
  type RefreshTokenRequest,
  type TokenResponse,
  fetchOpenidConfiguration,
  requestToken,
} from "./api";
import type { AuthorizeResponse } from "./models";
import { listenToPopup, openPopup } from "./utils/browser";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { formatUrl } from "./utils/format";
import { validateIdToken } from "./utils/jwt";

export interface IdaasClientOptions {
  issuerUrl: string;
  clientId: string;
  defaultScope?: string;
  defaultAudience?: string;
  defaultUseRefreshToken?: boolean;
}

export interface LoginOptions {
  audience?: string;
  scope?: string;
  redirectUri?: string;
  useRefreshToken?: boolean;
  popup?: boolean;
}

export interface GetAccessTokenOptions {
  audience?: string;
  scope?: string;
  fallback?: "redirect" | "popup";
  redirectUri?: string;
  useRefreshToken?: boolean;
}

export interface UserClaims {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: string;
  updated_at?: number;
  [propName: string]: unknown;
}

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
  }

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   *
   * @param redirectUri to navigate to after a successful authentication
   * @param audience the intended audience for the received access token once login is complete
   * @param scope the intended scope for the received access token once login is complete
   * @param useRefreshToken determines if the received access token can be refreshed using refresh tokens
   */
  private async loginWithPopup({ audience, scope, redirectUri, useRefreshToken }: LoginOptions) {
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
   *
   * @param callbackUrl optional url of the redirect after the initial authorization is complete, if not provided will default
   * to the current window location
   */
  public async handleRedirect(callbackUrl: string = window.location.href) {
    const authorizeResponse = this.parseRedirectSearchParams(callbackUrl);

    // The provided url is not an authorized callback url
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

  public isAuthenticated() {
    return !!this.persistenceManager.getIdToken();
  }

  /**
   * Fetch the user information stored in the id_token
   * @returns returns the decodedIdToken containing the user info.
   */
  public getUser(): UserClaims | null {
    const idToken = this.persistenceManager.getIdToken();

    if (!idToken?.decoded) {
      return null;
    }

    return idToken.decoded as UserClaims;
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
  }: GetAccessTokenOptions): Promise<string | undefined> {
    const usedScope = scope ?? this.defaultScope;
    const usedAudience = audience ?? this.defaultAudience;
    const accessTokens = this.persistenceManager.getAccessTokens();
    const requestedScopes = usedScope.split(" ");

    // No access tokens stored
    if (!accessTokens) {
      return undefined;
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
        await this.persistenceManager.removeAccessToken(possibleAccessToken);
        continue;
      }
      const {
        refresh_token: newRefreshToken,
        access_token: newEncodedAccessToken,
        expires_in,
      } = await this.requestTokenUsingRefreshToken(refreshToken);
      const issuedAt = Math.floor(Date.now() / 1000);
      const newExpiration = Number.parseInt(expires_in) + issuedAt;

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
      return undefined;
    }
    if (fallback === "popup") {
      return await this.login({ audience, scope, popup: true, useRefreshToken });
    }

    throw new Error("Requested token not found, no fallback method specified");
  }

  private parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse) {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = Number.parseInt(expires_in) + issuedAt;
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

  private parseRedirectSearchParams(callbackUrl: string): AuthorizeResponse | null {
    const url = new URL(callbackUrl);
    const searchParams = url.searchParams;

    if (searchParams.toString() === "") {
      return null;
    }

    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

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
