import {
  getAuthRequestId,
  type JwtIdaasTokenRequest,
  type OidcConfig,
  queryUserAuthOptions,
  requestAuthChallenge,
  requestToken,
  submitAuthChallenge,
} from "./api";
import { generateAuthorizationUrl } from "./helpers/url";
import type {
  AuthenticationCredential,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  AuthenticationTransactionOptions,
  FaceBiometricOptions,
  IdaasAuthenticationMethod,
  PublicKeyCredentialRequestOptionsJSON,
  TokenOptions,
  TokenPushOptions,
} from "./models";
import type {
  AuthenticatedResponse,
  FaceChallenge,
  FidoChallenge,
  FidoResponse,
  KbaChallenge,
  TransactionDetail,
  UserAuthenticateParameters,
  UserAuthenticateQueryResponse,
  UserChallengeParameters,
} from "./models/openapi-ts";
import { browserSupportsPasskey } from "./utils/browser";
import {
  base64URLStringToBuffer,
  bufferToBase64URLString,
  calculateEpochExpiry,
  toPublicKeyCredentialDescriptor,
} from "./utils/format";

export interface AuthenticationDetails {
  method?: IdaasAuthenticationMethod;
  secondFactor?: IdaasAuthenticationMethod;
  scope?: string;
  expiresAt?: number;
  idToken?: string;
  refreshToken?: string;
  accessToken?: string;
  audience?: string;
  maxAge?: number;
}

interface RequiredDetails {
  authRequestKey: string;
  applicationId: string;
  codeVerifier: string;
}

export class AuthenticationTransaction {
  private readonly clientId: string;
  private readonly issuerOrigin: string;
  private readonly faceBiometricOptions: FaceBiometricOptions;
  private readonly tokenPushOptions: TokenPushOptions;
  private readonly oidcConfig: OidcConfig;
  private readonly strict: boolean;
  private readonly useRefreshToken: boolean;
  private readonly userId: string;

  private readonly audience?: string;
  private readonly maxAge?: number;
  private readonly preferredAuthenticationMethod?: IdaasAuthenticationMethod;
  private readonly transactionDetails?: TransactionDetail[];
  private readonly acrValues?: string[];
  private readonly password?: string;
  private authenticationDetails: AuthenticationDetails;
  private continuePolling = false;
  private isSecondFactor = false;

  private faceChallenge?: FaceChallenge;
  private fidoChallenge?: FidoChallenge;
  private fidoResponse?: FidoResponse;
  private kbaChallenge?: KbaChallenge;
  private publicKeyCredentialRequestOptions?: PublicKeyCredentialRequestOptions;
  private requiredDetails?: RequiredDetails;
  private token?: string;
  private abortController?: AbortController;

  constructor({
    oidcConfig,
    userId,
    scope,
    useRefreshToken,
    clientId,
    preferredAuthenticationMethod,
    strict,
    faceBiometricOptions,
    tokenPushOptions,
    password,
    audience,
    maxAge,
    transactionDetails,
    acrValues,
  }: AuthenticationTransactionOptions & TokenOptions) {
    const { issuer } = oidcConfig;

    this.authenticationDetails = {
      scope,
    };
    this.audience = audience;
    this.clientId = clientId;
    this.issuerOrigin = new URL(issuer).origin;
    this.maxAge = maxAge;
    this.tokenPushOptions = {
      mutualChallengeEnabled: tokenPushOptions?.mutualChallengeEnabled ?? false,
    };
    this.faceBiometricOptions = {
      mutualChallengeEnabled: faceBiometricOptions?.mutualChallengeEnabled ?? false,
    };
    this.oidcConfig = oidcConfig;
    this.preferredAuthenticationMethod = preferredAuthenticationMethod;
    this.strict = strict ?? false;
    this.transactionDetails = transactionDetails;
    this.useRefreshToken = useRefreshToken ?? false;
    this.userId = userId ?? "";
    this.acrValues = acrValues;
    this.password = password;
  }

