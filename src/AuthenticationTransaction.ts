import {
  type JwtIdaasTokenRequest,
  type OidcConfig,
  getAuthRequestId,
  queryUserAuthOptions,
  requestAuthChallenge,
  requestToken,
  submitAuthChallenge,
} from "./api";
import type { AuthenticationResponse, AuthenticationSubmissionParams, IdaasAuthenticationMethod } from "./models";
import type {
  AuthenticatedResponse,
  ErrorInfo,
  FIDOChallenge,
  FaceChallenge,
  KbaChallenge,
  TransactionDetail,
  UserAuthenticateParameters,
  UserAuthenticateQueryResponse,
  UserChallengeParameters,
} from "./models/openapi-ts";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "./utils/crypto";
import { calculateEpochExpiry } from "./utils/format";

export interface AuthenticationDetails {
  method?: IdaasAuthenticationMethod;
  token?: string;
  secondFactor?: IdaasAuthenticationMethod;
  isSecondFactor?: boolean;
  continuePolling?: boolean;
  authRequestKey?: string;
  applicationId?: string;
  scope?: string;
  useRefreshToken?: boolean;
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
  private readonly config: OidcConfig;
  private readonly userId: string;

  private readonly preferredAuthenticationMethod?: IdaasAuthenticationMethod;
  private readonly strict?: boolean;
  private readonly mutualChallengeEnabled?: boolean;
  private readonly audience?: string;
  private readonly maxAge?: number;
  private readonly transactionDetails?: TransactionDetail[];

  private authenticationDetails: AuthenticationDetails;

  private requiredDetails?: RequiredDetails;
  private faceChallenge?: FaceChallenge;
  private kbaChallenge?: KbaChallenge;
  private fidoChallenge?: FIDOChallenge;

  constructor({
    config,
    userId,
    scope,
    useRefreshToken,
    clientId,
    preferredAuthenticationMethod,
    strict,
    mutualChallengeEnabled,
    audience,
    maxAge,
    transactionDetails,
  }: {
    config: OidcConfig;
    userId?: string;
    scope?: string;
    useRefreshToken?: boolean;
    clientId: string;
    preferredAuthenticationMethod?: IdaasAuthenticationMethod;
    strict?: boolean;
    mutualChallengeEnabled?: boolean;
    audience?: string;
    maxAge?: number;
    transactionDetails?: TransactionDetail[];
  }) {
    const { issuer } = config;

    this.authenticationDetails = {
      scope,
      useRefreshToken,
    };

    this.transactionDetails = transactionDetails;
    this.maxAge = maxAge;
    this.audience = audience;
    this.mutualChallengeEnabled = mutualChallengeEnabled;
    this.preferredAuthenticationMethod = preferredAuthenticationMethod;
    this.strict = strict;
    this.userId = userId ?? "";
    this.issuerOrigin = new URL(issuer).origin;
    this.clientId = clientId;
    this.config = config;
  }

  /**
   * Requests an authentication challenge from the IDaaS Authentication API.
   */
  public async requestAuthChallenge(): Promise<AuthenticationResponse> {
    const { url, codeVerifier } = await this.generateJwtAuthorizeUrl();
    const { authRequestKey, applicationId } = await getAuthRequestId(url);

    this.requiredDetails = {
      authRequestKey,
      applicationId,
      codeVerifier,
    };

    // get authentication method and second factor
    const { authenticationMethod: method, secondFactor } = await this.determineAuthenticationMethod();

    this.authenticationDetails.method = method;
    this.authenticationDetails.secondFactor = secondFactor;

    const requestBody = this.constructUserChallengeParams();

    const requestAuthChallengeResponse: AuthenticatedResponse = await requestAuthChallenge(
      requestBody,
      method,
      this.issuerOrigin,
    );

    this.parseResponseErrors(requestAuthChallengeResponse);

    const { token, faceChallenge, fidoChallenge, kbaChallenge } = requestAuthChallengeResponse;

    this.authenticationDetails.token = token;
    this.fidoChallenge = fidoChallenge;
    this.faceChallenge = faceChallenge;
    this.kbaChallenge = kbaChallenge;

    const pollForCompletion = this.shouldPoll(method);

    return { ...requestAuthChallengeResponse, pollForCompletion, method, userId: this.userId };
  }

