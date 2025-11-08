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
import { browserSupportsPasskey } from "./utils/browser";

/**
 * Convenience authentication client for fixed authentication methods.
 *
 * This client provides simplified methods for specific authentication types (password, OTP, passkey, etc.)
 * when you want to bypass risk-based evaluation and use a specific authentication method directly.
 *
 * **Use cases:**
 * - Login pages with traditional username/password forms
 * - Passwordless authentication flows with a specific method (e.g., passkey-only)
 * - Applications that don't require dynamic authentication based on context
 *
 * **When to use this vs RbaClient:**
 * - Use `AuthClient` when you know which authentication method you want to use
 * - Use `RbaClient` when you want the identity provider to dynamically select authentication
 *   methods based on risk and Resource Rules
 *
 * Under the hood, these methods use `RbaClient` with `strict: true` and a specified
 * `preferredAuthenticationMethod` to force a specific authentication method.
 *
 * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md Convenience Auth Guide}
 * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/choosing-an-approach.md Choosing an Approach}
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
   * Authenticates a user with username and password.
   *
   * This method bypasses risk-based evaluation and directly requests password authentication.
   * It's ideal for traditional login forms where you want a consistent password-based experience.
   *
   * The method automatically:
   * 1. Requests a PASSWORD challenge from the identity provider
   * 2. Submits the provided password
   * 3. Stores tokens upon successful authentication
   *
   * **When to use:**
   * - Traditional login pages with username/password fields
   * - Applications that require password authentication for specific workflows
   * - Testing and development scenarios
   *
   * @param userId The user's unique identifier (email, username, etc.)
   * @param password The user's password
   * @returns Authentication response with `authenticationCompleted: true` on success
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md Convenience Auth Guide}
   */
  public async password(userId: string, password: string): Promise<AuthenticationResponse> {
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
   * **Mutual Challenge**: When enabled, the user must verify a challenge code displayed on the authentication device
   * to protect against push bombing attacks (where attackers spam push notifications hoping the user accidentally approves).
   * The `mutualChallenge` option is ignored unless `push` is true.
   *
   *
   * @param userId The user ID to authenticate.
   * @param options Soft token authentication options
   * @param options.push Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
   * @param options.mutualChallenge Enables mutual challenge for push. Only valid if push is true. Default false.
   * @returns AuthenticationResponse:
   *   - Final result (success/failure) for plain TOKENPUSH (no mutual challenge).
   *   - Initial challenge response for TOKENPUSH with mutual challenge (requires poll).
   *   - Initial challenge response for TOKEN (requires submitChallenge with OTP).
   * @throws On request/poll errors.
   */
  public async softToken(
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
        softTokenPushOptions: { mutualChallenge: true },
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
  public async grid(userId: string): Promise<AuthenticationResponse> {
    return await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "GRID",
    });
  }

  /**
   * Authenticates a user with a passkey (WebAuthn/FIDO2).
   *
   * Supports two modes:
   * - **With userId**: Uses FIDO authentication (user must have registered a passkey)
   * - **Without userId**: Uses usernameless/discoverable credential (PASSKEY)
   *
   * This method handles the complete passkey flow:
   * 1. Requests an appropriate challenge (FIDO or PASSKEY)
   * 2. Invokes the browser's passkey UI (`navigator.credentials.get()`)
   * 3. Submits the WebAuthn credential automatically
   * 4. Stores tokens upon successful authentication
   *
   * **Browser support:**
   * Requires a browser with WebAuthn support. The method checks for support automatically
   * and throws an error if passkeys are not available.
   *
   * **When to use:**
   * - Passwordless authentication flows
   * - Security key authentication
   * - Biometric authentication (Face ID, Touch ID, Windows Hello)
   *
   * @param userId Optional user identifier (omit for usernameless authentication)
   * @returns Authentication response with `authenticationCompleted: true` on success
   * @throws {Error} If browser doesn't support passkeys
   * @throws {Error} If user cancels the passkey ceremony
   * @throws {Error} If no credential is returned
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md Convenience Auth Guide}
   */
  public async passkey(userId?: string): Promise<AuthenticationResponse | undefined> {
    const browserSupported = await browserSupportsPasskey();
    if (!browserSupported) {
      throw new Error("This browser does not support passkey");
    }
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
  public async kba(userId: string): Promise<AuthenticationResponse> {
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
  public async tempAccessCode(userId: string, tempAccessCode: string): Promise<AuthenticationResponse> {
    await this.rbaClient.requestChallenge({
      userId,
      strict: true,
      preferredAuthenticationMethod: "TEMP_ACCESS_CODE",
    });

    return await this.rbaClient.submitChallenge({ response: tempAccessCode });
  }

  /**
   * Requests an One-Time Password (OTP) to be sent to the user.
   *
   * This method initiates OTP authentication by requesting a time-based code to be delivered
   * to the user via their configured delivery method (SMS, email, or voice call).
   *
   * After calling this method, prompt the user to enter the OTP they received, then call
   * `idaasClient.auth.submit({ response: '123456' })` to complete authentication.
   *
   * **Delivery options:**
   * - **SMS**: Code sent via text message (default for most configurations)
   * - **EMAIL**: Code sent via email
   * - **VOICE**: Code delivered via automated phone call
   *
   * You can optionally specify a delivery type and/or attribute to override the user's default.
   *
   * **When to use:**
   * - Two-factor authentication (2FA) scenarios
   * - Passwordless authentication with OTP
   * - Account verification flows
   *
   * @param userId The user's unique identifier
   * @param options OTP delivery configuration (type and attribute)
   * @returns Authentication response containing the challenge (requires submission)
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md Convenience Auth Guide}
   */
  public async otp(
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
  public async magicLink(userId: string): Promise<AuthenticationResponse> {
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
   * @param options Smart credential authentication options
   * @param options.summary The summary to display in the push notification.
   * @param options.pushMessageIdentifier The identifier to retrieve customized SDK push message configuration.
   * @returns AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
   */
  public async smartCredential(
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
  public async faceBiometric(
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
          onError: (error: Error) => {
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
   * @param params Authentication submission parameters
   * @param params.response The user's response to the authentication challenge.
   * @param params.passkeyResponse The publicKeyCredential returned from navigator.credentials.get(credentialRequestOptions).
   * @param params.kbaChallengeAnswers The user's answers to the KBA challenge questions. Answers must be in the order of the questions returned when requesting the challenge.
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

  public async logout(): Promise<void> {
    return await this.rbaClient.logout();
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