  private async handlePasskeyLogin(): Promise<void> {
    if (!(await browserSupportsPasskey())) {
      throw new Error("This browser does not support passkey");
    }

    const { method } = this.authenticationDetails;
    const token = this.token;
    const fidoChallenge = this.fidoChallenge;

    if (!(token && method && fidoChallenge)) {
      throw new Error("Failed to retrieve required values");
    }

    const authChallenge: PublicKeyCredentialRequestOptionsJSON = {
      challenge: fidoChallenge.challenge ?? "",
    };

    this.publicKeyCredentialRequestOptions = this.getCredentialRequestOptions(authChallenge);
  }

  private getCredentialRequestOptions(
    optionsJSON: PublicKeyCredentialRequestOptionsJSON,
  ): PublicKeyCredentialRequestOptions {
    let allowCredentials: PublicKeyCredentialDescriptor[] | undefined;

    if (optionsJSON.allowCredentials?.length !== 0) {
      allowCredentials = optionsJSON.allowCredentials?.map(toPublicKeyCredentialDescriptor);
    }

    // We need to convert some values to Uint8Arrays before passing the credentials to the navigator
    const publicKey: PublicKeyCredentialRequestOptions = {
      ...optionsJSON,
      challenge: base64URLStringToBuffer(optionsJSON.challenge),
      allowCredentials,
    };

    return publicKey;
  }

  /**
   * Requests an authentication challenge from the IDaaS Authentication API.
   */
  public async requestAuthChallenge(): Promise<AuthenticationResponse> {
    // 1. Generate /authorizejwt URL and fetch OIDC details
    const { url, codeVerifier } = await this.generateJwtAuthorizeUrl();
    const { authRequestKey, applicationId } = await getAuthRequestId(url);

    this.requiredDetails = {
      authRequestKey,
      applicationId,
      codeVerifier,
    };

    // 2. Get authentication method and second factor method
    const { authenticationMethod: method, secondFactor } = await this.determineAuthenticationMethod();

    this.authenticationDetails.method = method;
    this.authenticationDetails.secondFactor = secondFactor;

    // 3. Prepare request body
    const requestBody = this.constructUserChallengeParams();

    // 4. Send request to IDaaS Auth API
    const requestAuthChallengeResponse: AuthenticatedResponse = await requestAuthChallenge(
      requestBody,
      method,
      this.issuerOrigin,
    );

    const { token, faceChallenge, fidoChallenge, kbaChallenge } = requestAuthChallengeResponse;

    // 5. Update stored values with IDaaS Auth API response
    this.token = token;
    this.fidoChallenge = fidoChallenge;
    this.faceChallenge = faceChallenge;
    this.kbaChallenge = kbaChallenge;

    if (method === "PASSWORD_AND_SECONDFACTOR" && this.password) {
      await this.submitAuthChallenge({
        response: this.password,
      });

      return await this.prepareForSecondFactorSubmission();
    }

    if (method === "PASSKEY" || method === "FIDO") {
      await this.handlePasskeyLogin();
    }

    const pollForCompletion = this.shouldPoll(method);

    return {
      ...requestAuthChallengeResponse,
      publicKeyCredentialRequestOptions: this.publicKeyCredentialRequestOptions,
      pollForCompletion,
      method,
      userId: this.userId,
    };
  }

  private async generateJwtAuthorizeUrl() {
    const { url, usedScope, codeVerifier } = await generateAuthorizationUrl(this.oidcConfig, {
      type: "jwt",
      issuer: this.oidcConfig.issuer,
      clientId: this.clientId,
      useRefreshToken: this.useRefreshToken,
      scope: this.authenticationDetails.scope,
      audience: this.audience,
      maxAge: this.maxAge,
      acrValues: this.acrValues,
    });

    this.authenticationDetails.scope = usedScope;

    return { url: url.toString(), codeVerifier };
  }

