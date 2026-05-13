import { afterEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import { AuthenticationTransaction } from "../../src/AuthenticationTransaction";
import * as api from "../../src/api";
import type { IdaasContext } from "../../src/IdaasContext";
import { RbaClient } from "../../src/RbaClient";
import type { StorageManager } from "../../src/storage/StorageManager";
import * as urlUtils from "../../src/utils/url";
import { TEST_CLIENT_ID, TEST_ENCODED_TOKEN, TEST_ISSUER_URI, TEST_OIDC_CONFIG } from "./constants";

const createContext = () =>
  ({
    issuerUrl: TEST_ISSUER_URI,
    clientId: TEST_CLIENT_ID,
    tokenOptions: {
      scope: "openid profile",
      useRefreshToken: false,
      maxAge: 0,
      acrValues: [],
      audience: undefined,
    },
    getConfig: mock(async () => TEST_OIDC_CONFIG),
  }) as unknown as IdaasContext;

const createStorageManager = () =>
  ({
    saveIdToken: mock(() => {}),
    saveAccessToken: mock(() => {}),
    saveIdaasSessionToken: mock(() => {}),
    remove: mock(() => {}),
    getIdaasSessionToken: mock(() => ({ token: "session-token" })),
  }) as unknown as StorageManager;

describe("RbaClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("initializes a transaction and requests a challenge", async () => {
    const context = createContext();
    const storage = createStorageManager();
    const requestSpy = spyOn(AuthenticationTransaction.prototype, "requestAuthChallenge").mockResolvedValue({
      token: "session-token",
    });
    const client = new RbaClient(context, storage);

    const response = await client.requestChallenge({ userId: "user" });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ token: "session-token" });
  });

  it("throws if submit is called without an active transaction", async () => {
    const client = new RbaClient(createContext(), createStorageManager());

    await expect(client.submitChallenge()).rejects.toThrow("No authentication transaction in progress!");
  });

  it("saves the session token when submission does not complete authentication", async () => {
    const context = createContext();
    const storage = createStorageManager();
    spyOn(AuthenticationTransaction.prototype, "requestAuthChallenge").mockResolvedValue({ token: "session-token" });
    spyOn(AuthenticationTransaction.prototype, "submitAuthChallenge").mockResolvedValue({
      token: "session-token",
      authenticationCompleted: false,
    });
    const client = new RbaClient(context, storage);

    await client.requestChallenge({ userId: "user" });
    await client.submitChallenge({ response: "code" });

    expect(storage.saveIdaasSessionToken).toHaveBeenCalledWith({ token: "session-token" });
    expect(storage.saveIdToken).not.toHaveBeenCalled();
  });

  it("throws if poll is called without an active transaction", async () => {
    const client = new RbaClient(createContext(), createStorageManager());

    await expect(client.poll()).rejects.toThrow("No authentication transaction in progress!");
  });

  it("throws if cancel is called without an active transaction", async () => {
    const client = new RbaClient(createContext(), createStorageManager());

    await expect(client.cancel()).rejects.toThrow("No authentication transaction in progress!");
  });

  it("logs out silently when a session token exists", async () => {
    const context = createContext();
    const storage = createStorageManager();
    const logoutSpy = spyOn(api, "logoutSilently").mockResolvedValue();
    const client = new RbaClient(context, storage);

    await client.logout();

    expect(logoutSpy).toHaveBeenCalledWith("session-token", "https://testing.com");
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it("skips silent logout when no session token exists", async () => {
    const context = createContext();
    const storage = createStorageManager();
    (storage.getIdaasSessionToken as ReturnType<typeof mock>).mockReturnValue(undefined);
    const logoutSpy = spyOn(api, "logoutSilently").mockResolvedValue();
    const client = new RbaClient(context, storage);

    await client.logout();

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it("stores tokens when authentication completes", async () => {
    const context = createContext();
    const storage = createStorageManager();
    const client = new RbaClient(context, storage);

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

    await client.requestChallenge({
      userId: "user",
      strict: true,
      preferredAuthenticationMethod: "PASSWORD",
    });

    await client.submitChallenge({ response: "secret" });

    expect(storage.saveIdToken).toHaveBeenCalledWith(expect.objectContaining({ encoded: TEST_ENCODED_TOKEN }));
    expect(storage.saveAccessToken).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "access" }));
  });
});
