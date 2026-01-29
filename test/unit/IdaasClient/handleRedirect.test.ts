import { afterAll, afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import * as jwt from "../../../src/utils/jwt";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  TEST_ACCESS_TOKEN_KEY,
  TEST_BASE_URI,
  TEST_CODE,
  TEST_ID_TOKEN_KEY,
  TEST_ID_TOKEN_OBJECT,
  TEST_SCOPE,
  TEST_STATE,
  TEST_TOKEN_PARAMS,
  TEST_TOKEN_PARAMS_KEY,
} from "../constants";
import { mockFetch, storeData } from "../helpers";

describe("IdaasClient.handleRedirect", () => {
  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  // Mock JWT validation to avoid complex crypto operations in tests
  spyOn(jwt, "validateIdToken").mockImplementation(() => {
    return { decodedJwt: TEST_ID_TOKEN_OBJECT.decoded, idToken: TEST_ID_TOKEN_OBJECT.encoded };
  });
  const loginSuccessUrl = `${TEST_BASE_URI}?code=${TEST_CODE}&state=${TEST_STATE}`;
  const startLocation = window.location.href;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    window.location.href = startLocation;
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("returns null when there are no search params in url", async () => {
    window.location.href = TEST_BASE_URI;

    const result = await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

    expect(result).toBeNull();
  });

  test("returns null when URL has code but no state", async () => {
    window.location.href = `${TEST_BASE_URI}?code=code`;
    const result = await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

    expect(result).toBeNull();
  });

  test("returns null when URL has state but no code", async () => {
    window.location.href = `${TEST_BASE_URI}?state=state`;
    const result = await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

    expect(result).toBeNull();
  });

  describe("successful authorization flow", () => {
    beforeEach(() => {
      window.location.href = loginSuccessUrl;
    });

    test("throws error if client params are not stored", async () => {
      await expect(NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect()).rejects.toThrow("client");
    });

    test("throws error if state does not match stored state", async () => {
      storeData({ clientParams: true });
      window.location.href = `${TEST_BASE_URI}?code=${TEST_CODE}&state=different_state`;

      await expect(NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect()).rejects.toThrow();
    });

    test("throws error if authorization response contains an error", async () => {
      storeData({ clientParams: true });
      window.location.href = `${TEST_BASE_URI}?state=${TEST_STATE}&error=access_denied&error_description=Denied`;

      await expect(NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect()).rejects.toThrow("Error during authorization");
    });

    test("clears query params from the URL after parsing", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;
      const replaceSpy = spyOn(window.history, "replaceState");

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(replaceSpy).toHaveBeenCalledTimes(1);
      const [, , url] = replaceSpy.mock.calls[0] ?? [];
      const cleanedUrl = new URL(url as string);

      expect(cleanedUrl.search).toBe("");
      expect(cleanedUrl.origin).toBe(new URL(TEST_BASE_URI).origin);
    });

    test("makes a fetch request to the token endpoint", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      const fetchRequests = spyOnFetch.mock.calls;
      const requestToTokenEndpoint = fetchRequests.find((request) => request.includes(`${TEST_BASE_URI}/token`));

      expect(requestToTokenEndpoint).toBeTruthy();
    });

    test("throws error if no token params stored", async () => {
      storeData({ clientParams: true });
      window.location.href = loginSuccessUrl;

      await expect(NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect()).rejects.toThrow();
    });

    test("removes tokenParams from storage after processing", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(localStorage.getItem(TEST_TOKEN_PARAMS_KEY)).toBeNull();
    });

    test("stores the ID token", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(localStorage.getItem(TEST_ID_TOKEN_KEY)).not.toBeNull();
    });

    test("stores the access token", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(localStorage.getItem(TEST_ACCESS_TOKEN_KEY)).not.toBeNull();
    });

    test("stores access token with correct scope and audience", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_TOKEN_KEY) as string);
      const storedToken = storedTokens[0];

      expect(storedToken?.scope).toStrictEqual(TEST_SCOPE);
      expect(storedToken?.audience).toStrictEqual(TEST_TOKEN_PARAMS.audience);
      expect(storedToken?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("stores ID token with decoded claims", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      const storedToken = JSON.parse(localStorage.getItem(TEST_ID_TOKEN_KEY) as string);

      expect(storedToken).toBeDefined();
      expect(storedToken?.decoded).toBeDefined();
      expect(storedToken?.encoded).toBeDefined();
    });
  });
});
