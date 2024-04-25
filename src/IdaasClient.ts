import { type OidcConfig, fetchOpenidConfiguration } from "./api";

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
  public async login(redirectUri?: string) {}

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
}
