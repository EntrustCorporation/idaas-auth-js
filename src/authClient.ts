import type { IdaasContext } from "./IdaasContext";
import type { AuthenticationRequestParams, AuthenticationResponse } from "./models";

/**
 * This class handles authorization for OIDC flows using both popup
 * and redirect authentication patterns. It manages the entire OIDC ceremony
 * including authorization URL generation, token exchange, validation, and processing
 * redirect callbacks.
 *
 * Contains three main methods: login, logout, and handleRedirect.
 */

export class AuthClient {
  private context: IdaasContext;

  constructor(context: IdaasContext) {
    this.context = context;
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
    await this.context.initializeAuthenticationTransaction({
      ...options,
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    if (!this.context.authenticationTransaction) {
      throw new Error("Failed to initialize authentication transaction");
    }

    // 2. Request authentication challenge
    await this.context.authenticationTransaction.requestAuthChallenge();

    // 3. Submit authentication challenge response
    const authResult = await this.context.authenticationTransaction.submitAuthChallenge({ response: password });

    if (authResult.authenticationCompleted) {
      this.context.handleAuthenticationTransactionSuccess();
    }

    return authResult;
  }
}
