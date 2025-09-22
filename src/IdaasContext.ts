import { decodeJwt } from "jose";
import { AuthenticationTransaction } from "./AuthenticationTransaction";
import { fetchOpenidConfiguration, type OidcConfig } from "./api";
import type { AuthenticationRequestParams, TokenOptions } from "./models";
import type { StorageManager } from "./storage/StorageManager";
import { calculateEpochExpiry } from "./utils/format";

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
  public authenticationTransaction?: AuthenticationTransaction;
  readonly storageManager: StorageManager;
  private config?: OidcConfig;

  constructor({
    issuerUrl,
    clientId,
    globalAudience,
    globalScope,
    globalUseRefreshToken,
    storageManager,
    authenticationTransaction,
  }: {
    issuerUrl: string;
    clientId: string;
    globalAudience?: string;
    globalScope?: string;
    globalUseRefreshToken?: boolean;
    storageManager: StorageManager;
    authenticationTransaction?: AuthenticationTransaction;
  }) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
    this.issuerUrl = issuerUrl;
    this.clientId = clientId;
    this.storageManager = storageManager;
    this.authenticationTransaction = authenticationTransaction;
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

  // PRIVATE METHODS

  public initializeAuthenticationTransaction = async (
    options?: AuthenticationRequestParams,
    tokenOptions?: TokenOptions,
  ) => {
    const oidcConfig = await this.getConfig();

    this.authenticationTransaction = new AuthenticationTransaction({
      oidcConfig,
      ...options,
      useRefreshToken: tokenOptions?.useRefreshToken ?? this.globalUseRefreshToken,
      audience: tokenOptions?.audience ?? this.globalAudience,
      scope: tokenOptions?.scope ?? this.globalScope,
      clientId: this.clientId,
    });
  };

  public handleAuthenticationTransactionSuccess = () => {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const { idToken, accessToken, refreshToken, scope, expiresAt, maxAge, audience } =
      this.authenticationTransaction.getAuthenticationDetails();

    // Require the access token, id token, and necessary claims
    if (!(idToken && accessToken && expiresAt && scope)) {
      throw new Error("Error retrieving tokens from transaction");
    }

    // Saving tokens
    this.storageManager.saveIdToken({
      encoded: idToken,
      decoded: decodeJwt(idToken),
    });
    this.storageManager.saveAccessToken({
      accessToken,
      expiresAt,
      scope,
      refreshToken,
      audience,
      maxAgeExpiry: maxAge ? calculateEpochExpiry(maxAge.toString()) : undefined,
    });

    this.authenticationTransaction = undefined;
  };
}