  private async queryUserAuthenticators(): Promise<{
    authenticationTypes: IdaasAuthenticationMethod[];
    availableSecondFactor: IdaasAuthenticationMethod[] | undefined;
  }> {
    if (!this.requiredDetails) {
      throw new Error("Jwt params not initialized");
    }

    const queryUserAuthResponse: UserAuthenticateQueryResponse = await queryUserAuthOptions(
      {
        transactionDetails: this.transactionDetails,
        userId: this.userId,
        authRequestKey: this.requiredDetails.authRequestKey,
        applicationId: this.requiredDetails.applicationId,
        origin: window.location.origin,
      },
      this.issuerOrigin,
    );

    const { authenticationTypes, availableSecondFactor } = queryUserAuthResponse;

    return {
      authenticationTypes: authenticationTypes as IdaasAuthenticationMethod[],
      availableSecondFactor: availableSecondFactor as IdaasAuthenticationMethod[],
    };
  }

  private async determineAuthenticationMethod(): Promise<{
    authenticationMethod: IdaasAuthenticationMethod;
    secondFactor: IdaasAuthenticationMethod | undefined;
  }> {
    const userId = this.userId;
    const strict = this.strict;
    const preferredAuthenticationMethod = this.preferredAuthenticationMethod;

    if (!userId) {
      // passkey auth
      return {
        authenticationMethod: "PASSKEY",
        secondFactor: undefined,
      };
    }

    if (strict && !preferredAuthenticationMethod) {
      throw new Error("preferredAuthenticationMethod must be defined");
    }

    // no need to query for second factor
    if (strict && preferredAuthenticationMethod && preferredAuthenticationMethod !== "PASSWORD_AND_SECONDFACTOR") {
      return {
        authenticationMethod: preferredAuthenticationMethod,
        secondFactor: undefined,
      };
    }

    // query for authenticators
    const { authenticationTypes, availableSecondFactor } = await this.queryUserAuthenticators();
    const secondFactor = availableSecondFactor ? availableSecondFactor[0] : undefined;

    if (preferredAuthenticationMethod) {
      const preferredMethodAvailable = authenticationTypes.includes(preferredAuthenticationMethod);

      if (strict) {
        return {
          authenticationMethod: preferredAuthenticationMethod,
          secondFactor,
        };
      }

      if (preferredMethodAvailable) {
        return {
          authenticationMethod: preferredAuthenticationMethod,
          secondFactor,
        };
      }
    }

    if (!authenticationTypes[0]) {
      throw new Error("No authentication methods available for the user");
    }

    // default or when `preferredAuthenticationMethod` is not available
    return {
      authenticationMethod: authenticationTypes[0],
      secondFactor,
    };
  }

  private async requestSecondFactorAuth(): Promise<AuthenticatedResponse> {
    const requestBody = this.constructUserChallengeParams();
    const response = await requestAuthChallenge(requestBody, "PASSWORD_AND_SECONDFACTOR", this.issuerOrigin);

    // update stored token
    this.token = response.token;

    return response;
  }

