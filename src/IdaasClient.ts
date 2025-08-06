import { decodeJwt, type JWTPayload } from "jose";
import { AuthenticationTransaction } from "./AuthenticationTransaction";
import {
  type AccessTokenRequest,
  fetchOpenidConfiguration,
  getUserInfo,
  type OidcConfig,
  type RefreshTokenRequest,
  requestToken,
  type TokenResponse,
} from "./api";
import type {
  AuthenticationCredential,
  AuthenticationRequestParams,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  AuthorizeResponse,
  GetAccessTokenOptions,
  IdaasClientOptions,
  LogoutOptions,
  OidcLoginOptions,
  UserClaims,
} from "./models";
import { type AccessToken, StorageManager } from "./storage/StorageManager";
import { listenToAuthorizePopup, openPopup } from "./utils/browser";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { calculateEpochExpiry, formatUrl, sanitizeUri } from "./utils/format";
import { readAccessToken, validateIdToken, validateUserInfoToken } from "./utils/jwt";

/**
 * A validated token response, contains the TokenResponse as well as the decoded and encoded id token.
 */
export interface ValidatedTokenResponse {
  tokenResponse: TokenResponse;
  decodedIdToken: JWTPayload;
  encodedIdToken: string;
}

export class IdaasClient {
  private readonly storageManager: StorageManager;
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly globalScope: string;
  private readonly globalAudience: string | undefined;
  private readonly globalUseRefreshToken: boolean;

  private authenticationTransaction?: AuthenticationTransaction;
  private config?: OidcConfig;

