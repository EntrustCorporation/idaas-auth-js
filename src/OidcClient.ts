import { type AccessTokenRequest, requestToken } from "./api";
import type { ValidatedTokenResponse } from "./IdaasClient";
import type { IdaasContext } from "./IdaasContext";
import type { AuthorizeResponse, OidcLoginOptions, OidcLogoutOptions, TokenOptions } from "./models";
import type { AccessToken, StorageManager, TokenParams } from "./storage/StorageManager";
import { listenToAuthorizePopup, openPopup } from "./utils/browser";
import { calculateEpochExpiry, formatUrl, sanitizeUri } from "./utils/format";
import { readAccessToken, validateIdToken } from "./utils/jwt";
import { generateAuthorizationUrl } from "./utils/url";

/**
 * This class handles authorization for OIDC flows using both popup
 * and redirect authentication patterns. It manages the entire OIDC ceremony
 * including authorization URL generation, token exchange, validation, and processing
 * redirect callbacks.
 *
 * Contains three main methods: login, logout, and handleRedirect.
 */

export class OidcClient {
  private context: IdaasContext;
  private storageManager: StorageManager;

  constructor(context: IdaasContext, storageManager: StorageManager) {
    this.context = context;
    this.storageManager = storageManager;
  }

  /**
   * Perform the authorization code flow by authenticating the user to obtain an access token and optionally refresh and
   * ID tokens.
   *
   * If using redirect (i.e. popup=false), your application must also be configured to call handleRedirect at the redirectUri
   * to complete the flow.
   * @param options - Login options including audience, scope, redirectUri, useRefreshToken, acrValues, maxAge, and popup
   * @returns The access token if using popup mode, otherwise null
   * */
  public async login(
    { redirectUri, popup }: OidcLoginOptions = {},
    tokenOptions: TokenOptions = {},
  ): Promise<string | null> {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.context.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.loginWithPopup({ redirectUri }, tokenOptions);
    }

    await this.loginWithRedirect({ redirectUri }, tokenOptions);

    return null;
  }

  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   * If a redirectUri is provided, the user will be redirected to that URI after logout.
   * @param options - Logout options, configurable redirectUri
   */
  public async logout({ redirectUri }: OidcLogoutOptions = {}): Promise<void> {
    this.storageManager.remove();

    window.location.href = await this.generateLogoutUrl(redirectUri);
  }

  /**
   * Handle the callback to the login redirectUri post-authorize and pass the received code to the token endpoint to get
   * the access token, ID token, and optionally refresh token (optional). Additionally, validate the ID token claims.
   */
  public async handleRedirect(): Promise<null> {
    const { authorizeResponse } = this.parseRedirect();

    // The current url is not an authorized callback url
    if (!authorizeResponse) {
      return null;
    }

    const clientParams = this.storageManager.getClientParams();
    if (!clientParams) {
      throw new Error("Failed to recover IDaaS client state from local storage");
    }
    const { codeVerifier, redirectUri, state, nonce } = clientParams;

    const authorizeCode = this.validateAuthorizeResponse(authorizeResponse, state);

    const validatedTokenResponse = await this.requestAndValidateTokens(authorizeCode, codeVerifier, redirectUri, nonce);
    this.parseAndSaveTokenResponse(validatedTokenResponse);
    return null;
  }

  // PRIVATE METHODS

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

  private async requestAndValidateTokens(code: string, codeVerifier: string, redirectUri: string, nonce: string) {
    const { token_endpoint, id_token_signing_alg_values_supported, acr_values_supported } =
      await this.context.getConfig();

    const tokenRequest: AccessTokenRequest = {
      client_id: this.context.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResponse = await requestToken(token_endpoint, tokenRequest);

    const { decodedJwt: decodedIdToken, idToken } = validateIdToken({
      clientId: this.context.clientId,
      idToken: tokenResponse.id_token,
      issuer: this.context.issuerUrl,
      nonce,
      idTokenSigningAlgValuesSupported: id_token_signing_alg_values_supported,
      acrValuesSupported: acr_values_supported,
    });

    return { tokenResponse, decodedIdToken, encodedIdToken: idToken };
  }

  /**
   * Generate the endsession url with the required query params to log out the user from the OpenID Provider
   */
  private async generateLogoutUrl(redirectUri?: string): Promise<string> {
    const { end_session_endpoint } = await this.context.getConfig();

    const url = new URL(end_session_endpoint);
    url.searchParams.append("client_id", this.context.clientId);
    if (redirectUri) {
      url.searchParams.append("post_logout_redirect_uri", redirectUri);
    }
    return url.toString();
  }

  /**
   * Parses the token response from the OIDC provider and saves tokens to storage.
   * Extracts access token, ID token, and refresh token (if available).
   * @param validatedTokenResponse The validated response from the token endpoint
   */
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

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   */
  private async loginWithPopup({ redirectUri }: OidcLoginOptions, tokenOptions: TokenOptions): Promise<string | null> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);

    const { url, nonce, state, codeVerifier, usedScope } = await generateAuthorizationUrl(
      await this.context.getConfig(),
      {
        type: "standard",
        clientId: this.context.clientId,
        responseMode: "web_message",
        redirectUri: finalRedirectUri,
        tokenOptions: {
          ...this.context.tokenOptions,
          ...tokenOptions,
        },
      },
    );

    const tokenParams: TokenParams = {
      audience: tokenOptions.audience ?? this.context.tokenOptions.audience,
      scope: usedScope,
    };

    if (tokenOptions.maxAge !== undefined && tokenOptions.maxAge >= 0) {
      tokenParams.maxAge = tokenOptions.maxAge;
    }

    this.storageManager.saveTokenParams(tokenParams);

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
  private async loginWithRedirect({ redirectUri }: OidcLoginOptions, tokenOptions: TokenOptions): Promise<void> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
    const { url, nonce, state, codeVerifier, usedScope } = await generateAuthorizationUrl(
      await this.context.getConfig(),
      {
        type: "standard",
        clientId: this.context.clientId,
        responseMode: "query",
        redirectUri: finalRedirectUri,
        tokenOptions: {
          ...this.context.tokenOptions,
          ...tokenOptions,
        },
      },
    );

    const tokenParams: TokenParams = {
      audience: tokenOptions.audience ?? this.context.tokenOptions.audience,
      scope: usedScope,
    };

    if (tokenOptions.maxAge !== undefined && tokenOptions.maxAge >= 0) {
      tokenParams.maxAge = tokenOptions.maxAge;
    }

    this.storageManager.saveTokenParams(tokenParams);

    this.storageManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: finalRedirectUri,
    });

    window.location.href = url;
  }
}
