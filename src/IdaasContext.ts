import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { TokenOptions } from "./models";

/**
 * Normalized token options with defaults applied.
 * All properties except audience are required (audience is optional per OIDC spec).
 */
export type NormalizedTokenOptions = Required<Omit<TokenOptions, "audience">> & Pick<TokenOptions, "audience">;

/**
 * Services class to provide shared functionality to OIDC and RBA clients
 * without exposing the entire IdaasClient implementation
 */
export class IdaasContext {
  readonly #issuerUrl: string;
  readonly #clientId: string;
  readonly #tokenOptions: NormalizedTokenOptions;

  #config?: OidcConfig;

  constructor({
    issuerUrl,
    clientId,
    tokenOptions,
  }: {
    issuerUrl: string;
    clientId: string;
    tokenOptions: NormalizedTokenOptions;
  }) {
    this.#tokenOptions = tokenOptions;
    this.#issuerUrl = issuerUrl;
    this.#clientId = clientId;
  }

  get issuerUrl() {
    return this.#issuerUrl;
  }

  get clientId() {
    return this.#clientId;
  }

  get tokenOptions() {
    return this.#tokenOptions;
  }

  /**
   * Get the OpenID configuration for the provider
   */
  public async getConfig(): Promise<OidcConfig> {
    if (!this.#config) {
      this.#config = await fetchOpenidConfiguration(this.issuerUrl);
    }
    return this.#config;
  }
}
