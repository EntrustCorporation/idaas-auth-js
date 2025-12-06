import { decodeJwt } from "jose";
import { AuthenticationTransaction } from "./AuthenticationTransaction";
import { logoutSilently } from "./api";
import type { IdaasContext } from "./IdaasContext";
import type {
  AuthenticationRequestParams,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  TokenOptions,
} from "./models";
import type { StorageManager } from "./storage/StorageManager";
import { calculateEpochExpiry } from "./utils/format";

/**
 * Risk-Based Authentication (RBA) client for self-hosted authentication flows.
 *
 * This client enables you to build custom authentication UI within your application by handling
 * challenge-response authentication flows. It manages the complete authentication transaction
 * lifecycle: challenge requests, response submissions, asynchronous polling, and cancellation.
 *
 * **Important**: RBA authentication requires your application to be configured with **Resource Rules**
 * in the IDaaS portal. Resource Rules define which authentication methods are required based on
 * contextual risk factors like IP address, device fingerprint, transaction amount, etc.
 *
 * Main methods:
 * - `requestChallenge()`: Initiate authentication and receive a challenge
 * - `submitChallenge()`: Submit user response to the challenge
 * - `poll()`: Check for async completion (e.g., push notifications)
 * - `cancel()`: Cancel an ongoing authentication transaction
 * - `logout()`: End the session and revoke tokens
 *
 * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
 * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/choosing-an-approach.md Choosing an Approach}
 */
export class RbaClient {
  readonly #context: IdaasContext;
  readonly #storageManager: StorageManager;
  #authenticationTransaction?: AuthenticationTransaction;

  constructor(context: IdaasContext, storageManager: StorageManager) {
    this.#context = context;
    this.#storageManager = storageManager;
  }

