import {
  getAuthRequestId,
  type JwtIdaasTokenRequest,
  type OidcConfig,
  queryUserAuthOptions,
  requestAuthChallenge,
  requestToken,
  submitAuthChallenge,
} from "./api";
import type {
  AuthenticationRequestParams,
  AuthenticationResponse,
  AuthenticationSubmissionParams,
  AuthenticationTransactionOptions,
  IdaasAuthenticationMethod,
  TokenOptions,
} from "./models";
import type {
  AuthenticatedResponse,
  FidoResponse,
  KbaChallenge,
  UserAuthenticateParameters,
  UserAuthenticateQueryResponse,
  UserChallengeParameters,
} from "./models/openapi-ts";
import { calculateEpochExpiry } from "./utils/format";
import { buildFidoResponse, buildPubKeyRequestOptions } from "./utils/passkey";
import { generateAuthorizationUrl } from "./utils/url";

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
  private readonly authenticationRequestParams?: AuthenticationRequestParams;
  private readonly clientId: string;
  private readonly issuerOrigin: string;
  private readonly oidcConfig: OidcConfig;
  private readonly tokenOptions: TokenOptions;

  private authenticationDetails: AuthenticationDetails;
  private continuePolling = false;
  private isSecondFactor = false;

  private fidoResponse?: FidoResponse;
  private kbaChallenge?: KbaChallenge;
  private publicKeyCredentialRequestOptions?: PublicKeyCredentialRequestOptions;
  private requiredDetails?: RequiredDetails;
  private token?: string;
  private abortController?: AbortController;

  constructor({ oidcConfig, tokenOptions, clientId, authenticationRequestParams }: AuthenticationTransactionOptions) {
    const { issuer } = oidcConfig;

    this.authenticationDetails = {
      scope: tokenOptions.scope,
    };
    this.tokenOptions = tokenOptions;
    this.clientId = clientId;
    this.issuerOrigin = new URL(issuer).origin;
    this.authenticationRequestParams = authenticationRequestParams;
    this.oidcConfig = oidcConfig;
  }

  /**
   * Requests an authentication challenge from the IDaaS Authentication API.
   */
  public async requestAuthChallenge(): Promise<AuthenticationResponse> {
    // 1. Generate /authorizejwt URL and fetch OIDC details
    const { url, codeVerifier } = await generateAuthorizationUrl(this.oidcConfig, {
      clientId: this.clientId,
      tokenOptions: this.tokenOptions,
      type: "jwt",
    });

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

    const { token, fidoChallenge, kbaChallenge } = requestAuthChallengeResponse;

    // 5. Update stored values with IDaaS Auth API response
    this.token = token;
    this.kbaChallenge = kbaChallenge;

    if (method === "PASSWORD_AND_SECONDFACTOR" && this.authenticationRequestParams?.password) {
      return await this.submitAuthChallenge({
        response: this.authenticationRequestParams.password,
      });
    }

    if (method === "PASSKEY" || method === "FIDO") {
      if (!(token && method && fidoChallenge)) {
        throw new Error("Failed to retrieve required values");
      }
      this.publicKeyCredentialRequestOptions = buildPubKeyRequestOptions(fidoChallenge);
    }

    const pollForCompletion = this.shouldPoll(method);

    return {
      ...requestAuthChallengeResponse,
      passkeyChallenge: this.publicKeyCredentialRequestOptions,
      pollForCompletion,
      method,
      userId: this.authenticationRequestParams?.userId,
    };
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
        transactionDetails: this.authenticationRequestParams?.transactionDetails,
        userId: this.authenticationRequestParams?.userId || "",
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
    const userId = this.authenticationRequestParams?.userId;
    const strict = this.authenticationRequestParams?.strict;
    const preferredAuthenticationMethod = this.authenticationRequestParams?.preferredAuthenticationMethod;

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

    // determine the second factor: prefer the configured method, otherwise use the first available. Leave undefined if none exist.
    let secondFactor: IdaasAuthenticationMethod | undefined;
    if (availableSecondFactor?.length) {
      if (preferredAuthenticationMethod && availableSecondFactor.includes(preferredAuthenticationMethod)) {
        secondFactor = preferredAuthenticationMethod;
      } else {
        secondFactor = availableSecondFactor[0];
      }
    }

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
    passkeyResponse,
  }: AuthenticationSubmissionParams): Promise<AuthenticationResponse> {
    const { method } = this.authenticationDetails;
    const token = this.token;
    if (!(method && token)) {
      throw new Error("Error parsing authentication params");
    }

    if (passkeyResponse) {
      this.fidoResponse = buildFidoResponse(passkeyResponse);
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

    if (this.tokenOptions.useRefreshToken && !refresh_token) {
      throw new Error("failed to fetch refresh token from IDaaS");
    }

    this.authenticationDetails = {
      ...this.authenticationDetails,
      idToken: id_token as string,
      accessToken: access_token as string,
      refreshToken: refresh_token as string,
      expiresAt: calculateEpochExpiry(expires_in),
      audience: this.tokenOptions.audience,
      maxAge: this.tokenOptions.maxAge,
    };
  };

  private prepareForSecondFactorSubmission = async (): Promise<AuthenticationResponse> => {
    this.isSecondFactor = true;

    const secondFactor = this.authenticationDetails.secondFactor;
    if (!secondFactor) {
      throw new Error("error parsing authentication params");
    }

    const secondFactorRequest = await this.requestSecondFactorAuth();
    const { fidoChallenge, kbaChallenge, token: secondFactorToken } = secondFactorRequest;

    this.kbaChallenge = kbaChallenge;
    this.token = secondFactorToken;

    if (secondFactor === "FIDO" || secondFactor === "PASSKEY") {
      if (!(this.token && fidoChallenge)) {
        throw new Error("Failed to retrieve required values");
      }
      this.publicKeyCredentialRequestOptions = buildPubKeyRequestOptions(fidoChallenge);
    }

    const pollForCompletion = this.shouldPoll(secondFactor);
    return {
      ...secondFactorRequest,
      secondFactorMethod: secondFactor,
      passkeyChallenge: this.publicKeyCredentialRequestOptions,
      pollForCompletion,
    };
  };

  private async poll(): Promise<AuthenticatedResponse> {
    const { method } = this.authenticationDetails;
    const token = this.token;

    if (!(token && method)) {
      throw new Error("Error parsing authentication params");
    }
    const requestBody = this.constructUserAuthenticateParams();

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
      transactionDetails: this.authenticationRequestParams?.transactionDetails,
      applicationId: this.requiredDetails.applicationId,
      userId: this.authenticationRequestParams?.userId,
      authRequestKey: this.requiredDetails.authRequestKey,
    };

    if (this.isSecondFactor) {
      if (!(secondFactor && token)) {
        throw new Error("Error parsing authentication params");
      }

      requestBody.secondFactorAuthenticator = secondFactor;
      requestBody.authToken = token;
    }

    const authenticator = this.isSecondFactor ? secondFactor : method;

    switch (authenticator) {
      case "FACE":
        requestBody.pushMutualChallengeEnabled =
          this.authenticationRequestParams?.faceBiometricOptions?.mutualChallenge;
        break;
      case "FIDO":
      case "PASSKEY":
        requestBody.rpId = window.location.origin;
        break;
      case "TOKENPUSH":
        requestBody.pushMutualChallengeEnabled =
          this.authenticationRequestParams?.softTokenPushOptions?.mutualChallenge;
        break;
      case "SMARTCREDENTIALPUSH":
        requestBody.summary = this.authenticationRequestParams?.smartCredentialOptions?.summary;
        requestBody.pushMessageIdentifier =
          this.authenticationRequestParams?.smartCredentialOptions?.pushMessageIdentifier;
        break;
      case "OTP":
        requestBody.otpDeliveryType = this.authenticationRequestParams?.otpOptions?.otpDeliveryType;
        requestBody.otpDeliveryAttribute = this.authenticationRequestParams?.otpOptions?.otpDeliveryAttribute;
        break;
    }

    return requestBody;
  };

  private constructUserAuthenticateParams = (
    requestType?: "CANCEL" | "SUBMIT",
    response?: string,
  ): UserAuthenticateParameters => {
    const { secondFactor } = this.authenticationDetails;
    if (!this.requiredDetails) {
      throw new Error("Required details not initialized");
    }

    const requestBody: UserAuthenticateParameters = {
      transactionDetails: this.authenticationRequestParams?.transactionDetails,
      applicationId: this.requiredDetails.applicationId,
      userId: this.authenticationRequestParams?.userId,
      authRequestKey: this.requiredDetails.authRequestKey,
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
}
