import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { ValidatedTokenResponse } from "../../src/IdaasClient";
import type { AuthorizeResponse } from "../../src/models";
import * as jwt from "../../src/utils/jwt";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  TEST_BASE_URI,
  TEST_CLIENT_ID,
  TEST_CODE,
  TEST_ID_TOKEN_OBJECT,
  TEST_STATE,
  TEST_TOKEN_PARAMS,
} from "../constants";
import { mockFetch, storeData } from "../helpers";

describe("IdaasClient.handleRedirect", () => {
  // @ts-ignore not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  // @ts-ignore private method
  const spyOnParseRedirectSearchParams = spyOn(NO_DEFAULT_IDAAS_CLIENT, "parseRedirectSearchParams");
  // @ts-ignore private method
  const spyOnValidateAuthorizeResponse = spyOn(NO_DEFAULT_IDAAS_CLIENT, "validateAuthorizeResponse");
  // @ts-ignore private method
  const spyOnParseAndSaveTokenResponse = spyOn(NO_DEFAULT_IDAAS_CLIENT, "parseAndSaveTokenResponse");
  const spyOnValidateIdToken = spyOn(jwt, "validateIdToken").mockImplementation(() => {
    return { decodedJwt: TEST_ID_TOKEN_OBJECT.decoded, idToken: TEST_ID_TOKEN_OBJECT.encoded };
  });
  const successUrl = `${TEST_BASE_URI}?code=${TEST_CODE}&state=${TEST_STATE}`;
  const startLocation = window.location.href;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    window.location.href = startLocation;
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("returns early if no search params in uri", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnParseRedirectSearchParams).toBeCalled();
    expect(spyOnParseRedirectSearchParams.mock.results[0].value).toBeNull();
    expect(spyOnValidateAuthorizeResponse).not.toBeCalled();
    expect(spyOnParseAndSaveTokenResponse).not.toBeCalled();
  });

  test("return early if no state in uri", async () => {
    window.location.href = `${TEST_BASE_URI}?code=code`;
    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnParseRedirectSearchParams).toBeCalled();
    expect(spyOnParseRedirectSearchParams.mock.results[0].value).toBeNull();
    expect(spyOnValidateAuthorizeResponse).not.toBeCalled();
    expect(spyOnParseAndSaveTokenResponse).not.toBeCalled();
  });

  test("returns early if no error and code not in uri", async () => {
    window.location.href = `${TEST_BASE_URI}?state=state`;
    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnParseRedirectSearchParams).toBeCalled();
    expect(spyOnParseRedirectSearchParams.mock.results[0].value).toBeNull();
    expect(spyOnValidateAuthorizeResponse).not.toBeCalled();
    expect(spyOnParseAndSaveTokenResponse).not.toBeCalled();
  });

  test("throws error if client params not stored", () => {
    window.location.href = successUrl;

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
    }).toThrowError();
  });

  test("throws error if error found in search params", () => {
    storeData({ clientParams: true });
    window.location.href = `${TEST_BASE_URI}?state=state&error=error`;

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
    }).toThrowError();

    const validationResultType = spyOnValidateAuthorizeResponse.mock.results[0].type;
    const response = spyOnParseRedirectSearchParams.mock.results[0].value as AuthorizeResponse | null;

    expect(validationResultType).toStrictEqual("throw");
    expect(response.error).toStrictEqual("error");
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

  test("makes a fetch request to the token endpoint", async () => {
    storeData({ clientParams: true, tokenParams: true });
    window.location.href = successUrl;

    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    const fetchRequests = spyOnFetch.mock.calls;
    const requestToTokenEndpoint = fetchRequests.find((request) => request.includes(`${TEST_BASE_URI}/token`));

    expect(requestToTokenEndpoint).toBeTruthy();
  });

  test("validateIdToken is called", async () => {
    storeData({ clientParams: true, tokenParams: true });
    window.location.href = successUrl;

    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnValidateIdToken).toBeCalled();
  });

  test("parseAndValidateTokens is called", async () => {
    storeData({ clientParams: true, tokenParams: true });
    window.location.href = successUrl;

    await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

    expect(spyOnParseAndSaveTokenResponse).toBeCalled();
  });

  describe("parseAndValidateTokens", () => {
    test("throws error if no token params stored", () => {
      storeData({ clientParams: true });
      window.location.href = successUrl;

      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      }).toThrowError();

      expect(spyOnParseAndSaveTokenResponse.mock.results[0].type).toStrictEqual("throw");
    });

    test("removes tokenParams from storage", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = successUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(localStorage.getItem(`entrust.tokenParams.${TEST_CLIENT_ID}`)).toBeNull();
    });

    test("stores the given ID token", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = successUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(localStorage.getItem(`entrust.idToken.${TEST_CLIENT_ID}`)).not.toBeNull();
    });

    test("stores the given access token", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = successUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();

      expect(localStorage.getItem(`entrust.accessTokens.${TEST_CLIENT_ID}`)).not.toBeNull();
    });

    test("the access token contains the correct information", async () => {
      storeData({ clientParams: true, tokenParams: true });
      window.location.href = successUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      // @ts-ignore accessing private var
      const storedToken = NO_DEFAULT_IDAAS_CLIENT.persistenceManager.getAccessTokens()[0];
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
      window.location.href = successUrl;

      await NO_DEFAULT_IDAAS_CLIENT.handleRedirect();
      // @ts-ignore accessing private var
      const storedToken = NO_DEFAULT_IDAAS_CLIENT.persistenceManager.getIdToken();
      const validatedTokenResponse = spyOnParseAndSaveTokenResponse.mock.calls[0][0] as ValidatedTokenResponse;
      const { decodedIdToken, encodedIdToken } = validatedTokenResponse;

      expect(decodedIdToken).toStrictEqual(storedToken.decoded);
      expect(encodedIdToken).toStrictEqual(storedToken.encoded);
    });
  });
});
