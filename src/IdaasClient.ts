import { PersistenceManager } from "./PersistenceManager";
import {
  type AccessTokenRequest,
  type OidcConfig,
  type RefreshTokenRequest,
  type TokenResponse,
  fetchOpenidConfiguration,
  requestToken,
} from "./api";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { formatIssuerUrl } from "./utils/format";
import { validateIdToken } from "./utils/jwt";

export interface IdaasClientOptions {
  issuerUrl: string;
  clientId: string;
}

export class IdaasClient {
  private readonly persistenceManager: PersistenceManager;
  private readonly issuerUrl: string;
  private readonly clientId: string;

  private config?: OidcConfig;

  constructor({ issuerUrl, clientId }: IdaasClientOptions) {
    this.issuerUrl = formatIssuerUrl(issuerUrl);
    this.persistenceManager = new PersistenceManager(clientId);
    this.isAuthenticated = this.isAuthenticated.bind(this);
    this.handleRedirect = this.handleRedirect.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.clientId = clientId;
  }

  /**
   * Begin the OIDC ceremony by navigating to the authorize endpoint with the necessary query parameters.
   * @param redirectUri optional callback url, if not provided will default to window location when starting ceremony
   */
  async login(redirectUri: string = window.location.origin) {
    const { url, nonce, state, codeVerifier } = await this.generateAuthorizationUrl(redirectUri);

    this.persistenceManager.saveClientParams({
      nonce,
      state,
      codeVerifier,
      redirectUri: redirectUri ?? window.location.origin,
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
    const clientParams = this.persistenceManager.getClientParams();
    if (!clientParams) {
      throw new Error("Failed to recover IDaaS client state from local storage");
    }
    const { codeVerifier, redirectUri, state, nonce } = clientParams;

    const authorizeResponse = this.parseRedirectSearchParams(callbackUrl);
    if (state !== authorizeResponse.state) {
      throw new Error(
        "State received during redirect does not match the state from the beginning of the OIDC ceremony",
      );
    }

    const { tokenResponse, decodedIdToken } = await this.requestToken(
      authorizeResponse.code,
      codeVerifier,
      redirectUri,
      nonce,
    );

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = Number.parseInt(tokenResponse.expires_in) + issuedAt;

    this.persistenceManager.saveTokens({ ...tokenResponse, decodedIdToken, expiresAt });
  }

  public isAuthenticated() {
    return !!this.persistenceManager.getTokens();
  }
  /**
   * Clear the application session and navigate to the OpenID Provider's (OP) endsession endpoint.
   * @param redirectUri optional url to redirect to after logout, must be one of the allowed logout redirect URLs defined
   * in the OIDC application. If not provided, the user will remain at the OP.
   */
  public async logout(redirectUri?: string) {
    const tokens = this.persistenceManager.getTokens();
    if (!tokens?.id_token) {
      // Discontinue logout, the user is not authenticated
      return;
    }
    const { id_token } = tokens;

    this.persistenceManager.remove();

    window.location.href = await this.generateLogoutUrl(id_token, redirectUri);
  }

  /**
   * Returns the stored access token if not expired.
   * If expired, fetches and stores new access and refresh tokens, replacing the previous ones and returning the new access token.
   */
  public async getAccessToken(): Promise<string | undefined> {
    const currentTokens = this.persistenceManager.getTokens();
    if (!currentTokens) {
      return undefined;
    }
    const { refresh_token: currentRefreshToken, expiresAt } = currentTokens;

    // buffer (in seconds) to refresh early, ensuring unexpired token is returned
    const buffer = 15;

    const now = new Date();
    const expDate = new Date((expiresAt - buffer) * 1000);

    if (now < expDate) {
      return currentTokens.access_token;
    }

    if (!currentRefreshToken) {
      return undefined;
    }
    const tokenResponse = await this.requestTokenUsingRefreshToken(currentRefreshToken);

    const { refresh_token: newRefreshToken, access_token: newAccessToken } = tokenResponse;
    const issuedAt = Math.floor(Date.now() / 1000);
    const newExpiration = Number.parseInt(tokenResponse.expires_in) + issuedAt;

    const newTokens = {
      ...currentTokens,
      refresh_token: newRefreshToken,
      access_token: newAccessToken,
      expiresAt: newExpiration,
    };

    this.persistenceManager.saveTokens(newTokens);

    return newAccessToken;
  }

  private parseRedirectSearchParams(callbackUrl: string): RedirectParams {
    const url = new URL(callbackUrl);
    const searchParams = url.searchParams;

    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    if (error) {
      throw new Error("Error during authorization", { cause: errorDescription });
    }

    if (!state || !code) {
      throw new Error("URL must contain state and code for the authorization flow");
    }

    return {
      state,
      code,
    };
  }

  private async requestToken(code: string, codeVerifier: string, redirectUri: string, nonce: string) {
    const { token_endpoint, id_token_signing_alg_values_supported, acr_values_supported } = await this.getConfig();

    const tokenRequest: AccessTokenRequest = {
      client_id: this.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResponse = await requestToken(token_endpoint, tokenRequest);

    const decodedIdToken = validateIdToken({
      clientId: this.clientId,
      idToken: tokenResponse.id_token as string,
      issuer: this.issuerUrl,
      nonce,
      idTokenSigningAlgValuesSupported: id_token_signing_alg_values_supported,
      acrValuesSupported: acr_values_supported,
    });
    return { tokenResponse, decodedIdToken };
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
  private async generateAuthorizationUrl(redirectUri: string) {
    const { authorization_endpoint } = await this.getConfig();

    const state = base64UrlStringEncode(createRandomString());
    const nonce = base64UrlStringEncode(createRandomString());
    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();

    const url = new URL(authorization_endpoint);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", this.clientId);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("scope", "openid profile offline_access");
    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("response_mode", "query");
    url.searchParams.append("code_challenge", codeChallenge);
    url.searchParams.append("code_challenge_method", "S256");

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
    return !this.config ? await fetchOpenidConfiguration(this.issuerUrl) : this.config;
  }
}

interface RedirectParams {
  state: string;
  code: string;
}