  /**
   * Creates a new IdaasClient instance for handling OIDC authentication flows.
   *
   * @param options Configuration options for the client including issuer URL, client ID, and global settings
   */
  constructor({
    issuerUrl,
    clientId,
    globalAudience,
    globalScope,
    globalUseRefreshToken,
    storageType = "memory",
  }: IdaasClientOptions) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
    this.issuerUrl = formatUrl(issuerUrl);
    this.storageManager = new StorageManager(clientId, storageType);
    this.clientId = clientId;
  }

  /**
   * Removes tokens from storage that have surpassed their max_age, and tokens that are expired and not refreshable.
   */
  private removeUnusableTokens = (): void => {
    const tokens = this.storageManager.getAccessTokens();
    if (!tokens) {
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    for (const token of tokens) {
      if (token.maxAgeExpiry) {
        if (now > token.maxAgeExpiry - buffer) {
          this.storageManager.removeAccessToken(token);
        }
      }

      if (now > token.expiresAt - buffer) {
        if (!token.refreshToken) {
          this.storageManager.removeAccessToken(token);
        }
      }
    }
  };

  private parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse): void {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;
    const authTime = readAccessToken(access_token)?.auth_time;
    const expiresAt = calculateEpochExpiry(expires_in, authTime);
    const tokenParams = this.storageManager.getTokenParams();

    if (!tokenParams) {
      throw new Error("No token params stored, unable to parse");
    }

    const { audience, scope, maxAge } = tokenParams;
    const maxAgeExpiry = maxAge ? calculateEpochExpiry(maxAge.toString(), authTime) : undefined;

    this.storageManager.removeTokenParams();

    const token = readAccessToken(access_token);
    const acr = token?.acr ?? undefined;

    const newAccessToken: AccessToken = {
      refreshToken: refresh_token,
      accessToken: access_token,
      expiresAt,
      audience,
      scope,
      maxAgeExpiry,
      acr,
    };

    this.storageManager.saveIdToken({
      encoded: encodedIdToken,
      decoded: decodedIdToken,
    });
    this.storageManager.saveAccessToken(newAccessToken);
  }

  private parseRedirect() {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    if (searchParams.toString() === "") {
      return {
        authorizeResponse: null,
      };
    }

    const authorizeResponse = this.parseLoginRedirect(searchParams);

    return {
      authorizeResponse,
    };
  }

  private parseLoginRedirect(searchParams: URLSearchParams): AuthorizeResponse | null {
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

    const url = new URL(window.location.href);
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
  ): string {
    if (error) {
      throw new Error("Error during authorization", {
        cause: error_description,
      });
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
    maxAge = -1,
  ): Promise<{
    url: string;
    nonce: string;
    state: string;
    codeVerifier: string;
  }> {
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

    if (maxAge >= 0) {
      url.searchParams.append("max_age", maxAge.toString());
      this.storageManager.saveTokenParams({
        audience,
        scope: usedScope,
        maxAge,
      });
    } else {
      this.storageManager.saveTokenParams({ audience, scope: usedScope });
    }

    if (acrValues.length > 0) {
      const acrString = acrValues.join(" ");
      url.searchParams.append("acr_values", acrString);
    }

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

  private initializeAuthenticationTransaction = async (options?: AuthenticationRequestParams) => {
    const oidcConfig = await this.getConfig();

    this.authenticationTransaction = new AuthenticationTransaction({
      oidcConfig,
      ...options,
      useRefreshToken: options?.useRefreshToken ?? this.globalUseRefreshToken,
      audience: options?.audience ?? this.globalAudience,
      scope: options?.scope ?? this.globalScope,
      clientId: this.clientId,
    });
  };

  private handleAuthenticationTransactionSuccess = () => {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const { idToken, accessToken, refreshToken, scope, expiresAt, maxAge, audience } =
      this.authenticationTransaction.getAuthenticationDetails();

    // Require the access token, id token, and necessary claims
    if (!(idToken && accessToken && expiresAt && scope)) {
      throw new Error("Error retrieving tokens from transaction");
    }

    // Saving tokens
    this.storageManager.saveIdToken({
      encoded: idToken,
      decoded: decodeJwt(idToken),
    });
    this.storageManager.saveAccessToken({
      accessToken,
      expiresAt,
      scope,
      refreshToken,
      audience,
      maxAgeExpiry: maxAge ? calculateEpochExpiry(maxAge.toString()) : undefined,
    });

    this.authenticationTransaction = undefined;
  };

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   */
  private async loginWithPopup({
    audience,
    scope,
    redirectUri,
    useRefreshToken,
    acrValues,
    maxAge,
  }: OidcLoginOptions): Promise<string | null> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);

    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "web_message",
      finalRedirectUri,
      useRefreshToken,
      scope,
      audience,
      acrValues,
      maxAge,
    );

    const popup = openPopup(url);
    const authorizeResponse = await listenToAuthorizePopup(popup, url);
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
  private async loginWithRedirect({
    audience,
    scope,
    redirectUri,
    useRefreshToken,
    acrValues,
    maxAge,
  }: OidcLoginOptions): Promise<void> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(
      "query",
      finalRedirectUri,
      useRefreshToken,
      scope,
      audience,
      acrValues,
      maxAge,
    );

    this.storageManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: finalRedirectUri,
    });

    window.location.href = url;
  }

  //Public API

  /**
   * Provides access to IDaaS hosted OIDC methods.
   * Contains login, logout, and handleRedirect methods.
   */
  public get oidc() {
    return {
      login: this.login.bind(this),
      logout: this.logout.bind(this),
      handleRedirect: this.handleRedirect.bind(this),
    };
  }

  /**
   * Perform the authorization code flow by authenticating the user to obtain an access token and optionally refresh and
   * ID tokens.
   *
   * If using redirect (i.e. popup=false), your application must also be configured to call handleRedirect at the redirectUri
   * to complete the flow.
   * */
  private async login({
    audience,
    scope,
    redirectUri,
    useRefreshToken = false,
    popup = false,
    acrValues,
    maxAge,
  }: OidcLoginOptions = {}): Promise<string | null> {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.loginWithPopup({
        audience,
        scope,
        redirectUri,
        useRefreshToken,
        acrValues,
        maxAge,
      });
    }

    await this.loginWithRedirect({
      audience,
      scope,
      redirectUri,
      useRefreshToken,
      acrValues,
      maxAge,
    });

    return null;
  }

  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   * If a redirectUri is provided, the user will be redirected to that URI after logout.
   */
  private async logout({ redirectUri }: LogoutOptions = {}): Promise<void> {
    if (!this.isAuthenticated()) {
      // Discontinue logout, the user is not authenticated
      return;
    }

    this.storageManager.remove();

    window.location.href = await this.generateLogoutUrl(redirectUri);
  }

  /**
   * Handle the callback to the login redirectUri post-authorize and pass the received code to the token endpoint to get
   * the access token, ID token, and optionally refresh token (optional). Additionally, validate the ID token claims.
   */
  private async handleRedirect(): Promise<null> {
    const { authorizeResponse } = this.parseRedirect();

    // The current url is not an authorized callback url
    if (!authorizeResponse) {
      return null;
    }

    if (authorizeResponse) {
      const clientParams = this.storageManager.getClientParams();
      if (!clientParams) {
        throw new Error("Failed to recover IDaaS client state from local storage");
      }
      const { codeVerifier, redirectUri, state, nonce } = clientParams;

      const authorizeCode = this.validateAuthorizeResponse(authorizeResponse, state);

      const validatedTokenResponse = await this.requestAndValidateTokens(
        authorizeCode,
        codeVerifier,
        redirectUri,
        nonce,
      );
      this.parseAndSaveTokenResponse(validatedTokenResponse);
      return null;
    }

    return null;
  }

  /**
   * Authenticate a user using password-based authentication.
   * Initiates an authentication transaction with the PASSWORD method and submits the provided password.
   *
   * @param options Authentication request parameters and the password to authenticate with
   * @returns The authentication response indicating success or requiring additional steps
   */
  public authenticatePassword = async ({
    options,
    password,
  }: {
    options: AuthenticationRequestParams;
    password: string;
  }) => {
    // 1. Prepare transaction with PASSWORD method
    await this.initializeAuthenticationTransaction({
      ...options,
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    if (!this.authenticationTransaction) {
      throw new Error();
    }

    // 2. Request authentication challenge
    await this.authenticationTransaction.requestAuthChallenge();

    // 3. Submit authentication challenge response
    const authResult = await this.authenticationTransaction.submitAuthChallenge({ response: password });

    if (authResult.authenticationCompleted) {
      this.handleAuthenticationTransactionSuccess();
    }

    return authResult;
  };

  /**
   * Initiates an authentication challenge request.
   * Prepares a new authentication transaction and requests a challenge from the authentication provider.
   *
   * @param options Optional authentication request parameters
   * @returns The authentication response containing challenge details
   */
  public async requestChallenge(options: AuthenticationRequestParams = {}): Promise<AuthenticationResponse> {
    // 1. Prepare transaction
    await this.initializeAuthenticationTransaction(options);

    if (!this.authenticationTransaction) {
      throw new Error();
    }

    // 2. Request authentication challenge, return response
    return await this.authenticationTransaction.requestAuthChallenge();
  }

  /**
   * Submits a response to an authentication challenge.
   * Processes authentication responses and completes the authentication if successful.
   *
   * @param options Authentication submission parameters including credentials or response data
   * @returns The authentication response indicating completion status or next steps
   */
  public async submitChallenge(options: AuthenticationSubmissionParams = {}): Promise<AuthenticationResponse> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    if (options.credential) {
      this.authenticationTransaction.submitPasskey(options.credential as AuthenticationCredential);
    }

    const authenticationResponse = await this.authenticationTransaction.submitAuthChallenge({ ...options });

    if (authenticationResponse.authenticationCompleted) {
      this.handleAuthenticationTransactionSuccess();
    }

    return authenticationResponse;
  }

  /**
   * Polls the authentication provider to check for completion of an ongoing authentication process.
   * Useful for authentication flows that may complete asynchronously (e.g., mobile push notifications).
   *
   * @returns The authentication response indicating completion status
   */
  public async pollAuth(): Promise<AuthenticationResponse> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const authenticationResponse = await this.authenticationTransaction.pollForAuthCompletion();

    if (authenticationResponse.authenticationCompleted) {
      this.handleAuthenticationTransactionSuccess();
    }
    return authenticationResponse;
  }

  /**
   * Cancels an ongoing authentication challenge.
   * Terminates the current authentication transaction and cleans up any pending state.
   */
  public async cancelAuth(): Promise<void> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    await this.authenticationTransaction.cancelAuthChallenge();
  }

  /**
   * Fetch the user information stored in the id_token
   * @returns returns the decodedIdToken containing the user info.
   */
  public getIdTokenClaims(): UserClaims | null {
    const idToken = this.storageManager.getIdToken();
    if (!idToken?.decoded) {
      return null;
    }

    return idToken.decoded as UserClaims;
  }

  /**
   * Checks if the user is currently authenticated by verifying the presence of a valid ID token.
   *
   * @returns True if the user is authenticated, false otherwise
   */
  public isAuthenticated(): boolean {
    return !!this.storageManager.getIdToken();
  }

  /**
   * Returns an access token with the required scopes and audience that is unexpired or refreshable.
   * The `fallbackAuthorizationOptions` parameter determines the result if there are no access tokens with the required scopes and audience that are unexpired or refreshable.
   */
  public async getAccessToken({
    audience = this.globalAudience,
    scope = this.globalScope,
    acrValues = [],
    fallbackAuthorizationOptions,
  }: GetAccessTokenOptions = {}): Promise<string | null> {
    // 1. Remove tokens that are no longer valid
    this.removeUnusableTokens();
    let accessTokens = this.storageManager.getAccessTokens();
    const requestedScopes = scope.split(" ");
    const now = Date.now();
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    if (accessTokens) {
      // 2. Find all tokens with the required audience that possess all required scopes
      // Tokens that have the required audience
      accessTokens = accessTokens.filter((token) => token.audience === audience);

      // Tokens that have the required audience and all scopes
      accessTokens = accessTokens.filter((token) => {
        const tokenScopes = token.scope.split(" ");
        return requestedScopes.every((scope: string) => tokenScopes.includes(scope));
      });

      if (acrValues && acrValues.length > 0) {
        // Tokens that have the required audience, all scopes, and a requested acr
        accessTokens = accessTokens.filter((token) => {
          if (token.acr) {
            return acrValues.includes(token.acr);
          }

          return false;
        });
      }

      // Sorts tokens by number of scopes in ascending order
      accessTokens.sort((token1, token2) => token1.scope.split(" ").length - token2.scope.split(" ").length);

      // 3. Taking the token with the fewest number of scopes:
      // - If the token is not expired, return it
      // - If the token is expired but refreshable, refresh it, remove it from storage, store the refreshed token, then return the refreshed token
      if (accessTokens[0]) {
        const requestedToken = accessTokens[0];
        const { refreshToken, accessToken, expiresAt, scope, audience, acr } = requestedToken;
        const expDate = (expiresAt - buffer) * 1000;

        // Token not expired
        if (expDate > now) {
          return accessToken;
        }

        if (!refreshToken) {
          throw new Error("Token that is not valid was not removed");
        }

        const {
          refresh_token: newRefreshToken,
          access_token: newEncodedAccessToken,
          expires_in,
        } = await this.requestTokenUsingRefreshToken(refreshToken);

        const authTime = readAccessToken(newEncodedAccessToken)?.auth_time;
        const newExpiration = calculateEpochExpiry(expires_in, authTime);

        // the refreshed access token to be stored, maintaining expired token's scope and audience
        const newAccessToken: AccessToken = {
          accessToken: newEncodedAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiration,
          audience,
          scope,
          acr,
        };

        this.storageManager.removeAccessToken(requestedToken);
        this.storageManager.saveAccessToken(newAccessToken);
        return newEncodedAccessToken;
      }
    }

    // 4. If no suitable tokens were found or all suitable tokens were expired and not refreshable, attempt to login using the fallbackAuthorizationOptions
    // No suitable tokens found
    if (fallbackAuthorizationOptions) {
      const { redirectUri, useRefreshToken, popup } = fallbackAuthorizationOptions;

      return await this.login({
        scope,
        audience,
        popup,
        useRefreshToken,
        redirectUri,
        acrValues,
      });
    }

    throw new Error("Requested token not found, no fallback login specified");
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
    const idToken = this.storageManager.getIdToken();
    if (idToken?.decoded.sub !== claims.sub) {
      return null;
    }

    return claims;
  }
}
