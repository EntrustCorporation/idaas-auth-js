import { type OidcConfig, fetchOpenidConfiguration } from "./api";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils";
export class IdaasClient {
  private instantiated = false;
  private config?: OidcConfig;
  private readonly issuerUrl: string;

  constructor(
    issuerUrl: string,
    private readonly clientId: string,
  ) {
    // Format the issuerUrl to remove trailing /
    this.issuerUrl = issuerUrl.endsWith("/") ? issuerUrl.slice(0, -1) : issuerUrl;
  }

  /**
   * Begin the OIDC ceremony by navigating to the authorize endpoint with the necessary query parameters.
   * @param redirectUri optional callback url, if not provided will default to window location when starting ceremony
   */
  async login(redirectUri?: string) {
    if (!this.instantiated) {
      await this.loadConfiguration();
    }

    const url = await this.generateAuthorizationUrl(redirectUri);

    window.location.href = url;
  }

  /**
   * Handle the callback to the login redirectUri post-authorize and pass the received code to
   * the token endpoint to get the auth token.
   */
  public async handleRedirect() {}

  /**
   * Clear the application session and navigate to the IDP's endsession endpoint.
   */
  public async logout() {}

  /**
   * Fetch the OIDC configuration from the well-known endpoint and populate internal fields.
   */
  private async loadConfiguration() {
    this.config = await fetchOpenidConfiguration(this.issuerUrl);
    this.instantiated = true;
  }

  /**
   * Generate the authorization url by generating searchParams. codeVerifier will need to be stored for use after redirect.
   */
  private async generateAuthorizationUrl(redirectUri?: string) {
    if (!this.config) {
      throw new Error("OIDC Configuration is not loaded.");
    }

    const state = base64UrlStringEncode(createRandomString());
    const nonce = base64UrlStringEncode(createRandomString());
    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();

    const url = new URL(this.config.authorization_endpoint);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", this.clientId);
    url.searchParams.append("redirect_uri", redirectUri ?? window.location.origin);
    url.searchParams.append("scope", "openid profile offline_access");
    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("response_mode", "query");
    url.searchParams.append("code_challenge", codeChallenge);
    url.searchParams.append("code_challenge_method", "S256");

    return url.toString();
  }
}
