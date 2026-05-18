import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { TokenOptions } from "./models";

/**
 * Normalized token options with defaults applied.
 * All properties except audience & maxAge are required.
 */
export type NormalizedTokenOptions = Required<Omit<TokenOptions, "audience" | "maxAge">> &
  Pick<TokenOptions, "audience" | "maxAge">;

/**
 * Services class to provide shared functionality to OIDC and RBA clients
 * without exposing the entire IdaasClient implementation
 */
export class IdaasContext {
  readonly #issuerUrl: string;
  readonly #clientId: string;
  readonly #tokenOptions: NormalizedTokenOptions;
  readonly #allowedIdTokenSigningAlgorithms?: string[];

  #config?: OidcConfig;

  constructor({
    issuerUrl,
    clientId,
    tokenOptions,
    allowedIdTokenSigningAlgorithms,
  }: {
    issuerUrl: string;
    clientId: string;
    tokenOptions: NormalizedTokenOptions;
    allowedIdTokenSigningAlgorithms?: string[];
  }) {
    this.#tokenOptions = tokenOptions;
    this.#allowedIdTokenSigningAlgorithms = allowedIdTokenSigningAlgorithms;
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

  get allowedIdTokenSigningAlgorithms() {
    return this.#allowedIdTokenSigningAlgorithms;
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
