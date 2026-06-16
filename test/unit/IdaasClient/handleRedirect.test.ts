import { afterAll, afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import * as jwt from "../../../src/utils/jwt";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  TEST_ACCESS_TOKEN,
  TEST_ACCESS_TOKEN_KEY,
  TEST_ACR_CLAIM,
  TEST_BASE_URI,
  TEST_CLIENT_ID,
  TEST_CODE,
  TEST_ID_TOKEN_KEY,
  TEST_ID_TOKEN_OBJECT,
  TEST_SCOPE,
  TEST_STATE,
  TEST_TOKEN_PAIR,
  TEST_TOKEN_PARAMS,
} from "../constants";
import { mockFetch, storeData } from "../helpers";

describe("IdaasClient.handleRedirect", () => {
  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  spyOn(jwt, "readAccessToken").mockImplementation(() => {
    return {
      sub: "testingsubclaim",
      acr: TEST_ACR_CLAIM,
      nbf: "0",
      exp: "9999999999",
      iat: "0",
      iss: TEST_BASE_URI,
      jti: "testing-jti",
    };
  });
  // Mock JWT validation to avoid complex crypto operations in tests
  const spyOnValidateIdToken = spyOn(jwt, "validateIdToken").mockImplementation(async () => {
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

    test("throws error if client params are not stored", () => {
      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      }).toThrowError("client");
    });

    test("throws error if state does not match stored state", () => {
      storeData({ clientParams: true });
      window.location.href = `${TEST_BASE_URI}?code=${TEST_CODE}&state=different_state`;

      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      }).toThrowError();
    });

    test("makes a fetch request to the token endpoint", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      const fetchRequests = spyOnFetch.mock.calls;
      const requestToTokenEndpoint = fetchRequests.find((request) => request.includes(`${TEST_BASE_URI}/token`));

      expect(requestToTokenEndpoint).toBeTruthy();
    });

    test("throws error if no token params stored", () => {
      storeData({ clientParams: true });
      window.location.href = loginSuccessUrl;

      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      }).toThrowError();
    });

    test("removes tokenParams from storage after processing", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(localStorage.getItem(TEST_TOKEN_PAIR.key)).toBeNull();
    });

    test("removes tokenParams from storage when redirect handling fails", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = `${TEST_BASE_URI}?code=${TEST_CODE}&state=different_state`;

      await expect(NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect()).rejects.toThrowError();

      expect(localStorage.getItem(TEST_TOKEN_PAIR.key)).toBeNull();
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

    test("stores access token with correct scope, audience, and acr", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      // @ts-expect-error accessing private var
      const storedToken = NO_DEFAULT_IDAAS_CLIENT.storageManager.getAccessTokens()[0];

      expect(storedToken?.scope).toStrictEqual(TEST_SCOPE);
      expect(storedToken?.audience).toStrictEqual(TEST_TOKEN_PARAMS.audience);
      expect(storedToken?.acr).toStrictEqual(TEST_ACR_CLAIM);
      expect(storedToken?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("stores ID token with decoded claims", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();
      // @ts-expect-error accessing private var
      const storedToken = NO_DEFAULT_IDAAS_CLIENT.storageManager.getIdToken();

      expect(storedToken).toBeDefined();
      expect(storedToken?.decoded).toBeDefined();
      expect(storedToken?.encoded).toBeDefined();
    });

    test("passes requested acr values to id token validation", async () => {
      const requestedAcrValues = "1 2";
      localStorage.setItem(
        TEST_TOKEN_PAIR.key,
        JSON.stringify({ ...TEST_TOKEN_PARAMS, acrValues: requestedAcrValues, requireIdToken: true }),
      );
      storeData({ clientParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(spyOnValidateIdToken).toHaveBeenCalledWith(expect.objectContaining({ requestedAcrValues: ["1", "2"] }));
    });

    test("preserves existing ID token when openid scope is omitted", async () => {
      const tokenResponseWithoutIdToken = {
        access_token: TEST_ACCESS_TOKEN,
        expires_in: "300",
        token_type: "Bearer",
      };

      localStorage.setItem(
        TEST_TOKEN_PAIR.key,
        JSON.stringify({ ...TEST_TOKEN_PARAMS, scope: "profile email", requireIdToken: false }),
      );
      storeData({ clientParams: true, idToken: true });
      window.location.href = loginSuccessUrl;

      // @ts-expect-error not full type
      spyOn(window, "fetch").mockImplementation((url: string) => {
        if (url === `${TEST_BASE_URI}/token`) {
          return Promise.resolve({
            json: () => Promise.resolve(tokenResponseWithoutIdToken),
          } as Response);
        }

        return mockFetch(url);
      });

      await NO_DEFAULT_IDAAS_CLIENT.oidc.handleRedirect();

      expect(spyOnValidateIdToken).not.toHaveBeenCalled();
      expect(localStorage.getItem(TEST_ID_TOKEN_KEY)).not.toBeNull();
      expect(localStorage.getItem(TEST_ACCESS_TOKEN_KEY)).not.toBeNull();
    });
  });
});
