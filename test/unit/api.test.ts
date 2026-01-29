import { afterEach, describe, expect, it, jest, spyOn } from "bun:test";
import {
  fetchOpenidConfiguration,
  getAuthRequestId,
  getUserInfo,
  logoutSilently,
  type OidcConfig,
  queryUserAuthOptions,
  requestAuthChallenge,
  requestToken,
  submitAuthChallenge,
  type TokenResponse,
} from "../../src/api";
import * as openapi from "../../src/models/openapi-ts";
import { TEST_OIDC_CONFIG } from "./constants";

const originalFetch = globalThis.fetch;
const makeRequest = () => new Request("https://example.com");
const makeResponse = () => new Response();

describe("api.ts", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (globalThis.fetch !== originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  describe("fetchOpenidConfiguration", () => {
    const mockFetchJson = (payload: OidcConfig) =>
      spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => payload,
      } as Response);

    it("requests well-known metadata from issuer root", async () => {
      const issuerUrl = "https://example.trustedauth.com";
      const fetchSpy = mockFetchJson({ ...TEST_OIDC_CONFIG, issuer: issuerUrl });

      const result = await fetchOpenidConfiguration(issuerUrl);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.trustedauth.com/.well-known/openid-configuration");
      expect(result).toEqual(expect.objectContaining({ issuer: issuerUrl }));
    });

    it("preserves issuer path when building discovery URL", async () => {
      const issuerUrl = "https://example.com/issuer";
      const fetchSpy = mockFetchJson({ ...TEST_OIDC_CONFIG, issuer: issuerUrl });

      const result = await fetchOpenidConfiguration(issuerUrl);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/issuer/.well-known/openid-configuration");
      expect(result).toEqual(expect.objectContaining({ issuer: issuerUrl }));
    });

    it("trims trailing slashes from issuer", async () => {
      const issuerUrl = "https://example.com///";
      const fetchSpy = mockFetchJson({ ...TEST_OIDC_CONFIG, issuer: issuerUrl });

      const result = await fetchOpenidConfiguration(issuerUrl);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/.well-known/openid-configuration");
      expect(result).toEqual(expect.objectContaining({ issuer: issuerUrl }));
    });

    it("trims surrounding whitespace before building the discovery URL", async () => {
      const issuerUrl = "  https://example.com///  ";
      const payload = { ...TEST_OIDC_CONFIG, issuer: "from-server" };
      const fetchSpy = mockFetchJson(payload);

      const result = await fetchOpenidConfiguration(issuerUrl);

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/.well-known/openid-configuration");
      expect(result).toEqual(payload);
    });
  });

  describe("requestToken", () => {
    it("posts form-encoded parameters to the token endpoint", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({ access_token: "access", token_type: "Bearer", expires_in: "60" }),
      } as Response);

      const result = await requestToken("https://example.com/token", {
        grant_type: "refresh_token",
        refresh_token: "refresh",
        client_id: "client",
      });

      const [, options] = fetchSpy.mock.calls[0] ?? [];
      expect(options?.method).toBe("POST");
      expect(options?.headers).toEqual({
        "Content-Type": "application/x-www-form-urlencoded",
      });
      expect(options?.body?.toString()).toContain("grant_type=refresh_token");
      expect(result.access_token).toBe("access");
    });

    it("returns error payload when the token endpoint responds with an error", async () => {
      const errorBody = {
        access_token: "",
        token_type: "",
        expires_in: "",
        error: "invalid_grant",
        error_description: "refresh token expired",
      } as unknown as TokenResponse;
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        json: async () => errorBody,
      } as Response);

      const result = await requestToken("https://example.com/token", {
        grant_type: "refresh_token",
        refresh_token: "expired",
        client_id: "client",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(errorBody);
    });
  });

  describe("getUserInfo", () => {
    it("fetches user info with a bearer token", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        text: async () => "userinfo",
      } as Response);

      const response = await getUserInfo("https://example.com/userinfo", "access-token");

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/userinfo", {
        method: "GET",
        headers: { Authorization: "Bearer access-token" },
      });
      expect(response).toBe("userinfo");
    });
  });

  describe("queryUserAuthOptions", () => {
    it("returns data when the API succeeds", async () => {
      const params = {
        userId: "user",
        authRequestKey: "key",
        applicationId: "app",
        origin: "https://example.com",
      };
      const querySpy = spyOn(openapi, "userAuthenticatorQueryUsingPost").mockResolvedValueOnce({
        data: { authenticationTypes: ["PASSWORD"], availableSecondFactor: [] },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userAuthenticatorQueryUsingPost>>);

      const response = await queryUserAuthOptions(params, "https://example.com");

      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy).toHaveBeenCalledWith({ baseUrl: "https://example.com", body: { ...params } });
      expect(response.authenticationTypes).toEqual(["PASSWORD"]);
    });

    it("throws when the API returns an error", async () => {
      const params = {
        userId: "user",
        authRequestKey: "key",
        applicationId: "app",
        origin: "https://example.com",
      };
      spyOn(openapi, "userAuthenticatorQueryUsingPost").mockResolvedValueOnce({
        data: undefined,
        error: { errorCode: "ERR", errorMessage: "Bad" },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userAuthenticatorQueryUsingPost>>);

      await expect(queryUserAuthOptions(params, "https://example.com")).rejects.toThrow("ERR");
    });
  });

  describe("requestAuthChallenge", () => {
    it("returns data when the challenge request succeeds", async () => {
      const challengeResponse = { authenticationCompleted: false, transactionId: "txn" };
      const challengeSpy = spyOn(openapi, "userChallengeUsingPost").mockResolvedValueOnce({
        data: challengeResponse,
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userChallengeUsingPost>>);

      const result = await requestAuthChallenge(
        { userId: "user", applicationId: "app", authRequestKey: "key" },
        "PASSWORD",
        "https://example.com",
      );

      expect(challengeSpy).toHaveBeenCalledTimes(1);
      expect(challengeSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        body: { userId: "user", applicationId: "app", authRequestKey: "key" },
        path: { authenticator: "PASSWORD" },
      });
      expect(result).toEqual(challengeResponse);
    });

    it("throws when the challenge API returns an error", async () => {
      const challengeSpy = spyOn(openapi, "userChallengeUsingPost").mockResolvedValueOnce({
        data: undefined,
        error: { errorCode: "ERR", errorMessage: "Bad" },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userChallengeUsingPost>>);

      await expect(
        requestAuthChallenge(
          { userId: "user", applicationId: "app", authRequestKey: "key" },
          "PASSWORD",
          "https://example.com",
        ),
      ).rejects.toThrow("ERR");
      expect(challengeSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        body: { userId: "user", applicationId: "app", authRequestKey: "key" },
        path: { authenticator: "PASSWORD" },
      });
    });
  });

  describe("submitAuthChallenge", () => {
    it("returns data when the submission succeeds", async () => {
      const submitSpy = spyOn(openapi, "userAuthenticateUsingPost").mockResolvedValueOnce({
        data: { authenticationCompleted: true },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userAuthenticateUsingPost>>);

      const response = await submitAuthChallenge(
        { userId: "user", response: "code" },
        "PASSWORD",
        "token",
        "https://example.com",
      );

      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        headers: { Authorization: "token" },
        body: { userId: "user", response: "code" },
        path: { authenticator: "PASSWORD" },
      });
      expect(response.authenticationCompleted).toBe(true);
    });

    it("throws when the submission API returns an error", async () => {
      const submitSpy = spyOn(openapi, "userAuthenticateUsingPost").mockResolvedValueOnce({
        data: undefined,
        error: { errorCode: "ERR", errorMessage: "Bad" },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.userAuthenticateUsingPost>>);

      await expect(
        submitAuthChallenge({ userId: "user", response: "code" }, "PASSWORD", "token", "https://example.com"),
      ).rejects.toThrow("ERR");
      expect(submitSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        headers: { Authorization: "token" },
        body: { userId: "user", response: "code" },
        path: { authenticator: "PASSWORD" },
      });
    });
  });

  describe("logoutSilently", () => {
    it("calls the logout endpoint with a bearer token", async () => {
      const logoutSpy = spyOn(openapi, "logoutUsingPost").mockResolvedValueOnce({
        data: undefined,
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.logoutUsingPost>>);

      await logoutSilently("token", "https://example.com");

      expect(logoutSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        headers: { Authorization: "Bearer token" },
      });
    });

    it("throws when logout fails", async () => {
      const logoutSpy = spyOn(openapi, "logoutUsingPost").mockResolvedValueOnce({
        data: undefined,
        error: { errorCode: "ERR", errorMessage: "Bad" },
        request: makeRequest(),
        response: makeResponse(),
      } as Awaited<ReturnType<typeof openapi.logoutUsingPost>>);

      await expect(logoutSilently("token", "https://example.com")).rejects.toThrow("ERR");
      expect(logoutSpy).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        headers: { Authorization: "Bearer token" },
      });
    });
  });

  describe("getAuthRequestId", () => {
    it("returns auth request data when response is ok", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authRequestKey: "key", applicationId: "app" }),
      } as Response);

      const response = await getAuthRequestId("https://example.com/authorizejwt");

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/authorizejwt", { method: "POST" });
      expect(response).toEqual({ authRequestKey: "key", applicationId: "app" });
    });

    it("throws when response is not ok", async () => {
      spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "bad", error_description: "Bad request" }),
      } as Response);

      await expect(getAuthRequestId("https://example.com/authorizejwt")).rejects.toThrow("Bad request");
    });
  });
});
