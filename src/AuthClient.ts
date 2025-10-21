import type { AuthenticationRequestParams, AuthenticationResponse, AuthenticationSubmissionParams } from "./models";
import type { RbaClient } from "./RbaClient";

/**
 * Options for soft token authentication
 */
interface SoftTokenOptions {
  /**
   * The user ID of the user to authenticate.
   */
  userId: string;

  /**
   * Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
   */
  push?: boolean;

  /**
   * Enables mutual challenge for push. Only valid if push is true. Default false.
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
   * Authenticate using Entrust Soft Token.
   *
   * Modes:
   * - push === false: Issues a TOKEN challenge (OTP). Caller must later call submitChallenge with the user’s code.
   * - push === true && mutualChallenge === false: Starts a TOKENPUSH challenge and immediately polls until completion; returns the final AuthenticationResponse.
   * - push === true && mutualChallenge === true: Starts a TOKENPUSH challenge with mutual challenge enabled; returns the initial response containing the mutual challenge. Caller must then call poll() to await completion.
   *
   * mutualChallenge is ignored unless push is true.
   *
   * @param userId The user to authenticate.
   * @param push Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
   * @param mutualChallenge Enables mutual challenge for push. Only valid if push is true. Default false.
   * @returns AuthenticationResponse:
   *   - Final result (success/failure) for plain TOKENPUSH (no mutual challenge).
   *   - Initial challenge response for TOKENPUSH with mutual challenge (requires poll).
   *   - Initial challenge response for TOKEN (requires submitChallenge with OTP).
   * @throws On request/poll errors.
   */
  public async authenticateSoftToken({
    userId,
    mutualChallenge = false,
    push = false,
  }: SoftTokenOptions): Promise<AuthenticationResponse> {
    if (push && !mutualChallenge) {
      await this.rbaClient.requestChallenge({
        userId,
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      });

      return await this.rbaClient.poll();
    }

    if (push && mutualChallenge) {
      return await this.rbaClient.requestChallenge({
        userId,
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
        tokenPushOptions: { mutualChallengeEnabled: true },
      });
    }

    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "TOKEN",
    });
  }

  /**
   * Authenticate a user using grid authentication.
   * Initiates an authentication transaction with the GRID method.
   *
   * @param userId The user ID of the user to authenticate.
   * @returns The authentication response containing the grid challenge.
   */
  public async authenticateGrid(userId: string): Promise<AuthenticationResponse> {
    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "GRID",
    });
  }

  /**
   * Authenticate using a passkey (WebAuthn).
   *
   * Modes:
   * - userId provided: Uses FIDO (targets that user’s credential).
   * - userId omitted: Uses PASSKEY (usernameless / discoverable credential).
   *
   * Flow:
   * 1. Requests a challenge with the appropriate method.
   * 2. If WebAuthn request options are returned, invokes navigator.credentials.get().
   * 3. Submits the credential automatically.
   *
   * @param userId Optional user identifier.
   * @returns AuthenticationResponse on success.
   * @throws On unexpected WebAuthn (navigator.credentials.get) errors or if user cancels passkey ceremony.
   */
  public async authenticatePasskey(userId?: string): Promise<AuthenticationResponse | undefined> {
    const authenticationRequestParams: AuthenticationRequestParams = {
      strict: true,
      preferredAuthenticationMethod: userId ? "FIDO" : "PASSKEY",
      userId,
    };

    const response = await this.rbaClient.requestChallenge(authenticationRequestParams);

    if (response.publicKeyCredentialRequestOptions) {
        const publicKeyCredential = await window.navigator.credentials.get({
          publicKey: response.publicKeyCredentialRequestOptions,
        });

        if (publicKeyCredential && publicKeyCredential instanceof PublicKeyCredential) {
          return await this.rbaClient.submitChallenge({ passkeyResponse: publicKeyCredential });
        }
        throw new Error("No credential was returned.");
    }
    throw new Error("No publicKeyCredentialRequestOptions returned for passkey authentication.");
  }

  /**
   * Submits a response to an authentication challenge.
   * Processes authentication responses and completes the authentication if successful.
   * @param response The user's response to the authentication challenge.
   * @param publicKeyCredential The publicKeyCredential returned from navigator.credentials.get(credentialRequestOptions).
   * @param kbaChallengeAnswers The user's answers to the KBA challenge questions. Answers must be in the order of the questions returned when requesting the challenge.
   * @returns The authentication response indicating completion status or next steps
   */
  public async submit({
    response,
    passkeyResponse: publicKeyCredential,
    kbaChallengeAnswers,
  }: AuthenticationSubmissionParams): Promise<AuthenticationResponse> {
    return await this.rbaClient.submitChallenge({ response, passkeyResponse: publicKeyCredential, kbaChallengeAnswers });
  }

  /**
   * Polls the authentication provider to check for completion of an ongoing authentication process.
   * Useful for authentication flows that may complete asynchronously (e.g., token push authentication).
   *
   * @returns The authentication response indicating completion status
   */
  public async poll(): Promise<AuthenticationResponse> {
    return await this.rbaClient.poll();
  }

  /**
   * Cancels an ongoing authentication challenge.
   * Terminates the current authentication transaction and cleans up any pending state.
   */
  public async cancel(): Promise<void> {
    return await this.rbaClient.cancel();
  }
}
