import { type AccessTokenRequest, requestToken } from "./api";
import type { IdaasServices } from "./IdaasServices";
import type { AuthorizeResponse, LogoutOptions, OidcLoginOptions, TokenOptions } from "./models";
import { listenToAuthorizePopup, openPopup } from "./utils/browser";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { formatUrl, sanitizeUri } from "./utils/format";
import { validateIdToken } from "./utils/jwt";

export class OidcClient {
  private services: IdaasServices;

  constructor(services: IdaasServices) {
    this.services = services;
  }

  /**
   * Perform the authorization code flow by authenticating the user to obtain an access token and optionally refresh and
   * ID tokens.
   *
   * If using redirect (i.e. popup=false), your application must also be configured to call handleRedirect at the redirectUri
   * to complete the flow.
   * @param options Login options including audience, scope, redirectUri, useRefreshToken, acrValues, maxAge, and popup
   * @returns The access token if using popup mode, otherwise null
   * */
  public async login({
    audience,
    scope,
    redirectUri,
    useRefreshToken = false,
    popup = false,
    acrValues,
    maxAge,
  }: OidcLoginOptions & TokenOptions = {}): Promise<string | null> {
    if (popup) {
      const popupWindow = openPopup("");
      const { response_modes_supported } = await this.services.getConfig();
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
   * @param options Logout options, configurable redirectUri
   */
  public async logout({ redirectUri }: LogoutOptions = {}): Promise<void> {
    if (!this.services.isAuthenticated()) {
      // Discontinue logout, the user is not authenticated
      return;
    }

    this.services.storageManager.remove();

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

    if (authorizeResponse) {
      const clientParams = this.services.storageManager.getClientParams();
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
      this.services.parseAndSaveTokenResponse(validatedTokenResponse);
      return null;
    }

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
      await this.services.getConfig();

    const tokenRequest: AccessTokenRequest = {
      client_id: this.services.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResponse = await requestToken(token_endpoint, tokenRequest);

    const { decodedJwt: decodedIdToken, idToken } = validateIdToken({
      clientId: this.services.clientId,
      idToken: tokenResponse.id_token,
      issuer: this.services.issuerUrl,
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
    const { end_session_endpoint } = await this.services.getConfig();

    const url = new URL(end_session_endpoint);
    url.searchParams.append("client_id", this.services.clientId);
    if (redirectUri) {
      url.searchParams.append("post_logout_redirect_uri", redirectUri);
    }
    return url.toString();
  }

  /**
   * Generate the authorization url by generating searchParams. codeVerifier will need to be stored for use after redirect.
   */
  private async generateAuthorizationUrl(
    responseMode: "query" | "web_message",
    redirectUri: string = window.location.href,
    refreshToken: boolean = this.services.globalUseRefreshToken,
    scope: string = this.services.globalScope,
    audience: string | undefined = this.services.globalAudience,
    acrValues: string[] = [],
    maxAge = -1,
  ): Promise<{
    url: string;
    nonce: string;
    state: string;
    codeVerifier: string;
  }> {
    const { authorization_endpoint } = await this.services.getConfig();
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
    url.searchParams.append("client_id", this.services.clientId);
    url.searchParams.append("redirect_uri", redirectUri);
    if (audience) {
      url.searchParams.append("audience", audience);
    }
    url.searchParams.append("scope", usedScope);
    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("response_mode", responseMode);
    url.searchParams.append("code_challenge", codeChallenge);
    url.searchParams.append("code_challenge_method", "S256");

    if (maxAge >= 0) {
      url.searchParams.append("max_age", maxAge.toString());
      this.services.storageManager.saveTokenParams({
        audience,
        scope: usedScope,
        maxAge,
      });
    } else {
      this.services.storageManager.saveTokenParams({ audience, scope: usedScope });
    }

    if (acrValues.length > 0) {
      const acrString = acrValues.join(" ");
      url.searchParams.append("acr_values", acrString);
    }

    return { url: url.toString(), nonce, state, codeVerifier };
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
  }: OidcLoginOptions & TokenOptions): Promise<string | null> {
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

    this.services.parseAndSaveTokenResponse(validatedTokenResponse);

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
  }: OidcLoginOptions & TokenOptions): Promise<void> {
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

    this.services.storageManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: finalRedirectUri,
    });

    window.location.href = url;
  }
}
