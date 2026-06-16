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
  readonly #context: IdaasContext;
  readonly #storageManager: StorageManager;

  constructor(context: IdaasContext, storageManager: StorageManager) {
    this.#context = context;
    this.#storageManager = storageManager;
  }

  /**
   * Initiates the OIDC authorization code flow to authenticate the user.
   *
   * Supports two modes:
   * - **Popup mode** (`popup: true`): Opens a popup window for authentication, automatically handles the callback,
   *   and returns the access token
   * - **Redirect mode** (`popup: false`): Redirects the current page to the identity provider. Your application
   *   must call `handleRedirect()` at the `redirectUri` to complete the flow
   *
   * The flow uses PKCE (Proof Key for Code Exchange) for security and obtains:
   * - Access token (always)
   * - ID token (always)
   * - Refresh token (optional, if `useRefreshToken: true`)
   *
   * @param options Login options including popup mode and redirect URI
   * @param tokenOptions Token request options (audience, scope, refresh token, ACR values)
   * @returns The access token if using popup mode, otherwise `null`
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md OIDC Guide}
   * */
  public async login(
    { redirectUri, popup }: OidcLoginOptions = {},
    tokenOptions: TokenOptions = {},
  ): Promise<string | null> {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.#context.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }
      return await this.#loginWithPopup({ redirectUri }, tokenOptions);
    }

    await this.#loginWithRedirect({ redirectUri }, tokenOptions);

    return null;
  }

  /**
   * Logs the user out by clearing the local session and redirecting to the identity provider's logout endpoint.
   *
   * This method:
   * 1. Removes all stored tokens (access, ID, and refresh) from local storage
   * 2. Redirects the browser to the identity provider's `end_session_endpoint`
   * 3. Optionally redirects back to your application after logout completes
   *
   * After logout, the user's session with the identity provider is terminated. If `redirectUri` is provided,
   * the identity provider will redirect the user back to that URI after logout.
   *
   * @param options Logout options with optional redirect URI
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md OIDC Guide}
   */
  public async logout({ redirectUri }: OidcLogoutOptions = {}): Promise<void> {
    // Clean up any persisted DPoP key material before clearing storage
    const tokenParams = this.#storageManager.getTokenParams();
    if (tokenParams?.dpopKeyRef) {
      await this.#context.clearDpopKeyMaterial(tokenParams.dpopKeyRef);
    }

    this.#storageManager.remove();

    window.location.href = await this.#generateLogoutUrl(redirectUri);
  }

  /**
   * Completes the OIDC authorization code flow after redirect from the identity provider.
   *
   * Call this method at your application's `redirectUri` to:
   * 1. Parse the authorization code from the URL query parameters
   * 2. Exchange the code for tokens (access, ID, and optionally refresh)
   * 3. Validate and store the tokens
   *
   * This method should be called early in your application initialization at the redirect URI path,
   * typically before rendering your main application UI.
   *
   * **Important**: Only required when using redirect mode (`popup: false` in `login()`).
   * Popup mode handles the callback automatically.
   *
   * @returns `null` after processing the redirect, or `null` if current URL is not an OAuth callback
   * @throws {Error} If client state cannot be recovered from storage
   * @throws {Error} If authorization response contains an error
   * @throws {Error} If token validation fails
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md OIDC Guide}
   */
  public async handleRedirect(): Promise<null> {
    const { authorizeResponse } = this.#parseRedirect();

    // The current url is not an authorized callback url
    if (!authorizeResponse) {
      return null;
    }

    const clientParams = this.#storageManager.getClientParams();
    if (!clientParams) {
      throw new Error("Failed to recover IDaaS client state from local storage");
    }
    const { codeVerifier, redirectUri, state, nonce } = clientParams;
    const tokenParams = this.#storageManager.getTokenParams();
    if (!tokenParams) {
      throw new Error("No token params stored, unable to parse");
    }

    try {
      if (tokenParams.dpopKeyRef) {
        await this.#context.restoreDpopKeyMaterialByRef(tokenParams.dpopKeyRef);
      }

      const authorizeCode = this.#validateAuthorizeResponse(authorizeResponse, state);

      const validatedTokenResponse = await this.#requestAndValidateTokens(
        authorizeCode,
        codeVerifier,
        redirectUri,
        nonce,
        tokenParams.requireIdToken ?? true,
        tokenParams.acrValues?.split(" ").filter(Boolean),
        tokenParams.dpop,
      );
      this.#parseAndSaveTokenResponse(validatedTokenResponse, tokenParams);
    } finally {
      this.#storageManager.removeTokenParams();
    }

    return null;
  }

  #parseRedirect() {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    if (searchParams.toString() === "") {
      return {
        authorizeResponse: null,
      };
    }

    const authorizeResponse = this.#parseLoginRedirect(searchParams);

    return {
      authorizeResponse,
    };
  }

  #parseLoginRedirect(searchParams: URLSearchParams): AuthorizeResponse | null {
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

  #validateAuthorizeResponse(
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

  async #requestAndValidateTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    nonce: string,
    requireIdToken: boolean,
    requestedAcrValues?: string[],
    dpopOptions?: TokenOptions["dpop"],
  ) {
    const { token_endpoint, id_token_signing_alg_values_supported, acr_values_supported, jwks_uri } =
      await this.#context.getConfig();

    const tokenRequest: AccessTokenRequest = {
      client_id: this.#context.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const dpopJwt = await this.#context.createDpopProof({
      method: "POST",
      uri: token_endpoint,
      dpopOptions,
    });

    const tokenResponse = await requestToken(token_endpoint, tokenRequest, dpopJwt);

    if (!tokenResponse.id_token && !requireIdToken) {
      return { tokenResponse };
    }

    const { decodedJwt: decodedIdToken, idToken } = await validateIdToken({
      clientId: this.#context.clientId,
      idToken: tokenResponse.id_token,
      issuer: this.#context.issuerUrl,
      nonce,
      idTokenSigningAlgValuesSupported: id_token_signing_alg_values_supported,
      allowedIdTokenSigningAlgorithms: this.#context.allowedIdTokenSigningAlgorithms,
      acrValuesSupported: acr_values_supported,
      jwksEndpoint: jwks_uri,
      requestedAcrValues,
    });

    return { tokenResponse, decodedIdToken, encodedIdToken: idToken };
  }

  /**
   * Generate the endsession url with the required query params to log out the user from the OpenID Provider
   */
  async #generateLogoutUrl(redirectUri?: string): Promise<string> {
    const { end_session_endpoint } = await this.#context.getConfig();

    const url = new URL(end_session_endpoint);
    url.searchParams.append("client_id", this.#context.clientId);
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
  #parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse, tokenParams: TokenParams): void {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;
    const authTime = readAccessToken(access_token)?.auth_time;
    const expiresAt = calculateEpochExpiry(expires_in, authTime);

    const { audience, scope, maxAge } = tokenParams;
    const maxAgeExpiry = maxAge ? calculateEpochExpiry(maxAge.toString(), authTime) : undefined;

    this.#storageManager.removeTokenParams();

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
      dpopBound: tokenResponse.token_type.toLowerCase() === "dpop",
    };

    if (encodedIdToken && decodedIdToken) {
      this.#storageManager.saveIdToken({
        encoded: encodedIdToken,
        decoded: decodedIdToken,
      });
    }

    this.#storageManager.saveAccessToken(newAccessToken);
  }

  /**
   * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
   */
  async #loginWithPopup({ redirectUri }: OidcLoginOptions, tokenOptions: TokenOptions): Promise<string | null> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
    const dpopJkt = await this.#context.getDpopJkt(tokenOptions.dpop);

    const { url, nonce, state, codeVerifier, usedScope } = await generateAuthorizationUrl(
      await this.#context.getConfig(),
      {
        type: "standard",
        clientId: this.#context.clientId,
        responseMode: "web_message",
        redirectUri: finalRedirectUri,
        dpopJkt,
        tokenOptions: {
          ...this.#context.tokenOptions,
          ...tokenOptions,
        },
      },
    );

    const tokenParams: TokenParams = {
      audience: tokenOptions.audience ?? this.#context.tokenOptions.audience,
      scope: usedScope,
      requireIdToken: (tokenOptions.includeOpenidScope ?? this.#context.tokenOptions.includeOpenidScope) !== false,
      acrValues: tokenOptions.acrValues ?? this.#context.tokenOptions.acrValues,
      dpop: this.#context.getEffectiveDpopOptions(tokenOptions.dpop),
    };

    if (tokenOptions.maxAge !== undefined && tokenOptions.maxAge >= 0) {
      tokenParams.maxAge = tokenOptions.maxAge;
    }

    this.#storageManager.saveTokenParams(tokenParams);

    const popup = openPopup(url);
    const authorizeResponse = await listenToAuthorizePopup(popup, url);
    const authorizeCode = this.#validateAuthorizeResponse(authorizeResponse, state);
    const validatedTokenResponse = await this.#requestAndValidateTokens(
      authorizeCode,
      codeVerifier,
      finalRedirectUri,
      nonce,
      tokenParams.requireIdToken ?? true,
      tokenParams.acrValues?.split(" ").filter(Boolean),
      tokenParams.dpop,
    );

    this.#parseAndSaveTokenResponse(validatedTokenResponse, tokenParams);

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
  async #loginWithRedirect({ redirectUri }: OidcLoginOptions, tokenOptions: TokenOptions): Promise<void> {
    const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
    const effectiveDpop = this.#context.getEffectiveDpopOptions(tokenOptions.dpop);
    const dpopJkt = await this.#context.getDpopJkt(tokenOptions.dpop);

    const dpopKeyRef = effectiveDpop?.includeJkt
      ? await this.#context.persistDpopKeyMaterialForAlg(effectiveDpop.alg)
      : undefined;

    const { url, nonce, state, codeVerifier, usedScope } = await generateAuthorizationUrl(
      await this.#context.getConfig(),
      {
        type: "standard",
        clientId: this.#context.clientId,
        responseMode: "query",
        redirectUri: finalRedirectUri,
        dpopJkt,
        tokenOptions: {
          ...this.#context.tokenOptions,
          ...tokenOptions,
        },
      },
    );

    const tokenParams: TokenParams = {
      audience: tokenOptions.audience ?? this.#context.tokenOptions.audience,
      scope: usedScope,
      requireIdToken: (tokenOptions.includeOpenidScope ?? this.#context.tokenOptions.includeOpenidScope) !== false,
      acrValues: tokenOptions.acrValues ?? this.#context.tokenOptions.acrValues,
      dpop: this.#context.getEffectiveDpopOptions(tokenOptions.dpop),
      dpopKeyRef,
    };

    if (tokenOptions.maxAge !== undefined && tokenOptions.maxAge >= 0) {
      tokenParams.maxAge = tokenOptions.maxAge;
    }

    this.#storageManager.saveTokenParams(tokenParams);

    this.#storageManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: finalRedirectUri,
    });

    window.location.href = url;
  }
}
