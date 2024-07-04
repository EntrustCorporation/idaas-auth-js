import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { LoginOptions } from "../../src";
import type { AccessToken } from "../../src/PersistenceManager";
import type { TokenResponse } from "../../src/api";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  SET_DEFAULTS_IDAAS_CLIENT,
  TEST_ACCESS_PAIR,
  TEST_ACCESS_TOKEN,
  TEST_ACCESS_TOKEN_OBJECT,
  TEST_AUDIENCE,
  TEST_DIFFERENT_ACCESS_TOKEN,
  TEST_DIFFERENT_AUDIENCE,
  TEST_DIFFERENT_SCOPE,
  TEST_SCOPE,
} from "../constants";
import { mockFetch } from "../helpers";

describe("IdaasClient.getAccessToken", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  // @ts-ignore private
  const spyOnGetAccessTokens = spyOn(NO_DEFAULT_IDAAS_CLIENT.persistenceManager, "getAccessTokens");
  // @ts-ignore not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  const storeToken = (token: AccessToken) => {
    // @ts-ignore private method call
    NO_DEFAULT_IDAAS_CLIENT.persistenceManager.saveAccessToken(token);
  };

  test("fetches stored access tokens from persistenceManager", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.getAccessToken();
    expect(spyOnGetAccessTokens).toBeCalled();
  });

  test("returns null when no access tokens stored", async () => {
    expect(await NO_DEFAULT_IDAAS_CLIENT.getAccessToken()).toBeNull();
    expect(spyOnGetAccessTokens.mock.results[0].value).toBeUndefined();
  });

  describe("fallback options", () => {
    const spyOnLogin = spyOn(NO_DEFAULT_IDAAS_CLIENT, "login").mockImplementation(async () => "test");

    test("throws error if no suitable tokens and `fallback` is undefined", () => {
      storeToken(TEST_ACCESS_TOKEN_OBJECT);

      expect(async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken();
      }).toThrowError();
    });

    test("calls login with `popup: true` if `fallback` === `popup`", async () => {
      storeToken(TEST_ACCESS_TOKEN_OBJECT);
      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ fallback: "popup" });

      const loginRequest = spyOnLogin.mock.calls[0][0] as LoginOptions;
      expect(loginRequest.popup).toBeTrue();
    });

    test("calls login with `popup: false` if `fallback` === `redirect`", async () => {
      storeToken(TEST_ACCESS_TOKEN_OBJECT);
      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ fallback: "redirect" });

      const loginRequest = spyOnLogin.mock.calls[0][0] as LoginOptions;
      expect(loginRequest.popup).toBeFalse();
    });
  });

  test("uses audience provided if present", async () => {
    storeToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      audience: TEST_DIFFERENT_AUDIENCE,
      accessToken: TEST_DIFFERENT_ACCESS_TOKEN,
    });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_DIFFERENT_AUDIENCE });

    expect(token).toStrictEqual(TEST_DIFFERENT_ACCESS_TOKEN);
  });

  test("uses scope provided if present", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: TEST_DIFFERENT_SCOPE, accessToken: TEST_DIFFERENT_ACCESS_TOKEN });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
      scope: TEST_DIFFERENT_SCOPE,
      audience: TEST_AUDIENCE,
    });

    expect(token).toStrictEqual(TEST_DIFFERENT_ACCESS_TOKEN);
  });

  test("can fetch tokens that do not have an audience (opaque tokens)", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, audience: undefined, accessToken: TEST_DIFFERENT_ACCESS_TOKEN });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken();

    expect(token).toStrictEqual(TEST_DIFFERENT_ACCESS_TOKEN);
  });

  test("if multiple suitable tokens, returns the one with the fewest permissions", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: "1 2 3 4 5", accessToken: "fiveScopes" });
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: "1 2 3", accessToken: "threeScopes" });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ scope: "1 2 3", audience: TEST_AUDIENCE });

    expect(token).toStrictEqual("threeScopes");
  });

  test("returns the token that has all requested scopes", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: "1 2 3 4 5", accessToken: "fiveScopes" });
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: "1 2 3", accessToken: "threeScopes" });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ scope: "1 2 3 4", audience: TEST_AUDIENCE });

    expect(token).toStrictEqual("fiveScopes");
  });

  test("removes a token with the requested scopes and audience that is expired and non-refreshable", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0, accessToken: "expiredToken", refreshToken: undefined });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

    expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key)).length).toBe(1);
    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });

  test("refreshes a token with the requested scopes and audience that is expired and refreshable", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0, scope: "1" });
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, accessToken: "notRefreshed", scope: "1 2" });

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ scope: "1", audience: TEST_AUDIENCE });

    expect(spyOnFetch).toBeCalled();
    const grantType = spyOnFetch.mock.calls[1][1].body
      .toString()
      .split("&")
      .find((str) => str.includes("grant_type"))
      .split("=")[1];

    expect(grantType).toStrictEqual("refresh_token");
    expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key)).length).toBe(2);
    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });

  describe("refresh token validity", () => {
    test("refreshing a token does not change the number of tokens stored", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });
      const numTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key)).length;

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key)).length).toBe(numTokens);
    });

    test("the refreshed token's expiration time is calculated correctly", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key));
      const refreshedToken = storedTokens[0];
      const response = (await spyOnFetch.mock.results[1].value) as Response;
      const tokenResponse = (await response.json()) as TokenResponse;
      const expiresIn = Number.parseInt(tokenResponse.expires_in);
      const correctExpiration = expiresIn + Math.floor(Date.now() / 1000);

      expect(refreshedToken.expiresAt).toBe(correctExpiration);
    });

    test("the refreshed token maintains the previous token's scope and audience", async () => {
      storeToken({
        ...TEST_ACCESS_TOKEN_OBJECT,
        expiresAt: 0,
        accessToken: TEST_DIFFERENT_ACCESS_TOKEN,
        scope: TEST_DIFFERENT_SCOPE,
        audience: TEST_DIFFERENT_AUDIENCE,
      });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ scope: TEST_DIFFERENT_SCOPE, audience: TEST_DIFFERENT_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key));
      const refreshedToken = storedTokens[0] as AccessToken;

      expect(refreshedToken.accessToken).not.toStrictEqual(TEST_DIFFERENT_ACCESS_TOKEN);
      expect(refreshedToken.scope).toStrictEqual(TEST_DIFFERENT_SCOPE);
      expect(refreshedToken.audience).toStrictEqual(TEST_DIFFERENT_AUDIENCE);
    });

    test("the refreshed token has the refresh token from the response", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key));
      const refreshedToken = storedTokens[0];
      const response = (await spyOnFetch.mock.results[1].value) as Response;
      const tokenResponse = (await response.json()) as TokenResponse;

      expect(refreshedToken.refreshToken).toStrictEqual(tokenResponse.refresh_token);
    });

    test("the refreshed token has the access token from the response", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key));
      const refreshedToken = storedTokens[0];
      const response = (await spyOnFetch.mock.results[1].value) as Response;
      const tokenResponse = (await response.json()) as TokenResponse;

      expect(refreshedToken.accessToken).toStrictEqual(tokenResponse.access_token);
    });
  });

  test("uses IdaasClient's defaultAudience if audience not provided in params", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, audience: TEST_DIFFERENT_AUDIENCE });
    const token = await SET_DEFAULTS_IDAAS_CLIENT.getAccessToken({ scope: TEST_SCOPE });

    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });

  test("uses IdaasClient's defaultScope if scope not provided in params", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, scope: TEST_DIFFERENT_SCOPE });
    const token = await SET_DEFAULTS_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });
});
