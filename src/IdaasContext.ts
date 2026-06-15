import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { TokenOptions } from "./models";
import { type DPoPAlg, type DPoPKeyMaterial, generateDpopKeyMaterial, generateDpopProofJwt } from "./utils/dpop";
import { cleanupPersistedDpopKeyMaterialBestEffort } from "./utils/dpopCleanup";
import { persistDpopKeyMaterial, retrievePersistedDpopKeyMaterial } from "./utils/dpopKeyStore";

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
  readonly #dpopKeyMaterialByAlg = new Map<DPoPAlg, DPoPKeyMaterial>();

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

  public async createDpopProofForKeyRef({
    method,
    uri,
    dpopKeyRef,
    accessToken,
  }: {
    method: string;
    uri: string;
    dpopKeyRef: string;
    accessToken?: string;
  }): Promise<string> {
    const keyMaterial = await retrievePersistedDpopKeyMaterial(dpopKeyRef);
    if (!keyMaterial) {
      throw new Error("Unable to restore DPoP key material");
    }

    return await generateDpopProofJwt({
      alg: keyMaterial.alg,
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
    const keyMaterial = this.#dpopKeyMaterialByAlg.get(alg);
    if (!keyMaterial) {
      throw new Error("DPoP-bound token response received before DPoP key material was created");
    }

    return await persistDpopKeyMaterial({
      alg,
      privateKey: keyMaterial.privateKey,
      publicJwk: keyMaterial.publicJwk,
      jkt: keyMaterial.jkt,
    });
  }

  public async restoreDpopKeyMaterialByRef(dpopKeyRef: string): Promise<DPoPAlg> {
    const restored = await retrievePersistedDpopKeyMaterial(dpopKeyRef);
    if (!restored) {
      throw new Error("Unable to restore DPoP key material");
    }

    this.#dpopKeyMaterialByAlg.set(restored.alg, {
      privateKey: restored.privateKey,
      publicJwk: restored.publicJwk,
      jkt: restored.jkt,
    });

    return restored.alg;
  }

  public async clearDpopKeyMaterial(dpopKeyRef?: string): Promise<void> {
    this.#dpopKeyMaterialByAlg.clear();
    await cleanupPersistedDpopKeyMaterialBestEffort(dpopKeyRef);
  }

  public setDpopKeyMaterial(alg: DPoPAlg, keyMaterial: DPoPKeyMaterial): void {
    this.#dpopKeyMaterialByAlg.set(alg, keyMaterial);
  }

  async #getDpopKeyMaterial(alg: DPoPAlg): Promise<DPoPKeyMaterial> {
    const cachedKeyMaterial = this.#dpopKeyMaterialByAlg.get(alg);
    if (cachedKeyMaterial) {
      return cachedKeyMaterial;
    }

    const keyMaterial = await generateDpopKeyMaterial(alg);
    this.#dpopKeyMaterialByAlg.set(alg, keyMaterial);

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