  private parseKbaChallengeAnswers(answers?: string[]): void {
    if (!(answers && this.kbaChallenge)) {
      return;
    }
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const userQuestion = this.kbaChallenge.userQuestions?.[i];
      if (userQuestion) {
        userQuestion.answer = answer;
      } else {
        // More answers provided than questions
        throw new Error("invalid user response");
      }
    }
  }

  /**
   * Submits an authentication challenge response to the IDaaS Authentication API.
   */
  public async submitAuthChallenge({
    response,
    kbaChallengeAnswers,
  }: AuthenticationSubmissionParams): Promise<AuthenticationResponse> {
    const { method } = this.authenticationDetails;
    const token = this.token;
    if (!(method && token)) {
      throw new Error("Error parsing authentication params");
    }

    this.parseKbaChallengeAnswers(kbaChallengeAnswers);

    const requestBody = this.constructUserAuthenticateParams("SUBMIT", response);

    const authenticationResponse = await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);
    this.token = authenticationResponse.token;

    // Second factor auth will occur
    if (method === "PASSWORD_AND_SECONDFACTOR" && !this.isSecondFactor) {
      return await this.prepareForSecondFactorSubmission();
    }

    if (authenticationResponse.authenticationCompleted) {
      await this.handleSuccessfulAuthentication();
    }

    return authenticationResponse;
  }

  private handleSuccessfulAuthentication = async () => {
    if (!this.requiredDetails) {
      throw new Error("Jwt parameters not initialized");
    }
    const { authRequestKey, codeVerifier } = this.requiredDetails;

    if (!this.token) {
      throw new Error("IDaaS token not stored");
    }

    const requestBody: JwtIdaasTokenRequest = {
      client_id: this.clientId,
      code: authRequestKey,
      code_verifier: codeVerifier,
      grant_type: "jwt_idaas",
      jwt: this.token,
    };

    const { id_token, access_token, expires_in, refresh_token } = await requestToken(
      this.oidcConfig.token_endpoint,
      requestBody,
    );

    if (!(id_token && access_token)) {
      throw new Error("failed to fetch id token and access token from IDaaS");
    }

    if (this.useRefreshToken && !refresh_token) {
      throw new Error("failed to fetch refresh token from IDaaS");
    }

    this.authenticationDetails = {
      ...this.authenticationDetails,
      idToken: id_token as string,
      accessToken: access_token as string,
      refreshToken: refresh_token as string,
      expiresAt: calculateEpochExpiry(expires_in),
      audience: this.audience,
      maxAge: this.maxAge,
    };
  };

  private prepareForSecondFactorSubmission = async (): Promise<AuthenticationResponse> => {
    this.isSecondFactor = true;

    const secondFactor = this.authenticationDetails.secondFactor;
    if (!secondFactor) {
      throw new Error("error parsing authentication params");
    }

    const { method } = this.authenticationDetails;

    const secondFactorRequest = await this.requestSecondFactorAuth();
    const { faceChallenge, fidoChallenge, kbaChallenge, token: secondFactorToken } = secondFactorRequest;

    this.fidoChallenge = fidoChallenge;
    this.faceChallenge = faceChallenge;
    this.kbaChallenge = kbaChallenge;
    this.token = secondFactorToken;

    if (secondFactor === "FIDO" || secondFactor === "PASSKEY") {
      await this.handlePasskeyLogin();
    }

    const pollForCompletion = this.shouldPoll(secondFactor);
    return {
      ...secondFactorRequest,
      secondFactorMethod: secondFactor,
      publicKeyCredentialRequestOptions: this.publicKeyCredentialRequestOptions,
      pollForCompletion,
      method,
    };
  };

  private async poll(): Promise<AuthenticatedResponse> {
    const { method } = this.authenticationDetails;
    const token = this.token;

    if (!(token && method)) {
      throw new Error("Error parsing authentication params");
    }
    const requestBody = this.constructUserAuthenticateParams("POLL");

    return await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);
  }

  /**
   * Polls the IDaaS Authentication API to determine if the user has completed authentication.
   */
  public async pollForAuthCompletion(): Promise<AuthenticationResponse> {
    // set polling
    this.continuePolling = true;
    let authResponse: AuthenticatedResponse = {};

    while (this.continuePolling) {
      authResponse = await this.poll();
      const { status } = authResponse;

      switch (status) {
        // Should never happen, IDaaS would throw before this is reached
        case undefined: {
          throw new Error("The method of authentication requires a user response.");
        }
        // Continue polling, wait for user to authenticate
        case "NO_RESPONSE": {
          break;
        }
        // Stop polling, return the api response
        default: {
          this.continuePolling = false;
          break;
        }
      }

      // wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (authResponse.authenticationCompleted) {
      this.token = authResponse.token;
      await this.handleSuccessfulAuthentication();
    }

    return authResponse;
  }

  /**
   * Cancels an authentication challenge received from the IDaaS Authentication API.
   */
  public async cancelAuthChallenge() {
    const { method } = this.authenticationDetails;
    const token = this.token;

    if (!(token && method)) {
      throw new Error("error parsing authentication params");
    }

    if (this.abortController) {
      this.abortController.abort("cancelled login ceremony");
    }

    // end polling
    this.continuePolling = false;
    if (method !== "PASSKEY") {
      const requestBody = this.constructUserAuthenticateParams("CANCEL");

      await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);
    }
  }

  private shouldPoll = (method: string) => {
    return method === "FACE" || method === "TOKENPUSH" || method === "SMARTCREDENTIALPUSH";
  };

  public getAuthenticationDetails = (): AuthenticationDetails => {
    return this.authenticationDetails;
  };

  private constructUserChallengeParams = (): UserChallengeParameters => {
    const { method, secondFactor } = this.authenticationDetails;
    const token = this.token;
    if (!this.requiredDetails) {
      throw new Error("Jwt params not initialized");
    }

    if (!method) {
      throw new Error("error parsing authentication params");
    }

    const requestBody: UserChallengeParameters = {
      transactionDetails: this.transactionDetails,
      applicationId: this.requiredDetails.applicationId,
      userId: this.userId,
      authRequestKey: this.requiredDetails.authRequestKey,
    };

    if (method === "FIDO") {
      requestBody.origin = window.location.origin;
    }

    if (method === "TOKENPUSH") {
      requestBody.pushMutualChallengeEnabled = this.tokenPushOptions.mutualChallengeEnabled;
    }

    if (method === "FACE") {
      requestBody.pushMutualChallengeEnabled = this.faceBiometricOptions.mutualChallengeEnabled;
    }

    if (this.isSecondFactor) {
      if (!(secondFactor && token)) {
        throw new Error("Error parsing authentication params");
      }

      if (secondFactor === "TOKENPUSH") {
        requestBody.pushMutualChallengeEnabled = this.tokenPushOptions.mutualChallengeEnabled;
      }

      if (secondFactor === "FACE") {
        requestBody.pushMutualChallengeEnabled = this.faceBiometricOptions.mutualChallengeEnabled;
      }

      if (secondFactor === "FIDO") {
        requestBody.origin = window.location.origin;
      }

      requestBody.secondFactorAuthenticator = secondFactor;
      requestBody.authToken = token;
    }

    return requestBody;
  };

  private constructUserAuthenticateParams = (
    requestType: "POLL" | "CANCEL" | "SUBMIT",
    response?: string,
  ): UserAuthenticateParameters => {
    const { secondFactor, method } = this.authenticationDetails;
    if (!this.requiredDetails) {
      throw new Error("Required details not initialized");
    }

    const requestBody: UserAuthenticateParameters = {
      transactionDetails: this.transactionDetails,
      applicationId: this.requiredDetails.applicationId,
      userId: this.userId,
    };

    if (this.isSecondFactor) {
      if (!secondFactor) {
        throw new Error("Error parsing authentication params");
      }
      requestBody.secondFactorAuthenticator = secondFactor;
    }

    switch (requestType) {
      case "CANCEL": {
        requestBody.cancel = true;
        break;
      }
      case "POLL": {
        if (method === "FACE") {
          requestBody.faceResponse = this.faceChallenge?.workflowRunId;
          // TODO: deprecated
        }
        break;
      }
      case "SUBMIT": {
        requestBody.authRequestKey = this.requiredDetails.authRequestKey;
        requestBody.response = response ?? undefined;
        requestBody.kbaChallenge = this.kbaChallenge ?? undefined;
        requestBody.fidoResponse = this.fidoResponse ?? undefined;
        break;
      }
    }
    return requestBody;
  };

  public submitPasskey = async (credential: AuthenticationCredential) => {
    const { id, response } = credential;

    let userHandle: string | undefined;

    if (response.userHandle) {
      userHandle = bufferToBase64URLString(response.userHandle);
    }

    // Convert values to base64 to make it easier to send back to the server
    this.fidoResponse = {
      authenticatorData: bufferToBase64URLString(response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      credentialId: id,
      signature: bufferToBase64URLString(response.signature),
      userHandle,
    };
  };
}
