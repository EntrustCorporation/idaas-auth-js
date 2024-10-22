import type { JWTPayload } from "jose";
import { type AccessToken, PersistenceManager } from "./PersistenceManager";
import {
  type AccessTokenRequest,
  type OidcConfig,
  type RefreshTokenRequest,
  type TokenResponse,
  fetchOpenidConfiguration,
  getUserInfo,
  queryUserAuthOptions,
  requestAuthChallenge,
  requestToken,
  submitAuthChallengeResponse,
} from "./api";
import type {
  AuthRequestReturn,
  AuthenticationRequestParams,
  AuthorizeResponse,
  GetAccessTokenOptions,
  IdaasClientOptions,
  LoginOptions,
  LogoutOptions,
  OnboardingResponse,
  SignUpOptions,
  UserClaims,
} from "./models";
import { listenToAuthorizePopup, listenToOnboardingPopup, openPopup } from "./utils/browser";
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
  private readonly persistenceManager: PersistenceManager;
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly authApiId: string;
  private readonly globalScope: string;
  private readonly globalAudience: string | undefined;
  private readonly globalUseRefreshToken: boolean;

  private config?: OidcConfig;
  private faceResponse?: string;

  constructor({
    issuerUrl,
    clientId,
    globalAudience,
    globalScope,
    globalUseRefreshToken,
    authApiId,
  }: IdaasClientOptions) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
    this.issuerUrl = formatUrl(issuerUrl);
    this.persistenceManager = new PersistenceManager(clientId);
    this.clientId = clientId;
    this.authApiId = authApiId;
  }

  public async signUp({ redirectUri, popup = false }: SignUpOptions = {}) {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
    const url = this.generateSignUpUrl({ redirectUri: finalRedirectUri, popup });

    if (popup) {
      const testPopupWindow = openPopup("");
      const { response_modes_supported } = await this.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");

      if (!popupSupported) {
        testPopupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }

      const popupWindow = openPopup(url);
      const onboardingResponse = await listenToOnboardingPopup(popupWindow, url);

      // redirect only if the redirectUri is not the current uri
      if (formatUrl(window.location.href) !== formatUrl(finalRedirectUri)) {
        window.location.href = finalRedirectUri;
      }
      return onboardingResponse.userId;
    }
    window.location.href = url;

    return null;
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
    maxAge,
  }: LoginOptions = {}): Promise<string | null> {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.loginWithPopup({ audience, scope, redirectUri, useRefreshToken, acrValues, maxAge });
    }

    await this.loginWithRedirect({ audience, scope, redirectUri, useRefreshToken, acrValues, maxAge });

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
    maxAge,
  }: LoginOptions): Promise<string | null> {
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
  }: LoginOptions): Promise<void> {
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
  public async handleRedirect(): Promise<OnboardingResponse | null> {
    const { authorizeResponse, signUpResponse } = this.parseRedirect();
    // The current url is not an authorized callback url
    if (!(authorizeResponse || signUpResponse)) {
      return null;
    }

    if (authorizeResponse) {
      const clientParams = this.persistenceManager.getClientParams();
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

    return signUpResponse;
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

  public isAuthenticated(): boolean {
    return !!this.persistenceManager.getIdToken();
  }

  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   */
  public async logout({ redirectUri }: LogoutOptions = {}): Promise<void> {
    if (!this.isAuthenticated()) {
      // Discontinue logout, the user is not authenticated
      return;
    }

    this.persistenceManager.remove();

    window.location.href = await this.generateLogoutUrl(redirectUri);
  }

  /**
   * Removes tokens from storage that have surpassed their max_age, and tokens that are expired and not refreshable.
   */
  private removeUnusableTokens = (): void => {
    const tokens = this.persistenceManager.getAccessTokens();
    if (!tokens) {
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    for (const token of tokens) {
      if (token.maxAgeExpiry) {
        if (now > token.maxAgeExpiry - buffer) {
          this.persistenceManager.removeAccessToken(token);
        }
      }

      if (now > token.expiresAt - buffer) {
        if (!token.refreshToken) {
          this.persistenceManager.removeAccessToken(token);
        }
      }
    }
  };
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
    let accessTokens = this.persistenceManager.getAccessTokens();
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
        return requestedScopes.every((scope) => tokenScopes.includes(scope));
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

        this.persistenceManager.removeAccessToken(requestedToken);
        this.persistenceManager.saveAccessToken(newAccessToken);
        return newEncodedAccessToken;
      }
    }

    // 4. If no suitable tokens were found or all suitable tokens were expired and not refreshable, attempt to login using the fallbackAuthorizationOptions
    // No suitable tokens found
    if (fallbackAuthorizationOptions) {
      const { redirectUri, useRefreshToken, popup } = fallbackAuthorizationOptions;

      return await this.login({ scope, audience, popup, useRefreshToken, redirectUri, acrValues });
    }

    throw new Error("Requested token not found, no fallback login specified");
  }

  private parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse): void {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;
    const authTime = readAccessToken(access_token)?.auth_time;
    const expiresAt = calculateEpochExpiry(expires_in, authTime);
    const tokenParams = this.persistenceManager.getTokenParams();

    if (!tokenParams) {
      throw new Error("No token params stored, unable to parse");
    }

    const { audience, scope, maxAge } = tokenParams;
    const maxAgeExpiry = maxAge ? calculateEpochExpiry(maxAge.toString(), authTime) : undefined;

    this.persistenceManager.removeTokenParams();

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

  private parseRedirect() {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    if (searchParams.toString() === "") {
      return { signUpResponse: null, authorizeResponse: null };
    }

    const authorizeResponse = this.parseLoginRedirect(searchParams);
    const signUpResponse = this.parseSignUpRedirect(searchParams);

    return { signUpResponse, authorizeResponse };
  }

  private parseSignUpRedirect(searchParams: URLSearchParams): OnboardingResponse | null {
    const error = searchParams.get("error");
    const userId = searchParams.get("userId");

    if (error) {
      throw new Error(error);
    }

    return userId || error ? { userId, error } : null;
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
    maxAge = -1,
  ): Promise<{ url: string; nonce: string; state: string; codeVerifier: string }> {
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
      this.persistenceManager.saveTokenParams({ audience, scope: usedScope, maxAge });
    } else {
      this.persistenceManager.saveTokenParams({ audience, scope: usedScope });
    }

    if (acrValues.length > 0) {
      const acrString = acrValues.join(" ");
      url.searchParams.append("acr_values", acrString);
    }

    return { url: url.toString(), nonce, state, codeVerifier };
  }

  private generateSignUpUrl({ redirectUri = sanitizeUri(window.location.href), popup }: SignUpOptions): string {
    const issuerOrigin = this.getIssuerOrigin();
    const signUpUrl = new URL(issuerOrigin);

    signUpUrl.pathname = "/api/web/user/onboard";
    signUpUrl.searchParams.append("redirect_uri", redirectUri);

    if (popup) {
      signUpUrl.searchParams.append("response_mode", "web_message");
    }

    return signUpUrl.toString();
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

  private getIssuerOrigin(): string {
    return new URL(this.issuerUrl).origin;
  }

  public async requestAuthChallenge({
    userId,
    preferredAuthenticationMethod,
    strict,
  }: AuthenticationRequestParams): Promise<AuthRequestReturn> {
    const issuerOrigin = this.getIssuerOrigin();
    const queryAuthEndpoint = `${issuerOrigin}/api/web/v2/authentication/users`;
    const queryUserAuthResponse = await queryUserAuthOptions(userId, this.authApiId, queryAuthEndpoint);

    this.parseResponseErrors(queryUserAuthResponse);

    const { userLoginEnabled, authenticationTypes } = queryUserAuthResponse;

    if (!userLoginEnabled) {
      throw new Error("The User Login flow must be enabled");
    }

    const preferredMethodAvailable: boolean = authenticationTypes.includes(preferredAuthenticationMethod);
    let method = "";

    if (!preferredMethodAvailable && strict) {
      throw new Error("The preferred method of authentication is not available for this user!");
    }

    if (preferredAuthenticationMethod && preferredMethodAvailable) {
      method = preferredAuthenticationMethod;
    } else {
      method = authenticationTypes[0];
    }

    if (!method) {
      throw new Error("No available methods to authenticate this user!");
    }

    const authChallengeEndpoint = `${issuerOrigin}/api/web/v2/authentication/users/authenticate/${method}`;
    const requestAuthChallengeResponse = await requestAuthChallenge(userId, this.authApiId, authChallengeEndpoint);

    this.parseResponseErrors(requestAuthChallengeResponse);

    const { token, faceChallenge } = requestAuthChallengeResponse;

    if (!token) {
      throw new Error("No token in auth challenge request response");
    }

    if (faceChallenge) {
      this.faceResponse = faceChallenge.workflowRunId;
    }

    this.persistenceManager.setAuthenticationParams({ method, token, userId });

    return {
      method,
      faceChallenge,
    };
  }

  // faceResponse is the workflow run id to check for bio auth
  // TODO: params for other specific methods
  public async submitAuthChallengeResponse(response: string): Promise<boolean> {
    const authenticationParams = this.persistenceManager.getAuthenticationParams();

    if (!authenticationParams) {
      throw new Error("Failed to parse authentication params, no authentication params stored!");
    }

    const { method, token } = authenticationParams;

    const authResponse = await submitAuthChallengeResponse(
      this.authApiId,
      token,
      this.getIssuerOrigin(),
      method,
      false,
      response,
    );

    this.parseResponseErrors(authResponse);
    const { authenticationCompleted } = authResponse;

    if (authenticationCompleted) {
      this.persistenceManager.clearAuthenticationParams();
      return true;
    }
    return false;
  }

  public async pollForAuthCompletion(secondsToPoll = 30) {
    if (secondsToPoll < 1 || secondsToPoll > 600) {
      // TODO: error message
      throw new Error("secondsToPoll must be between 1 and 600");
    }

    const authenticationParams = this.persistenceManager.getAuthenticationParams();

    if (!authenticationParams) {
      throw new Error("Failed to parse authentication params, no authentication params stored!");
    }
    const { method, token } = authenticationParams;

    for (let i = 0; i < secondsToPoll; i++) {
      const authResponse = await submitAuthChallengeResponse(
        this.authApiId,
        token,
        this.getIssuerOrigin(),
        method,
        false,
        "",
        this.faceResponse,
      );

      try {
        this.parseResponseErrors(authResponse);
      } catch (error) {
        // The authentication request was cancelled
        if ((error as { message: string }).message === "no_transaction") {
          return false;
        }
        // Throw other errors
        throw error;
      }

      const { authenticationCompleted } = authResponse;

      if (authenticationCompleted) {
        return true;
      }

      // wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await this.cancelAuthRequest();
    throw new Error("Timed out while waiting for success response");
  }

  public async cancelAuthRequest() {
    const authenticationParams = this.persistenceManager.getAuthenticationParams();
    if (!authenticationParams) {
      throw new Error("Failed to parse authentication params, no authentication params stored!");
    }
    const { token, method } = authenticationParams;

    await submitAuthChallengeResponse(this.authApiId, token, this.getIssuerOrigin(), method, true);
  }
  private parseResponseErrors(response: { errorCode: string; errorMessage: string }) {
    const { errorCode, errorMessage } = response;
    if (errorCode) {
      throw new Error(errorCode, { cause: errorMessage });
    }
  }
}
