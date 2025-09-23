import type { AuthenticationRequestParams, AuthenticationResponse } from "./models";
import type { RbaClient } from "./RbaClient";

/**
 * This class handles authorization for OIDC flows using both popup
 * and redirect authentication patterns. It manages the entire OIDC ceremony
 * including authorization URL generation, token exchange, validation, and processing
 * redirect callbacks.
 *
 * Contains three main methods: login, logout, and handleRedirect.
 */

export class AuthClient {
  private rbaClient: RbaClient;

  constructor(rbaClient: RbaClient) {
    this.rbaClient = rbaClient;
  }

  /**
   * Authenticate a user using password-based authentication.
   * Initiates an authentication transaction with the PASSWORD method and submits the provided password.
   *
   * @param options Authentication request parameters and the password to authenticate with
   * @returns The authentication response indicating success or requiring additional steps
   */
  public async authenticatePassword({
    options,
    password,
  }: {
    options: AuthenticationRequestParams;
    password: string;
  }): Promise<AuthenticationResponse> {
    // 1. Prepare transaction with PASSWORD method
    await this.rbaClient.initializeAuthenticationTransaction({
      ...options,
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    if (!this.rbaClient.authenticationTransaction) {
      throw new Error("Failed to initialize authentication transaction");
    }

    // 2. Request authentication challenge
    await this.rbaClient.authenticationTransaction.requestAuthChallenge();

    // 3. Submit authentication challenge response
    const authResult = await this.rbaClient.authenticationTransaction.submitAuthChallenge({ response: password });

    if (authResult.authenticationCompleted) {
      this.rbaClient.handleAuthenticationTransactionSuccess();
    }

    return authResult;
  }
}
