import { afterEach, describe, expect, it, jest, spyOn } from "bun:test";
import { AuthenticationTransaction } from "../../src/AuthenticationTransaction";
import * as api from "../../src/api";
import * as passkeyUtils from "../../src/utils/passkey";
import * as urlUtils from "../../src/utils/url";
import { TEST_CLIENT_ID, TEST_ENCODED_TOKEN, TEST_OIDC_CONFIG } from "./constants";

const baseUrl = new URL(TEST_OIDC_CONFIG.issuer).origin;
const passkeyRequestOptions = { challenge: new Uint8Array([1]) } as PublicKeyCredentialRequestOptions;
const withImmediateTimers = async <T>(action: () => Promise<T> | T) => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler) => {
    if (typeof handler === "function") {
      handler();
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  try {
    return await action();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
};

describe("AuthenticationTransaction", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a passkey challenge when no userId is provided", async () => {
    const generateSpy = spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    const authRequestSpy = spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      fidoChallenge: { challenge: "challenge", timeout: 0, timeoutMillis: 0 },
    });
    const pubKeySpy = spyOn(passkeyUtils, "buildPubKeyRequestOptions").mockReturnValue(passkeyRequestOptions);

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {},
    });

    const response = await transaction.requestAuthChallenge();

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(authRequestSpy).toHaveBeenCalledWith("https://example.com/authorizejwt");
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ rpId: window.location.hostname }),
      "PASSKEY",
      baseUrl,
    );
    expect(pubKeySpy).toHaveBeenCalledTimes(1);
    expect(response.method).toBe("PASSKEY");
    expect(response.passkeyChallenge).toEqual(passkeyRequestOptions);
    expect(response.pollForCompletion).toBe(false);
  });

  it("throws when strict is true without a preferred method", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    const querySpy = spyOn(api, "queryUserAuthOptions").mockResolvedValue({
      authenticationTypes: ["PASSWORD"],
      availableSecondFactor: [],
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
      },
    });

    await expect(transaction.requestAuthChallenge()).rejects.toThrow("preferredAuthenticationMethod must be defined");
    expect(querySpy).not.toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("uses preferred method in strict mode without querying user authenticators", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    const querySpy = spyOn(api, "queryUserAuthOptions").mockResolvedValue({
      authenticationTypes: ["PASSWORD"],
      availableSecondFactor: [],
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "OTP",
        otpOptions: { otpDeliveryType: "SMS", otpDeliveryAttribute: "work" },
      },
    });

    const response = await transaction.requestAuthChallenge();

    expect(querySpy).not.toHaveBeenCalled();
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        otpDeliveryType: "SMS",
        otpDeliveryAttribute: "work",
      }),
      "OTP",
      baseUrl,
    );
    expect(response.method).toBe("OTP");
  });

  it("throws when no authentication methods are available", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    const querySpy = spyOn(api, "queryUserAuthOptions").mockResolvedValue({
      authenticationTypes: [],
      availableSecondFactor: [],
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
      },
    });

    await expect(transaction.requestAuthChallenge()).rejects.toThrow(
      "No authentication methods available for the user",
    );
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("falls back to the first available method when the preferred method is unavailable", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "queryUserAuthOptions").mockResolvedValue({
      authenticationTypes: ["PASSWORD", "OTP"],
      availableSecondFactor: [],
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        preferredAuthenticationMethod: "FIDO",
      },
    });

    const response = await transaction.requestAuthChallenge();

    expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: "user" }), "PASSWORD", baseUrl);
    expect(response.method).toBe("PASSWORD");
  });

  it("auto-submits password for password + second factor flows", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "queryUserAuthOptions").mockResolvedValue({
      authenticationTypes: ["PASSWORD_AND_SECONDFACTOR"],
      availableSecondFactor: ["OTP"],
    });
    const requestSpy = spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      authenticationCompleted: false,
    });
    const submitSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: true,
      token: "jwt-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        password: "secret",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD_AND_SECONDFACTOR",
      },
    });

    const response = await transaction.requestAuthChallenge();

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledTimes(2);
    expect(response.authenticationCompleted).toBe(false);
    expect(response.secondFactorMethod).toBe("OTP");
  });

  it("stores tokens after a successful single-factor submission", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: true,
      token: "jwt-token",
    });
    const tokenSpy = spyOn(api, "requestToken").mockResolvedValue({
      id_token: TEST_ENCODED_TOKEN,
      access_token: "access",
      expires_in: "60",
      token_type: "Bearer",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
    });

    await transaction.requestAuthChallenge();
    await transaction.submitAuthChallenge({ response: "secret" });

    expect(tokenSpy).toHaveBeenCalledTimes(1);

    const details = transaction.getAuthenticationDetails();
    expect(details.idToken).toBe(TEST_ENCODED_TOKEN);
    expect(details.accessToken).toBe("access");
  });

  it("throws when refresh tokens are required but missing from the token response", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: true,
      token: "jwt-token",
    });
    spyOn(api, "requestToken").mockResolvedValue({
      id_token: TEST_ENCODED_TOKEN,
      access_token: "access",
      expires_in: "60",
      token_type: "Bearer",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: true, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
    });

    await transaction.requestAuthChallenge();

    await expect(transaction.submitAuthChallenge({ response: "secret" })).rejects.toThrow(
      "failed to fetch refresh token from IDaaS",
    );
  });
  it("submits passkey responses using the FIDO payload", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      fidoChallenge: { challenge: "challenge", timeout: 0, timeoutMillis: 0 },
    });
    spyOn(passkeyUtils, "buildPubKeyRequestOptions").mockReturnValue(passkeyRequestOptions);
    const fidoSpy = spyOn(passkeyUtils, "buildFidoResponse").mockReturnValue({
      authenticatorData: "auth",
      clientDataJSON: "client",
      credentialId: "cred",
      signature: "sig",
      userHandle: "user-handle",
    });
    const submitSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: false,
      token: "next-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {},
    });

    await transaction.requestAuthChallenge();

    const credential = {} as PublicKeyCredential;
    await transaction.submitAuthChallenge({ passkeyResponse: credential });

    const [requestBody, method, token, origin] = submitSpy.mock.calls[0] ?? [];
    expect(fidoSpy).toHaveBeenCalledWith(credential);
    expect(method).toBe("PASSKEY");
    expect(token).toBe("session-token");
    expect(origin).toBe(baseUrl);
    expect(requestBody).toMatchObject({ fidoResponse: fidoSpy.mock.results[0]?.value });
  });

  it("submits KBA answers in the challenge payload", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    const kbaChallenge = {
      userQuestions: [{ question: "What is your favorite color?" }],
    };
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      kbaChallenge,
    });
    const submitSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: false,
      token: "next-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "KBA",
      },
    });

    await transaction.requestAuthChallenge();
    await transaction.submitAuthChallenge({ kbaChallengeAnswers: ["blue"] });

    const [requestBody] = submitSpy.mock.calls[0] ?? [];
    expect(requestBody?.kbaChallenge?.userQuestions?.[0]?.answer).toBe("blue");
  });

  it("throws when more KBA answers are provided than questions", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      kbaChallenge: { userQuestions: [{ question: "Q1" }] },
    });
    const submitSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({
      authenticationCompleted: false,
      token: "next-token",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "KBA",
      },
    });

    await transaction.requestAuthChallenge();

    await expect(transaction.submitAuthChallenge({ kbaChallengeAnswers: ["a1", "a2"] })).rejects.toThrow(
      "invalid user response",
    );
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("polls until a non-NO_RESPONSE status is returned", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    const pollSpy = spyOn(api, "submitAuthChallenge");
    pollSpy.mockResolvedValueOnce({ status: "NO_RESPONSE" }).mockResolvedValueOnce({ status: "CONFIRM" });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      },
    });

    await transaction.requestAuthChallenge();

    const response = await withImmediateTimers(() => transaction.pollForAuthCompletion());

    expect(pollSpy).toHaveBeenCalledTimes(2);
    expect((response as { status?: string }).status).toBe("CONFIRM");
  });

  it("throws when polling response has no status", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    spyOn(api, "submitAuthChallenge").mockResolvedValue({});

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      },
    });

    await transaction.requestAuthChallenge();

    await expect(transaction.pollForAuthCompletion()).rejects.toThrow(
      "The method of authentication requires a user response.",
    );
  });

  it("stores tokens when polling completes authentication", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    spyOn(api, "submitAuthChallenge").mockResolvedValue({
      status: "CONFIRM",
      authenticationCompleted: true,
      token: "jwt-token",
    });
    const tokenSpy = spyOn(api, "requestToken").mockResolvedValue({
      id_token: TEST_ENCODED_TOKEN,
      access_token: "access",
      expires_in: "60",
      token_type: "Bearer",
    });

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      },
    });

    await transaction.requestAuthChallenge();

    await withImmediateTimers(() => transaction.pollForAuthCompletion());

    expect(tokenSpy).toHaveBeenCalledTimes(1);
    const details = transaction.getAuthenticationDetails();
    expect(details.idToken).toBe(TEST_ENCODED_TOKEN);
    expect(details.accessToken).toBe("access");
  });

  it("submits cancellation for non-passkey authentication", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    const cancelSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({});

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {
        userId: "user",
        strict: true,
        preferredAuthenticationMethod: "TOKENPUSH",
      },
    });

    await transaction.requestAuthChallenge();
    await transaction.cancelAuthChallenge();

    expect(cancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cancel: true }),
      "TOKENPUSH",
      "session-token",
      baseUrl,
    );
  });

  it("skips cancellation submission for passkey authentication", async () => {
    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorizejwt",
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      usedScope: "openid",
    });
    spyOn(api, "getAuthRequestId").mockResolvedValue({
      authRequestKey: "auth-key",
      applicationId: "app-id",
    });
    spyOn(api, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
      fidoChallenge: { challenge: "challenge", timeout: 0, timeoutMillis: 0 },
    });
    spyOn(passkeyUtils, "buildPubKeyRequestOptions").mockReturnValue(passkeyRequestOptions);
    const cancelSpy = spyOn(api, "submitAuthChallenge").mockResolvedValue({});

    const transaction = new AuthenticationTransaction({
      oidcConfig: TEST_OIDC_CONFIG,
      tokenOptions: { scope: "openid", useRefreshToken: false, maxAge: 0 },
      clientId: TEST_CLIENT_ID,
      authenticationRequestParams: {},
    });

    await transaction.requestAuthChallenge();
    await transaction.cancelAuthChallenge();

    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
