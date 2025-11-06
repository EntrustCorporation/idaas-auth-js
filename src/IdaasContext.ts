import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { TokenOptions } from "./models";

/**
 * Services class to provide shared functionality to OIDC and RBA clients
 * without exposing the entire IdaasClient implementation
 */
export class IdaasContext {
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly tokenOptions: Required<TokenOptions>;

  private config?: OidcConfig;

  constructor({
    issuerUrl,
    clientId,
    tokenOptions,
  }: {
    issuerUrl: string;
    clientId: string;
    tokenOptions: Required<TokenOptions>;
  }) {
    this.tokenOptions = tokenOptions;
    this.issuerUrl = issuerUrl;
    this.clientId = clientId;
  }

  /**
   * Get the OpenID configuration for the provider
   */
  public async getConfig(): Promise<OidcConfig> {
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }
    return this.config;
  }
}