  /**
   * Initiates a risk-based authentication challenge based on configured Resource Rules.
   *
   * This method starts an authentication transaction by sending contextual information to the
   * identity provider, which evaluates risk and returns an appropriate authentication challenge
   * based on your configured Resource Rules.
   *
   * **Key features:**
   * - Automatic risk evaluation based on transaction details (IP address, device, transaction amount, etc.)
   * - Dynamic authentication method selection (password, OTP, push, biometric, etc.)
   * - Support for step-up authentication scenarios
   *
   * The response indicates:
   * - Which authentication method is required
   * - Whether the method requires user interaction (`pollForCompletion: false`) or is asynchronous (`pollForCompletion: true`)
   * - Challenge details (e.g., grid coordinates, KBA questions, FIDO options)
   *
   * @param options Authentication request parameters including userId and transactionDetails
   * @param tokenOptions Token request options (audience, scope, ACR values)
   * @returns Authentication response containing the challenge and method details
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public async requestChallenge(
    options: AuthenticationRequestParams = {},
    tokenOptions?: TokenOptions,
  ): Promise<AuthenticationResponse> {
    // 1. Prepare transaction
    await this.#initializeAuthenticationTransaction(options, tokenOptions);

    if (!this.#authenticationTransaction) {
      throw new Error("Failed to initialize authentication transaction");
    }

    // 2. Request authentication challenge, return response
    return await this.#authenticationTransaction.requestAuthChallenge();
  }

  /**
   * Submits the user's response to an authentication challenge.
   *
   * After receiving a challenge from `requestChallenge()`, use this method to submit the user's
   * authentication response (e.g., password, OTP code, grid coordinates, KBA answers).
   *
   * The response indicates whether:
   * - Authentication completed successfully (`authenticationCompleted: true`)
   * - Additional authentication is required (step-up scenario)
   * - Authentication failed
   *
   * Upon successful completion, tokens are automatically stored and can be retrieved via
   * `getAccessToken()` and `getIdTokenClaims()`.
   *
   * @param options Authentication submission parameters with the user's response data
   * @returns Authentication response indicating completion status or next challenge
   * @throws {Error} If no authentication transaction is in progress
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public async submitChallenge(options: AuthenticationSubmissionParams = {}): Promise<AuthenticationResponse> {
    if (!this.#authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const authenticationResponse = await this.#authenticationTransaction.submitAuthChallenge({ ...options });
    this.#storageManager.saveIdaasSessionToken({ token: authenticationResponse.token || "" });

    if (authenticationResponse.authenticationCompleted) {
      this.#handleAuthenticationTransactionSuccess();
    }

    return authenticationResponse;
  }

  /**
   * Logs the user out and terminates their session.
   *
   * This method:
   * 1. Revokes the session token with the identity provider (server-side logout)
   * 2. Clears all stored tokens (access, ID, and refresh) from local storage
   * 3. Resets the current authentication transaction
   *
   * After logout, the user must authenticate again via `requestChallenge()`.
   *
   * **Note**: Unlike OIDC logout, this method does not redirect the browser.
   * It completes silently and returns a Promise.
   *
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public async logout(): Promise<void> {
    const baseUrl = new URL(this.#context.issuerUrl).origin;
    const token = this.#storageManager.getIdaasSessionToken()?.token;

    if (token) {
      await logoutSilently(token, baseUrl);
    }

    this.#storageManager.remove();
  }

  /**
   * Polls for completion of an asynchronous authentication flow.
   *
   * Some authentication methods complete asynchronously without requiring `submitChallenge()`:
   * - Push notifications (user approves on mobile device)
   * - Email magic links (user clicks link in email)
   * - SMS magic links (user clicks link in SMS)
   *
   * When `pollForCompletion: true` in the challenge response, call this method repeatedly
   * (e.g., every 2-3 seconds) to check if the user has completed authentication on their device.
   *
   * **Polling behavior:**
   * - Returns `authenticationCompleted: false` while waiting for user action
   * - Returns `authenticationCompleted: true` when authentication succeeds
   * - Automatically stores tokens upon successful completion
   *
   * @returns Authentication response indicating completion status
   * @throws {Error} If no authentication transaction is in progress
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public async poll(): Promise<AuthenticationResponse> {
    if (!this.#authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const authenticationResponse = await this.#authenticationTransaction.pollForAuthCompletion();

    if (authenticationResponse.authenticationCompleted) {
      this.#handleAuthenticationTransactionSuccess();
    }
    return authenticationResponse;
  }

  /**
   * Cancels the current authentication transaction.
   *
   * Use this method to abandon an in-progress authentication flow, for example:
   * - User clicks "Cancel" button during authentication
   * - User navigates away from authentication page
   * - Authentication timeout occurs
   *
   * This terminates the transaction server-side and cleans up any pending state.
   * After cancellation, you must call `requestChallenge()` again to start a new authentication flow.
   *
   * @throws {Error} If no authentication transaction is in progress
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public async cancel(): Promise<void> {
    if (!this.#authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    await this.#authenticationTransaction.cancelAuthChallenge();
  }

  #initializeAuthenticationTransaction = async (
    authenticationRequestParams?: AuthenticationRequestParams,
    tokenOptions?: TokenOptions,
  ) => {
    const oidcConfig = await this.#context.getConfig();

    this.#authenticationTransaction = new AuthenticationTransaction({
      oidcConfig,
      authenticationRequestParams,
      tokenOptions: {
        audience: tokenOptions?.audience ?? this.#context.tokenOptions.audience,
        scope: tokenOptions?.scope ?? this.#context.tokenOptions.scope,
        acrValues: tokenOptions?.acrValues,
        useRefreshToken: tokenOptions?.useRefreshToken ?? this.#context.tokenOptions.useRefreshToken,
        maxAge: tokenOptions?.maxAge ?? this.#context.tokenOptions.maxAge,
      },
      clientId: this.#context.clientId,
    });
  };

  #handleAuthenticationTransactionSuccess = () => {
    if (!this.#authenticationTransaction) {
      throw new Error("No authentication transaction in progress!");
    }

    const { idToken, accessToken, refreshToken, scope, expiresAt, maxAge, audience } =
      this.#authenticationTransaction.getAuthenticationDetails();

    // Require the access token, id token, and necessary claims
    if (!(idToken && accessToken && expiresAt && scope)) {
      throw new Error("Error retrieving tokens from transaction");
    }

    // Saving tokens
    this.#storageManager.saveIdToken({
      encoded: idToken,
      decoded: decodeJwt(idToken),
    });
    this.#storageManager.saveAccessToken({
      accessToken,
      expiresAt,
      scope,
      refreshToken,
      audience,
      maxAgeExpiry: maxAge ? calculateEpochExpiry(maxAge.toString()) : undefined,
    });

    this.#authenticationTransaction = undefined;
  };
}
