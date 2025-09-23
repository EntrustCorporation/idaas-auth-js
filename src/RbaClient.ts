import { decodeJwt } from "jose";
import { AuthenticationTransaction } from "./AuthenticationTransaction";
import type { IdaasContext } from "./IdaasContext";
import type {
  AuthenticationCredential,
  AuthenticationRequestParams,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  TokenOptions,
} from "./models";
import type { StorageManager } from "./storage/StorageManager";
import { calculateEpochExpiry } from "./utils/format";

/**
 * This class handles RBA flows using challenge-response patterns.
 * It manages the authentication transaction lifecycle including challenge requests,
 * response submissions, and asynchronous completion polling.
 *
 * Contains five main methods: requestChallenge, submitChallenge, poll, and cancel.
 */
export class RbaClient {
  private context: IdaasContext;
  private storageManager: StorageManager;
  /** @internal */
  public authenticationTransaction?: AuthenticationTransaction;

  constructor(context: IdaasContext, storageManager: StorageManager) {
    this.context = context;
    this.storageManager = storageManager;
  }

  /**
   * Initiates an authentication challenge request.
   * Prepares a new authentication transaction and requests a challenge from the authentication provider.
   *
   * @param options Optional authentication request parameters
   * @param tokenOptions Optional token parameters for the authentication request
   * @returns The authentication response containing challenge details
   */
  public async requestChallenge(
    options: AuthenticationRequestParams = {},
    tokenOptions?: TokenOptions,
  ): Promise<AuthenticationResponse> {
    // 1. Prepare transaction
    await this.initializeAuthenticationTransaction(options, tokenOptions);

    if (!this.authenticationTransaction) {
      throw new Error("Failed to initialize authentication transaction");
    }

    // 2. Request authentication challenge, return response
    return await this.authenticationTransaction.requestAuthChallenge();
  }

  /**
   * Submits a response to an authentication challenge.
   * Processes authentication responses and completes the authentication if successful.
   *
   * @param options Authentication submission parameters including credentials or response data
   * @returns The authentication response indicating completion status or next steps
   */
  public async submitChallenge(options: AuthenticationSubmissionParams = {}): Promise<AuthenticationResponse> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    if (options.credential) {
      this.authenticationTransaction.submitPasskey(options.credential as AuthenticationCredential);
    }

    const authenticationResponse = await this.authenticationTransaction.submitAuthChallenge({ ...options });

    if (authenticationResponse.authenticationCompleted) {
      this.handleAuthenticationTransactionSuccess();
    }

    return authenticationResponse;
  }

  /**
   * Polls the authentication provider to check for completion of an ongoing authentication process.
   * Useful for authentication flows that may complete asynchronously (e.g., mobile push notifications).
   *
   * @returns The authentication response indicating completion status
   */
  public async poll(): Promise<AuthenticationResponse> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const authenticationResponse = await this.authenticationTransaction.pollForAuthCompletion();

    if (authenticationResponse.authenticationCompleted) {
      this.handleAuthenticationTransactionSuccess();
    }
    return authenticationResponse;
  }

  /**
   * Cancels an ongoing authentication challenge.
   * Terminates the current authentication transaction and cleans up any pending state.
   */
  public async cancel(): Promise<void> {
    if (!this.authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    await this.authenticationTransaction.cancelAuthChallenge();
  }

  // PRIVATE METHODS
  /** @internal */
  public initializeAuthenticationTransaction = async (
    options?: AuthenticationRequestParams,
    tokenOptions?: TokenOptions,
  ) => {
    const oidcConfig = await this.context.getConfig();

    this.authenticationTransaction = new AuthenticationTransaction({
      oidcConfig,
      ...options,
      useRefreshToken: tokenOptions?.useRefreshToken ?? this.context.globalUseRefreshToken,
      audience: tokenOptions?.audience ?? this.context.globalAudience,
      scope: tokenOptions?.scope ?? this.context.globalScope,
      clientId: this.context.clientId,
    });
  };

  /** @internal */
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
