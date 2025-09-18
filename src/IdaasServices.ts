import type { OidcConfig } from "./api";
import type { ValidatedTokenResponse } from "./IdaasClient";
import type { StorageManager } from "./storage/StorageManager";

/**
 * Services interface to provide shared functionality to OIDC and RBA clients
 * without exposing the entire IdaasClient implementation
 */
export interface IdaasServices {
  // Core properties
  /** @internal */
  readonly storageManager: StorageManager;
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly globalScope: string;
  readonly globalAudience: string | undefined;
  readonly globalUseRefreshToken: boolean;

  // Common functionality
  getConfig(): Promise<OidcConfig>;
  parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse): void;
  isAuthenticated(): boolean;
  removeUnusableTokens(): void;
}
