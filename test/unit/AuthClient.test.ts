import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { Onfido } from "onfido-sdk-ui";
import { AuthClient } from "../../src/AuthClient";
import type { RbaClient } from "../../src/RbaClient";
import * as browserUtils from "../../src/utils/browser";

const createRbaClient = () => {
  const requestChallenge = mock(async () => ({}));
  const submitChallenge = mock(async () => ({}));
  const poll = mock(async () => ({ authenticationCompleted: true }));
  const cancel = mock(async () => {});
  const logout = mock(async () => {});

  return {
    rbaClient: { requestChallenge, submitChallenge, poll, cancel, logout } as unknown as RbaClient,
    requestChallenge,
    submitChallenge,
    poll,
    cancel,
    logout,
  };
};

describe("AuthClient", () => {
  const originalPublicKeyCredential = globalThis.PublicKeyCredential;
  const originalCredentialsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "credentials");
  const originalOnfidoInit = Onfido.init;
  const createOnfidoHandle = () => ({
    addEventListener: mock(() => {}),
    removeEventListener: mock(() => {}),
    tearDown: mock(async () => {}),
  });
  let browserSpy: ReturnType<typeof spyOn> | undefined;

  afterEach(() => {
    if (originalPublicKeyCredential) {
      Object.defineProperty(globalThis, "PublicKeyCredential", {
        value: originalPublicKeyCredential,
        configurable: true,
      });
    } else {
      // @ts-expect-error delete only used in tests
      delete globalThis.PublicKeyCredential;
    }

    if (originalCredentialsDescriptor) {
      Object.defineProperty(window.navigator, "credentials", originalCredentialsDescriptor);
    } else {
      // @ts-expect-error delete only used in tests
      delete window.navigator.credentials;
    }

    browserSpy?.mockRestore();
    browserSpy = undefined;
    Onfido.init = originalOnfidoInit;
  });

  it("authenticates with password via request + submit", async () => {
    const { rbaClient, requestChallenge, submitChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.password("user@example.com", "secret");

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });
    expect(submitChallenge).toHaveBeenCalledWith({ response: "secret" });
  });

  it("requests token challenge for soft token when push is false", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.softToken("user@example.com");

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "TOKEN",
    });
    expect(poll).not.toHaveBeenCalled();
  });

  it("polls immediately for soft token push without mutual challenge", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    const client = new AuthClient(rbaClient);

    const response = await client.softToken("user@example.com", { push: true });

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "TOKENPUSH",
    });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ authenticationCompleted: true });
  });

  it("returns challenge for soft token push with mutual challenge", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({ pollForCompletion: true });
    const client = new AuthClient(rbaClient);

    const response = await client.softToken("user@example.com", { push: true, mutualChallenge: true });

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "TOKENPUSH",
      softTokenPushOptions: { mutualChallenge: true },
    });
    expect(poll).not.toHaveBeenCalled();
    expect(response).toEqual({ pollForCompletion: true });
  });

  it("requests an OTP challenge with delivery options", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.otp("user@example.com", { otpDeliveryType: "SMS", otpDeliveryAttribute: "work" });

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "OTP",
      otpOptions: { otpDeliveryType: "SMS", otpDeliveryAttribute: "work" },
    });
  });

  it("requests grid and kba challenges", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.grid("user@example.com");
    await client.kba("user@example.com");

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "GRID",
    });
    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "KBA",
    });
  });

  it("requests then submits a temp access code", async () => {
    const { rbaClient, requestChallenge, submitChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.tempAccessCode("user@example.com", "123456");

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "TEMP_ACCESS_CODE",
    });
    expect(submitChallenge).toHaveBeenCalledWith({ response: "123456" });
  });

  it("requests then polls for magic link authentication", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.magicLink("user@example.com");

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "MAGICLINK",
    });
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("requests then polls for smart credential push authentication", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.smartCredential("user@example.com", { summary: "Approve login", pushMessageIdentifier: "custom" });

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "SMARTCREDENTIALPUSH",
      smartCredentialOptions: {
        summary: "Approve login",
        pushMessageIdentifier: "custom",
      },
    });
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("throws when passkey is unsupported", async () => {
    const { rbaClient } = createRbaClient();
    const client = new AuthClient(rbaClient);
    browserSpy = spyOn(browserUtils, "browserSupportsPasskey").mockResolvedValue(false);

    await expect(client.passkey()).rejects.toThrow("This browser does not support passkey");
  });

  it("submits passkey response when available", async () => {
    const { rbaClient, requestChallenge, submitChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);
    browserSpy = spyOn(browserUtils, "browserSupportsPasskey").mockResolvedValue(true);

    class PublicKeyCredentialMock {}
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      value: PublicKeyCredentialMock,
      configurable: true,
    });

    const credential = new PublicKeyCredentialMock() as PublicKeyCredential;
    const getCredentials = mock(async () => credential);
    Object.defineProperty(window.navigator, "credentials", {
      value: { get: getCredentials },
      configurable: true,
    });

    requestChallenge.mockResolvedValueOnce({ passkeyChallenge: { challenge: "challenge" } });

    await client.passkey("user@example.com");

    expect(browserSpy).toHaveBeenCalledTimes(1);
    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "FIDO",
    });
    expect(getCredentials).toHaveBeenCalledWith({ publicKey: { challenge: "challenge" } });
    expect(submitChallenge).toHaveBeenCalledWith({ passkeyResponse: credential });
  });

  it("submits passkey response for usernameless flow", async () => {
    const { rbaClient, requestChallenge, submitChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);
    browserSpy = spyOn(browserUtils, "browserSupportsPasskey").mockResolvedValue(true);

    class PublicKeyCredentialMock {}
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      value: PublicKeyCredentialMock,
      configurable: true,
    });

    const credential = new PublicKeyCredentialMock() as PublicKeyCredential;
    const getCredentials = mock(async () => credential);
    Object.defineProperty(window.navigator, "credentials", {
      value: { get: getCredentials },
      configurable: true,
    });

    requestChallenge.mockResolvedValueOnce({ passkeyChallenge: { challenge: "challenge" } });

    await client.passkey();

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: undefined,
      strict: true,
      preferredAuthenticationMethod: "PASSKEY",
    });
    expect(getCredentials).toHaveBeenCalledWith({ publicKey: { challenge: "challenge" } });
    expect(submitChallenge).toHaveBeenCalledWith({ passkeyResponse: credential });
  });

  it("throws when no passkey challenge is provided", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);
    browserSpy = spyOn(browserUtils, "browserSupportsPasskey").mockResolvedValue(true);

    requestChallenge.mockResolvedValueOnce({});

    await expect(client.passkey("user@example.com")).rejects.toThrow(
      "No publicKeyCredentialRequestOptions returned for passkey authentication.",
    );
  });

  it("throws when passkey credential is not returned", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    const client = new AuthClient(rbaClient);
    browserSpy = spyOn(browserUtils, "browserSupportsPasskey").mockResolvedValue(true);

    class PublicKeyCredentialMock {}
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      value: PublicKeyCredentialMock,
      configurable: true,
    });

    const getCredentials = mock(async () => ({}));
    Object.defineProperty(window.navigator, "credentials", {
      value: { get: getCredentials },
      configurable: true,
    });

    requestChallenge.mockResolvedValueOnce({ passkeyChallenge: { challenge: "challenge" } });

    await expect(client.passkey("user@example.com")).rejects.toThrow("No credential was returned.");
  });

  it("returns the challenge response for non-web face biometric flows with mutual challenge", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({
      faceChallenge: { device: "MOBILE" },
    });
    const client = new AuthClient(rbaClient);

    const response = await client.faceBiometric("user@example.com", { mutualChallenge: true });

    expect(requestChallenge).toHaveBeenCalledWith({
      userId: "user@example.com",
      strict: true,
      preferredAuthenticationMethod: "FACE",
      faceBiometricOptions: { mutualChallenge: true },
    });
    expect(poll).not.toHaveBeenCalled();
    expect(response).toEqual({ faceChallenge: { device: "MOBILE" } });
  });

  it("polls for completion when face biometric is non-web and no mutual challenge", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({
      faceChallenge: { device: "MOBILE" },
    });
    const client = new AuthClient(rbaClient);

    await client.faceBiometric("user@example.com");

    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("handles web face biometric flow with Onfido", async () => {
    const { rbaClient, requestChallenge, poll } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({
      faceChallenge: { device: "WEB", sdkToken: "sdk-token", workflowRunId: "run-id" },
    });
    const client = new AuthClient(rbaClient);

    const instance = createOnfidoHandle();
    Onfido.init = mock((config) => {
      Promise.resolve().then(() => config.onComplete?.());
      return instance;
    }) as unknown as typeof Onfido.init;

    const response = await client.faceBiometric("user@example.com");

    expect(Onfido.init).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "sdk-token",
        workflowRunId: "run-id",
        containerId: "onfido-mount",
      }),
    );
    expect(poll).toHaveBeenCalledTimes(1);
    expect(instance.tearDown).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ authenticationCompleted: true });
  });

  it("rejects when Onfido reports an error", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({
      faceChallenge: { device: "WEB", sdkToken: "sdk-token", workflowRunId: "run-id" },
    });
    const client = new AuthClient(rbaClient);

    Onfido.init = mock((config) => {
      config.onError?.(new Error("onfido-failed"));
      return createOnfidoHandle();
    }) as unknown as typeof Onfido.init;

    await expect(client.faceBiometric("user@example.com")).rejects.toThrow("onfido-failed");
  });

  it("throws if face challenge data is missing", async () => {
    const { rbaClient, requestChallenge } = createRbaClient();
    requestChallenge.mockResolvedValueOnce({});
    const client = new AuthClient(rbaClient);

    await expect(client.faceBiometric("user@example.com")).rejects.toThrow(
      "Face challenge data is missing in the authentication response.",
    );
  });

  it("proxies submit, poll, cancel, and logout", async () => {
    const { rbaClient, submitChallenge, poll, cancel, logout } = createRbaClient();
    const client = new AuthClient(rbaClient);

    await client.submit({ response: "code" });
    await client.poll();
    await client.cancel();
    await client.logout();

    expect(submitChallenge).toHaveBeenCalledWith({
      response: "code",
      passkeyResponse: undefined,
      kbaChallengeAnswers: undefined,
    });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
