import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { TokenOptions } from "./models";
import { type DPoPAlg, type DPoPKeyMaterial, generateDpopKeyMaterial, generateDpopProofJwt } from "./utils/dpop";
import {
  cleanupPersistedDpopKeyMaterial,
  persistDpopKeyMaterial,
  retrievePersistedDpopKeyMaterial,
} from "./utils/dpopKeyStore";

export interface NormalizedDpopOptions {
  alg: DPoPAlg;
  includeJkt: boolean;
}

/**
 * Normalized token options with defaults applied.
 * All properties except audience & maxAge are required.
 */
export type NormalizedTokenOptions = Required<Omit<TokenOptions, "audience" | "maxAge" | "dpop">> &
  Pick<TokenOptions, "audience" | "maxAge" | "dpop"> & {
    dpop?: NormalizedDpopOptions;
  };

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
  #dpopKeyMaterial?: DPoPKeyMaterial;
  #dpopKeyAlg?: DPoPAlg;

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

  public getEffectiveDpopOptions(dpopOptions?: TokenOptions["dpop"]): NormalizedDpopOptions | undefined {
    if (!dpopOptions) {
      return this.#tokenOptions.dpop;
    }

    return {
      alg: dpopOptions.alg,
      includeJkt: dpopOptions.includeJkt ?? this.#tokenOptions.dpop?.includeJkt ?? false,
    };
  }

  public async getDpopJkt(dpopOptions?: TokenOptions["dpop"]): Promise<string | undefined> {
    const effectiveDpop = this.getEffectiveDpopOptions(dpopOptions);

    if (!effectiveDpop?.includeJkt) {
      return undefined;
    }

    const keyMaterial = await this.#getDpopKeyMaterial(effectiveDpop.alg);
    return keyMaterial.jkt;
  }

  public async createDpopProof({
    method,
    uri,
    dpopOptions,
    accessToken,
  }: {
    method: string;
    uri: string;
    dpopOptions?: TokenOptions["dpop"];
    accessToken?: string;
  }): Promise<string | undefined> {
    const effectiveDpop = this.getEffectiveDpopOptions(dpopOptions);

    if (!effectiveDpop) {
      return undefined;
    }

    const keyMaterial = await this.#getDpopKeyMaterial(effectiveDpop.alg);

    return await generateDpopProofJwt({
      alg: effectiveDpop.alg,
      privateKey: keyMaterial.privateKey,
      publicJwk: keyMaterial.publicJwk,
      htm: method,
      htu: uri,
      accessToken,
    });
  }

  public async persistDpopKeyMaterialForAlg(alg: DPoPAlg): Promise<string> {
    const keyMaterial = await this.#getDpopKeyMaterial(alg);

    return await persistDpopKeyMaterial({
      alg,
      privateKey: keyMaterial.privateKey,
      publicJwk: keyMaterial.publicJwk,
      jkt: keyMaterial.jkt,
    });
  }

  public async persistCurrentDpopKeyMaterialForAlg(alg: DPoPAlg): Promise<string> {
    if (!this.#dpopKeyMaterial || this.#dpopKeyAlg !== alg) {
      throw new Error("DPoP-bound token response received before DPoP key material was created");
    }

    return await persistDpopKeyMaterial({
      alg,
      privateKey: this.#dpopKeyMaterial.privateKey,
      publicJwk: this.#dpopKeyMaterial.publicJwk,
      jkt: this.#dpopKeyMaterial.jkt,
    });
  }

  public async restoreDpopKeyMaterialByRef(dpopKeyRef: string): Promise<void> {
    const restored = await retrievePersistedDpopKeyMaterial(dpopKeyRef);
    if (!restored) {
      throw new Error("Unable to restore DPoP key material for redirect flow");
    }

    this.#dpopKeyMaterial = {
      privateKey: restored.privateKey,
      publicJwk: restored.publicJwk,
      jkt: restored.jkt,
    };
    this.#dpopKeyAlg = restored.alg;
  }

  public async clearDpopKeyMaterial(dpopKeyRef?: string): Promise<void> {
    this.#dpopKeyMaterial = undefined;
    this.#dpopKeyAlg = undefined;
    if (dpopKeyRef) {
      await cleanupPersistedDpopKeyMaterial(dpopKeyRef);
    }
  }

  public setDpopKeyMaterial(alg: DPoPAlg, keyMaterial: DPoPKeyMaterial): void {
    this.#dpopKeyMaterial = keyMaterial;
    this.#dpopKeyAlg = alg;
  }

  async #getDpopKeyMaterial(alg: DPoPAlg): Promise<DPoPKeyMaterial> {
    if (this.#dpopKeyMaterial && this.#dpopKeyAlg === alg) {
      return this.#dpopKeyMaterial;
    }

    const keyMaterial = await generateDpopKeyMaterial(alg);
    this.#dpopKeyMaterial = keyMaterial;
    this.#dpopKeyAlg = alg;

    return keyMaterial;
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
