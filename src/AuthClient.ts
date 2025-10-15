import type { AuthenticationRequestParams, AuthenticationResponse, AuthenticationSubmissionParams } from "./models";
import type { RbaClient } from "./RbaClient";

/** Options for soft token authentication */
interface SoftTokenOptions {
  /**
   * The user ID of the user to authenticate.
   * */
  userId: string;
  /**
   * Indicates if a push notification should be sent. Defaults false.
   * */
  push?: boolean;
  /**
   * Enables mutual challenge for push. Only valid when push === true.
   * If true while push is false, the flag is ignored.
   * Default: false.
   */
  mutualChallenge?: boolean;
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
   * @param options Authentication request parameters and the password to authenticate with.
   * @returns The authentication response indicating success or requiring additional steps.
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

  /**
   * Authenticate a user using soft token authentication.
   * Initiates an authentication transaction with the TOKEN/TOKENPUSH method and submits the provided token.
   *
   * @param options Authentication request parameters and the token to authenticate with.
   * @returns The authentication response indicating success or requiring additional steps.
   */
  public async authenticateSoftToken({
    userId,
    mutualChallenge = false,
    push = false,
  }: SoftTokenOptions): Promise<AuthenticationResponse> {
    if (push && !mutualChallenge) {
      await this.rbaClient.requestChallenge({
        userId: userId,
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      });

      return await this.rbaClient.poll();
    }

    if (push && mutualChallenge) {
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

  public async authenticateGrid(userId: string): Promise<AuthenticationResponse> {
    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "GRID",
    });
  }

  public async submit({
    response,
    credential,
    kbaChallengeAnswers,
  }: AuthenticationSubmissionParams): Promise<AuthenticationResponse> {
    return await this.rbaClient.submitChallenge({ response, credential, kbaChallengeAnswers });
  }

  public async poll(): Promise<AuthenticationResponse> {
    return await this.rbaClient.poll();
  }

  public async cancel(): Promise<void> {
    return await this.rbaClient.cancel();
  }
}
