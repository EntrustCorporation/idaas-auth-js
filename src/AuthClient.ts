import type {
  AuthenticationRequestParams,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  FaceBiometricOptions,
  OtpOptions,
  SmartCredentialOptions,
  SoftTokenOptions,
} from "./models";
import type { RbaClient } from "./RbaClient";

/**
 * This class handles convenience authorization methods such as password-based authentication.
 *
 */
export class AuthClient {
  private rbaClient: RbaClient;

  constructor(rbaClient: RbaClient) {
    this.rbaClient = rbaClient;
  }

  private async importOnfidoSdk() {
    try {
      const { Onfido } = await import("onfido-sdk-ui");
      return Onfido;
    } catch (error) {
      console.error(
        "Failed to import onfido-sdk-ui. Ensure the package is installed as it is required for face authentication.",
        error,
      );
      throw error;
    }
  }

  /**
   * Authenticate a user using password-based authentication.
   * Initiates an authentication transaction with the PASSWORD method and submits the provided password.
   *
   * @param userId The user ID to authenticate.
   * @param password The user's password.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async authenticatePassword(userId: string, password: string): Promise<AuthenticationResponse> {
    await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    const authResult = await this.rbaClient.submitChallenge({
      response: password,
    });
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
   * @param userId The user ID to authenticate.
   * @param push Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
   * @param mutualChallenge Enables mutual challenge for push. Only valid if push is true. Default false.
   * @returns AuthenticationResponse:
   *   - Final result (success/failure) for plain TOKENPUSH (no mutual challenge).
   *   - Initial challenge response for TOKENPUSH with mutual challenge (requires poll).
   *   - Initial challenge response for TOKEN (requires submitChallenge with OTP).
   * @throws On request/poll errors.
   */
  public async authenticateSoftToken(
    userId: string,
    { mutualChallenge, push }: SoftTokenOptions = {},
  ): Promise<AuthenticationResponse> {
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
        softTokenOptions: { mutualChallenge: true },
      });
    }

    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "TOKEN",
    });
  }

  /**
   * Starts a GRID challenge.
   * Response includes gridChallenge.challenge: [{ row: 0, column: 1 }, ...] (one entry per required cell).
   * Prompt the user for the contents of the cell at each coordinate (in order) to build the code, then call the submit method with their code (e.g idaasClient.auth.submit({ response: 'A6N3D5' })).
   *
   * @param userId The user ID to authenticate.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the gridChallenge to display to the user.
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
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   * @throws On unexpected WebAuthn (navigator.credentials.get) errors or if user cancels passkey ceremony.
   */
  public async authenticatePasskey(userId?: string): Promise<AuthenticationResponse | undefined> {
    const authenticationRequestParams: AuthenticationRequestParams = {
      strict: true,
      preferredAuthenticationMethod: userId ? "FIDO" : "PASSKEY",
      userId,
    };

    const response = await this.rbaClient.requestChallenge(authenticationRequestParams);

    if (response.passkeyChallenge) {
      const publicKeyCredential = await window.navigator.credentials.get({
        publicKey: response.passkeyChallenge,
      });

      if (publicKeyCredential && publicKeyCredential instanceof PublicKeyCredential) {
        return await this.rbaClient.submitChallenge({
          passkeyResponse: publicKeyCredential,
        });
      }
      throw new Error("No credential was returned.");
    }
    throw new Error("No publicKeyCredentialRequestOptions returned for passkey authentication.");
  }

  /**
   * Starts a KBA (knowledge-based) challenge.
   * Response includes kbaChallenge.userQuestions: [{ question: string }, ...].
   * Gather answers and call submit({ kbaChallengeAnswers: ['answer1', 'answer2', ...]}).
   * Order of answers must match order of questions received.
   *
   * @param userId The user ID to authenticate.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the KBA challenge questions to display to the user.
   */
  public async authenticateKba(userId: string): Promise<AuthenticationResponse> {
    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "KBA",
    });
  }

  /**
   * Authenticate using a temporary access code.
   * Requests a TEMP_ACCESS_CODE challenge, then immediately submits the provided code.
   *
   * @param userId The user ID to authenticate.
   * @param tempAccessCode The temporary access code to submit.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async authenticateTempAccessCode(userId: string, tempAccessCode: string): Promise<AuthenticationResponse> {
    await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "TEMP_ACCESS_CODE",
    });

    return await this.rbaClient.submitChallenge({ response: tempAccessCode });
  }

  /**
   * Starts an OTP challenge.
   * Requests an OTP challenge with optional delivery type.
   * Prompt the user for the OTP that was delivered to them, then call the submit method with their OTP (e.g idaasClient.auth.submit({ response: '123456' })).
   *
   * @param userId The user ID to authenticate.
   * @param otpDeliveryType The delivery type for the OTP (e.g., "SMS", "EMAIL", "VOICE"). If not set will use the default delivery method.
   * @param otpDeliveryAttribute The delivery attribute for the OTP (e.g., "business-email"). If not set will use the default delivery attribute.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async authenticateOtp(
    userId: string,
    { otpDeliveryType, otpDeliveryAttribute }: OtpOptions = {},
  ): Promise<AuthenticationResponse> {
    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "OTP",
      otpOptions: { otpDeliveryAttribute, otpDeliveryType },
    });
  }

  /**
   * Authenticate using Magic Link.
   * Requests a MAGICLINK challenge, then immediately starts polling for completion.
   *
   * @param userId The user ID to authenticate.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async authenticateMagiclink(userId: string): Promise<AuthenticationResponse> {
    await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "MAGICLINK",
    });

    return await this.rbaClient.poll();
  }

  /**
   * Authenticate using Smart Credential Push.
   * Requests a SMARTCREDENTIALPUSH challenge, then immediately starts polling for completion.
   *
   * @param userId The user ID to authenticate.
   * @param summary The summary to display in the push notification.
   * @param pushMessageIdentifier The identifier to retrieve customized SDK push message configuration.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async authenticateSmartCredential(
    userId: string,
    { summary, pushMessageIdentifier }: SmartCredentialOptions = {},
  ): Promise<AuthenticationResponse> {
    await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "SMARTCREDENTIALPUSH",
      smartCredentialOptions: {
        summary,
        pushMessageIdentifier,
      },
    });

    return await this.rbaClient.poll();
  }

  /**
   * Authenticate using Face.
   * Requests a FACE challenge, then initializes the Onfido Web SDK and polls for completion on onComplete.
   *
   * Requirements:
   * - Optional peer dependency: Install 'onfido-sdk-ui' to use this method:
   *     npm install onfido-sdk-ui
   *   (It is declared as an optional peer dependency; projects not using face auth can omit it.)
   * - DOM container: Ensure a <div id="onfido-mount"></div> exists in the DOM before calling. The SDK mounts its UI there.
   *
   * Flow:
   * 1. requestChallenge(FACE) returns faceChallenge with sdkToken and workflowRunId.
   * 2. Onfido.init is called with those values and containerId 'onfido-mount'.
   * 3. On onComplete the method polls for final authentication status and resolves with the AuthenticationResponse.
   *
   * @param userId The user ID to authenticate.
   * @param mutualChallenge Determines if the user must answer a mutual challenge for and FACE authenticator.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   * @throws If faceChallenge is missing, Onfido initialization fails, or polling fails.
   */
  public async authenticateFace(
    userId: string,
    { mutualChallenge }: FaceBiometricOptions = {},
  ): Promise<AuthenticationResponse> {
    const challengeResponse = await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "FACE",
      faceBiometricOptions: { mutualChallenge: mutualChallenge },
    });

    if (!challengeResponse.faceChallenge) {
      throw new Error("Face challenge data is missing in the authentication response.");
    }

    if (challengeResponse.faceChallenge.device !== "WEB") {
      return mutualChallenge ? challengeResponse : await this.rbaClient.poll();
    }

    const Onfido = await this.importOnfidoSdk();

    const authenticationResponse = await new Promise<AuthenticationResponse>((resolve, reject) => {
      try {
        const instance = Onfido.init({
          token: challengeResponse.faceChallenge?.sdkToken,
          workflowRunId: challengeResponse.faceChallenge?.workflowRunId,
          containerId: "onfido-mount",
          onComplete: async () => {
            const authenticationPollResponse = await this.rbaClient.poll();
            resolve(authenticationPollResponse);
            instance.tearDown();
          },
          onError: (error) => {
            reject(error);
          },
        });
      } catch (e) {
        reject(e);
      }
    });
    return authenticationResponse;
  }

  /**
   * Submits a response to an authentication challenge.
   * Processes authentication responses and completes the authentication if successful.
   * @param response The user's response to the authentication challenge.
   * @param passkeyResponse The publicKeyCredential returned from navigator.credentials.get(credentialRequestOptions).
   * @param kbaChallengeAnswers The user's answers to the KBA challenge questions. Answers must be in the order of the questions returned when requesting the challenge.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async submit({
    response,
    passkeyResponse,
    kbaChallengeAnswers,
  }: AuthenticationSubmissionParams): Promise<AuthenticationResponse> {
    return await this.rbaClient.submitChallenge({
      response,
      passkeyResponse,
      kbaChallengeAnswers,
    });
  }

  /**
   * Polls the authentication provider to check for completion of an ongoing authentication process.
   * Useful for authentication flows that may complete asynchronously (e.g., token push authentication).
   *
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
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
