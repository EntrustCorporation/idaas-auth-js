import { loginWithPopup, loginWithRedirect } from "./helpers/oidc";
import { parseAndSaveTokenResponse, requestAndValidateTokens } from "./helpers/token";
import { generateLogoutUrl, parseRedirect, validateAuthorizeResponse } from "./helpers/url";
import type { IdaasContext } from "./IdaasContext";
import type { LogoutOptions, OidcLoginOptions, TokenOptions } from "./models";
import type { StorageManager } from "./storage/StorageManager";
import { openPopup } from "./utils/browser";

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
      const { response_modes_supported } = await this.context.getConfig();
      const popupSupported = response_modes_supported?.includes("web_message");
      if (!popupSupported) {
        popupWindow.close();
        throw new Error("Attempted to use popup but web_message is not supported by OpenID provider.");
      }
      return await loginWithPopup({
        audience,
        scope,
        redirectUri,
        useRefreshToken,
        acrValues,
        maxAge,
        context: this.context,
        storageManager: this.storageManager,
      });
    }

    await loginWithRedirect({
      audience,
      scope,
      redirectUri,
      useRefreshToken,
      acrValues,
      maxAge,
      context: this.context,
      storageManager: this.storageManager,
    });

    return null;
  }

  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   * If a redirectUri is provided, the user will be redirected to that URI after logout.
   * @param options - Logout options, configurable redirectUri
   */
  public async logout({ redirectUri }: LogoutOptions = {}): Promise<void> {
    this.storageManager.remove();

    window.location.href = await generateLogoutUrl(this.context, redirectUri);
  }

  /**
   * Handle the callback to the login redirectUri post-authorize and pass the received code to the token endpoint to get
   * the access token, ID token, and optionally refresh token (optional). Additionally, validate the ID token claims.
   */
  public async handleRedirect(): Promise<null> {
    const authorizeResponse = parseRedirect();

    // The current url is not an authorized callback url
    if (!authorizeResponse) {
      return null;
    }

    const clientParams = this.storageManager.getClientParams();
    if (!clientParams) {
      throw new Error("Failed to recover IDaaS client state from local storage");
    }
    const { codeVerifier, redirectUri, state, nonce } = clientParams;

    const authorizeCode = validateAuthorizeResponse(authorizeResponse, state);

    const validatedTokenResponse = await requestAndValidateTokens(
      authorizeCode,
      codeVerifier,
      redirectUri,
      nonce,
      this.context,
    );
    parseAndSaveTokenResponse(validatedTokenResponse, this.storageManager);
    return null;
  }
}
