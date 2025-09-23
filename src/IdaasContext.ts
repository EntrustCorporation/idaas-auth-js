import { fetchOpenidConfiguration, type OidcConfig } from "./api";

/**
 * Services class to provide shared functionality to OIDC and RBA clients
 * without exposing the entire IdaasClient implementation
 */
export class IdaasContext {
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly globalScope: string;
  readonly globalAudience: string | undefined;
  readonly globalUseRefreshToken: boolean;

  private config?: OidcConfig;

  constructor({
    issuerUrl,
    clientId,
    globalAudience,
    globalScope,
    globalUseRefreshToken,
  }: {
    issuerUrl: string;
    clientId: string;
    globalAudience?: string;
    globalScope?: string;
    globalUseRefreshToken?: boolean;
  }) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
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