  private async generateJwtAuthorizeUrl() {
    const { useRefreshToken } = this.authenticationDetails;
    const url = new URL(`${this.config.issuer}/authorizejwt`);
    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();
    const state = base64UrlStringEncode(createRandomString());
    const nonce = base64UrlStringEncode(createRandomString());
    const scope = this.authenticationDetails.scope ?? "";
    const scopeAsArray = scope.split(" ");
    scopeAsArray.push("openid");

    if (useRefreshToken) {
      scopeAsArray.push("offline_access");
    }

    // removes duplicate values
    const usedScope = [...new Set(scopeAsArray)].join(" ");

    if (this.audience) {
      url.searchParams.append("audience", this.audience);
    }

    if (this.maxAge) {
      url.searchParams.append("max_age", this.maxAge.toString());
    }

    url.searchParams.append("state", state);
    url.searchParams.append("nonce", nonce);
    url.searchParams.append("scope", usedScope);
    url.searchParams.append("client_id", this.clientId);
    url.searchParams.append("code_challenge", codeChallenge);
    // Note: The PKCE spec defines an additional code_challenge_method 'plain', but it is explicitly NOT recommended
    // https://datatracker.ietf.org/doc/html/rfc7636#section-7.2
    url.searchParams.append("code_challenge_method", "S256");

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
        authRequestKey: this.authenticationDetails.authRequestKey,
        applicationId: this.requiredDetails.applicationId,
      },
      this.issuerOrigin,
    );

    this.parseResponseErrors(queryUserAuthResponse);

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
    // default or when `preferredAuthenticationMethod` is not available
    return {
      authenticationMethod: authenticationTypes[0],
      secondFactor,
    };
  }

  private async requestSecondFactorAuth(): Promise<AuthenticatedResponse> {
    const requestBody = this.constructUserChallengeParams();
    const response = await requestAuthChallenge(requestBody, "PASSWORD_AND_SECONDFACTOR", this.issuerOrigin);

    this.authenticationDetails.token = response.token;

    return response;
  }

  private parseKbaChallengeAnswers(answers?: string[]): void {
    if (!(answers && this.kbaChallenge)) {
      return;
    }
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      if (this.kbaChallenge?.userQuestions[i]) {
        this.kbaChallenge.userQuestions[i].answer = answer;
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
    const { method, token, isSecondFactor } = this.authenticationDetails;

    if (!(method && token)) {
      throw new Error("Error parsing authentication params");
    }

    this.parseKbaChallengeAnswers(kbaChallengeAnswers);

    const requestBody = this.constructUserAuthenticateParams("SUBMIT", response);

    const authenticationResponse = await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);

    // Second factor auth will occur
    if (method === "PASSWORD_AND_SECONDFACTOR" && !isSecondFactor) {
      return await this.prepareForSecondFactorSubmission(authenticationResponse);
    }

    if (authenticationResponse.authenticationCompleted) {
      this.authenticationDetails.token = authenticationResponse.token;
      await this.handleSuccessfulAuthentication();
    }

    return authenticationResponse;
  }

  private handleSuccessfulAuthentication = async () => {
    if (!this.requiredDetails) {
      throw new Error("Jwt parameters not initialized");
    }
    const { authRequestKey, codeVerifier } = this.requiredDetails;

    const requestBody: JwtIdaasTokenRequest = {
      client_id: this.clientId,
      code: authRequestKey,
      code_verifier: codeVerifier,
      grant_type: "jwt_idaas",
      jwt: this.authenticationDetails.token as string,
    };
    const { id_token, access_token, expires_in, refresh_token } = await requestToken(
      this.config.token_endpoint,
      requestBody,
    );

    if (!(id_token && access_token)) {
      throw new Error("failed to fetch id token and access token from IDaaS");
    }

    if (this.authenticationDetails.useRefreshToken && !refresh_token) {
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

  private prepareForSecondFactorSubmission = async (
    firstFactorResponse: AuthenticationResponse,
  ): Promise<AuthenticationResponse> => {
    this.authenticationDetails.isSecondFactor = true;
    const { token } = firstFactorResponse;

    const secondFactor = this.authenticationDetails.secondFactor;
    if (!secondFactor) {
      throw new Error("error parsing authentication params");
    }

    this.authenticationDetails.token = token;
    const secondFactorRequest = await this.requestSecondFactorAuth();
    const { faceChallenge, fidoChallenge, kbaChallenge, token: secondFactorToken } = secondFactorRequest;

    this.fidoChallenge = fidoChallenge;
    this.faceChallenge = faceChallenge;
    this.kbaChallenge = kbaChallenge;
    this.authenticationDetails.token = secondFactorToken;

    const pollForCompletion = this.shouldPoll(secondFactor);
    return {
      ...secondFactorRequest,
      secondFactorMethod: secondFactor,
      pollForCompletion,
      method: firstFactorResponse.method,
    };
  };

  private async poll(): Promise<AuthenticatedResponse> {
    const { token, method } = this.authenticationDetails;

    if (!(token && method)) {
      throw new Error("Error parsing authentication params");
    }
    const requestBody = this.constructUserAuthenticateParams("POLL");

    const authResponse = await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);

    this.parseResponseErrors(authResponse);

    return authResponse;
  }

  /**
   * Polls the IDaaS Authentication API to determine if the user has completed authentication.
   */
  public async pollForAuthCompletion(): Promise<AuthenticationResponse> {
    // set polling
    this.authenticationDetails.continuePolling = true;
    let authResponse: AuthenticatedResponse = {};

    while (this.authenticationDetails.continuePolling) {
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
          this.authenticationDetails.continuePolling = false;
          break;
        }
      }

      // wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (authResponse.authenticationCompleted) {
      this.authenticationDetails.token = authResponse.token;
      await this.handleSuccessfulAuthentication();
    }

    return authResponse;
  }

  /**
   * Cancels an authentication challenge received from the IDaaS Authentication API.
   */
  public async cancelAuthChallenge() {
    const { token, method } = this.authenticationDetails;

    if (!(token && method)) {
      throw new Error("error parsing authentication params");
    }

    const requestBody = this.constructUserAuthenticateParams("CANCEL");

    // end polling
    this.authenticationDetails.continuePolling = false;
    await submitAuthChallenge(requestBody, method, token, this.issuerOrigin);
  }

  private parseResponseErrors(response: AuthenticatedResponse) {
    const errorResponse = response as ErrorInfo;
    const { errorCode, errorMessage } = errorResponse;

    if (errorCode) {
      throw new Error(errorCode, { cause: errorMessage });
    }
  }

  private shouldPoll = (method: string) => {
    return method === "FACE" || method === "TOKENPUSH" || method === "SMARTCREDENTIALPUSH";
  };

  public getAuthenticationDetails = (): AuthenticationDetails => {
    return {
      ...this.transactionDetails,
      ...this.requiredDetails,
    };
  };

  private constructUserChallengeParams = (): UserChallengeParameters => {
    const { method, isSecondFactor, secondFactor, token } = this.authenticationDetails;
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
    };

    if (method === "FIDO") {
      requestBody.origin = window.location.origin;
    }

    if (method === "TOKENPUSH" || method === "FACE") {
      requestBody.pushMutualChallengeEnabled = this.mutualChallengeEnabled;
    }

    if (isSecondFactor) {
      if (!(secondFactor && token)) {
        throw new Error("Error parsing authentication params");
      }

      if (secondFactor === "TOKENPUSH" || secondFactor === "FACE") {
        requestBody.pushMutualChallengeEnabled = this.mutualChallengeEnabled;
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
    const { secondFactor, isSecondFactor, method } = this.authenticationDetails;
    if (!this.requiredDetails) {
      throw new Error("Required details not initialized");
    }

    const requestBody: UserAuthenticateParameters = {
      transactionDetails: this.transactionDetails,
      applicationId: this.requiredDetails.applicationId,
      userId: this.userId,
    };

    if (isSecondFactor) {
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
        }
        break;
      }
      case "SUBMIT": {
        requestBody.authRequestKey = this.requiredDetails.authRequestKey;
        requestBody.response = response;
        requestBody.kbaChallenge = this.kbaChallenge ?? undefined;
        break;
      }
    }
    return requestBody;
  };
}
