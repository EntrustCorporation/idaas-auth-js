import { afterAll, afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { ValidatedTokenResponse } from "../../../src/IdaasClient";
import * as format from "../../../src/utils/format";
import * as jwt from "../../../src/utils/jwt";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  TEST_ACCESS_TOKEN_KEY,
  TEST_AUTH_RESPONSE,
  TEST_BASE_URI,
  TEST_CLIENT_ID,
  TEST_CODE,
  TEST_ID_TOKEN_KEY,
  TEST_ID_TOKEN_OBJECT,
  TEST_STATE,
  TEST_TOKEN_PARAMS,
} from "../constants";
import { mockFetch, storeData } from "../helpers";

describe("IdaasClient.handleRedirect", () => {
  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  // @ts-expect-error private method
  const spyOnParseRedirect = spyOn(NO_DEFAULT_IDAAS_CLIENT, "parseRedirect");
  // @ts-expect-error private method
  const spyOnParseLoginRedirect = spyOn(NO_DEFAULT_IDAAS_CLIENT, "parseLoginRedirect");
  // @ts-expect-error private method
  const spyOnRequestAndValidateTokens = spyOn(NO_DEFAULT_IDAAS_CLIENT, "requestAndValidateTokens");
  // @ts-expect-error private method
  const spyOnValidateAuthorizeResponse = spyOn(NO_DEFAULT_IDAAS_CLIENT, "validateAuthorizeResponse");
  // @ts-expect-error private method
  const spyOnParseAndSaveTokenResponse = spyOn(NO_DEFAULT_IDAAS_CLIENT, "parseAndSaveTokenResponse");
  // @ts-expect-error private method
  const spyOnCalculateEpochExpiry = spyOn(format, "calculateEpochExpiry");
  const spyOnValidateIdToken = spyOn(jwt, "validateIdToken").mockImplementation(() => {
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

  test("calls `parseRedirect`", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
    expect(spyOnParseRedirect).toBeCalled();
  });

  describe("parseRedirect", () => {
    beforeEach(() => {
      window.location.href = loginSuccessUrl;
      storeData({ clientParams: true, tokenParams: true });
    });
    test("calls `parseLoginRedirect`", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      expect(spyOnParseLoginRedirect).toBeCalled();
    });

    test("returns the result of both parses", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      const authorizeResponse = spyOnParseLoginRedirect.mock.results[0].value;

      expect(spyOnParseRedirect.mock.results[0].value).toStrictEqual({ authorizeResponse });
    });

    test("returns early if there are no search params in url", async () => {
      window.location.href = TEST_BASE_URI;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      expect(spyOnParseLoginRedirect).not.toBeCalled();

      expect(spyOnParseRedirect.mock.results[0].value).toStrictEqual({ authorizeResponse: null });
    });
  });

  describe("parseLoginRedirect", () => {
    test("returns null if state not present in url", async () => {
      window.location.href = `${TEST_BASE_URI}?code=code`;
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnParseLoginRedirect.mock.results[0].value).toBeNull();
    });

    test("returns null if both code and error are not in url", async () => {
      window.location.href = `${TEST_BASE_URI}?state=state`;
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnParseLoginRedirect.mock.results[0].value).toBeNull();
    });

    test("returns the search params found in url", async () => {
      window.location.href = loginSuccessUrl;
      storeData({ clientParams: true, tokenParams: true });
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnParseLoginRedirect.mock.results[0].value).toStrictEqual(TEST_AUTH_RESPONSE);
    });
  });

  test("returns early if authorizeResponse is falsy (null)", async () => {
    window.location.href = TEST_BASE_URI;
    storeData({ tokenParams: true, clientParams: true });
    const result = await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnParseAndSaveTokenResponse).not.toBeCalled();
    expect(result).toBeNull();
  });

  describe("authorization event", () => {
    beforeEach(() => {
      window.location.href = loginSuccessUrl;
    });

    test("throws error if client params are not stored", () => {
      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      }).toThrowError("client");
    });

    test("calls validateAuthorizeResponse", async () => {
      storeData({ clientParams: true, tokenParams: true });
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnValidateAuthorizeResponse).toBeCalled();
    });

    describe("validateAuthorizeResponse", () => {
      test("throws error if error present in search params", () => {
        expect(() => {
          // @ts-expect-error private method
          NO_DEFAULT_IDAAS_CLIENT.validateAuthorizeResponse({ ...TEST_AUTH_RESPONSE, error: "error" }, "testingstate");
        }).toThrowError();
      });

      test("throws error if state not present in search params", () => {
        expect(() => {
          // @ts-expect-error private method
          NO_DEFAULT_IDAAS_CLIENT.validateAuthorizeResponse({ ...TEST_AUTH_RESPONSE, state: null }, "testingstate");
        }).toThrowError();
      });

      test("throws error if code not present in search params", () => {
        expect(() => {
          // @ts-expect-error private method
          NO_DEFAULT_IDAAS_CLIENT.validateAuthorizeResponse({ ...TEST_AUTH_RESPONSE, code: null }, "testingstate");
        }).toThrowError();
      });

      test("throws error if expected state and current state differ", () => {
        storeData({ clientParams: true });
        window.location.href = `${TEST_BASE_URI}?code=${TEST_CODE}&state=different_state`;

        expect(async () => {
          await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
        }).toThrowError();

        const validationResultType = spyOnValidateAuthorizeResponse.mock.results[0].type;
        expect(validationResultType).toStrictEqual("throw");
      });
    });

    test("calls requestAndValidateTokens", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnRequestAndValidateTokens).toBeCalled();
    });

    describe("requestAndValidateTokens", () => {
      test("makes a fetch request to the token endpoint", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

        const fetchRequests = spyOnFetch.mock.calls;
        const requestToTokenEndpoint = fetchRequests.find((request) => request.includes(`${TEST_BASE_URI}/token`));

        expect(requestToTokenEndpoint).toBeTruthy();
      });

      test("calls validateIdToken", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

        expect(spyOnValidateIdToken).toBeCalled();
      });
    });

    test("parseAndSaveTokenResponse is called", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = loginSuccessUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(spyOnParseAndSaveTokenResponse).toBeCalled();
    });

    describe("parseAndSaveTokenResponse", () => {
      test("throws error if no token params stored", () => {
        storeData({ clientParams: true });
        window.location.href = loginSuccessUrl;

        expect(async () => {
          await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
        }).toThrowError();

        expect(spyOnParseAndSaveTokenResponse.mock.results[0].type).toStrictEqual("throw");
      });

      test("removes tokenParams from storage", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

        expect(localStorage.getItem(`entrust.tokenParams.${TEST_CLIENT_ID}`)).toBeNull();
      });

      test("stores the given ID token", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

        expect(localStorage.getItem(TEST_ID_TOKEN_KEY)).not.toBeNull();
      });

      test("stores the given access token", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

        expect(localStorage.getItem(TEST_ACCESS_TOKEN_KEY)).not.toBeNull();
      });

      test("calculateEpochExpiry is called", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
        expect(spyOnCalculateEpochExpiry).toBeCalled();
      });

      describe("calculateEpochExpiry", () => {
        test("calculates correct expiry time using token's auth_time", () => {
          const authTime = 1;
          const expected = authTime + 300;

          const result = format.calculateEpochExpiry("300", authTime.toString());

          expect(result).toStrictEqual(expected);
        });

        test("calculates correct expiry time using default", async () => {
          const expected = Math.floor(Date.now() / 1000) + 300;

          storeData({ clientParams: true, tokenParams: true });
          window.location.href = loginSuccessUrl;

          await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

          expect(spyOnCalculateEpochExpiry.mock.results[0].value).toStrictEqual(expected);
        });
      });

      test("the access token contains the correct information", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
        // @ts-expect-error accessing private var
        const storedToken = NO_DEFAULT_IDAAS_CLIENT.storageManager.getAccessTokens()[0];
        const validatedTokenResponse = spyOnParseAndSaveTokenResponse.mock.calls[0][0] as ValidatedTokenResponse;
        const { tokenResponse } = validatedTokenResponse;

        expect(storedToken.scope).toStrictEqual(tokenResponse.scope);
        expect(storedToken.accessToken).toStrictEqual(tokenResponse.access_token);
        expect(storedToken.refreshToken).toStrictEqual(tokenResponse.refresh_token);
        expect(storedToken.audience).toStrictEqual(TEST_TOKEN_PARAMS.audience);
        expect(storedToken.expiresAt).toStrictEqual(Math.floor(Date.now() / 1000) + 300);
      });

      test("the ID token contains the correct information", async () => {
        storeData({ clientParams: true, tokenParams: true });
        window.location.href = loginSuccessUrl;

        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
        // @ts-expect-error accessing private var
        const storedToken = NO_DEFAULT_IDAAS_CLIENT.storageManager.getIdToken();
        const validatedTokenResponse = spyOnParseAndSaveTokenResponse.mock.calls[0][0] as ValidatedTokenResponse;
        const { decodedIdToken, encodedIdToken } = validatedTokenResponse;

        expect(decodedIdToken).toStrictEqual(storedToken.decoded);
        expect(encodedIdToken).toStrictEqual(storedToken.encoded);
      });
    });
  });
});
