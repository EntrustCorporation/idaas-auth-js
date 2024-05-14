import { PersistenceManager } from "./PersistenceManager";
import { type OidcConfig, type TokenRequest, fetchOpenidConfiguration, requestToken } from "./api";
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
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }

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
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }

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

    this.persistenceManager.saveTokens({ ...tokenResponse, decodedIdToken });
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
    if (!tokens) {
      // Discontinue logout, the user is not authenticated
      return;
    }
    const { id_token } = tokens;

    this.persistenceManager.remove();

    window.location.href = await this.generateLogoutUrl(id_token, redirectUri);
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
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }

    const tokenRequest: TokenRequest = {
      client_id: this.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResponse = await requestToken(this.config.token_endpoint, tokenRequest);

    const decodedIdToken = validateIdToken({
      clientId: this.clientId,
      idToken: tokenResponse.id_token,
      issuer: this.issuerUrl,
      nonce,
      idTokenSigningAlgValuesSupported: this.config.id_token_signing_alg_values_supported,
      acrValuesSupported: this.config.acr_values_supported,
    });

    return { tokenResponse, decodedIdToken };
  }

  /**
   * Generate the authorization url by generating searchParams. codeVerifier will need to be stored for use after redirect.
   */
  private async generateAuthorizationUrl(redirectUri: string) {
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }

    const state = base64UrlStringEncode(createRandomString());
    const nonce = base64UrlStringEncode(createRandomString());
    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();

    const url = new URL(this.config.authorization_endpoint);
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
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }

    const url = new URL(this.config.end_session_endpoint);
    url.searchParams.append("id_token_hint", idToken);
    url.searchParams.append("client_id", this.clientId);
    if (redirectUri) {
      url.searchParams.append("post_logout_redirect_uri", redirectUri);
    }

    return url.toString();
  }
}

interface RedirectParams {
  state: string;
  code: string;
}
