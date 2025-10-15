import type { AuthenticationRequestParams, AuthenticationResponse } from "./models";
import type { RbaClient } from "./RbaClient";

/** Options for soft token authentication */
interface SoftTokenOptions {
  userId: string;
  /** Indicates if push notifications are enabled for the soft token. Defaults false */
  pushNotification?: boolean;
  /** Indicates if mutual challenge is enabled for push notifications if true must set pushNotifications to true. Defaults false */
  mutualChallengeEnabled?: boolean;
}

/**
 * This class handles convenience authorization methods such as password-based authentication.
 *
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
    await this.rbaClient.requestChallenge({
      ...options,
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    const authResult = await this.rbaClient.submitChallenge({ response: password });
    return authResult;
  }

  public async authenticateSoftToken({
    userId,
    mutualChallengeEnabled = false,
    pushNotification = false,
  }: SoftTokenOptions): Promise<AuthenticationResponse> {
    if (pushNotification && !mutualChallengeEnabled) {
      await this.rbaClient.requestChallenge({
        userId: userId,
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      });

      return await this.rbaClient.poll();
    }

    if (pushNotification && mutualChallengeEnabled) {
      return await this.rbaClient.requestChallenge({
        userId: userId,
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
        tokenPushOptions: { mutualChallengeEnabled: true },
      });
    }

    return await this.rbaClient.requestChallenge({
      userId: userId,
      strict: true,
      preferredAuthenticationMethod: "TOKEN",
    });
  }
}
