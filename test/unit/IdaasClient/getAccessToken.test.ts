import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { OidcLoginOptions } from "../../../src";
import type { TokenResponse } from "../../../src/api";
import type { TokenOptions } from "../../../src/models";
import type { AccessToken } from "../../../src/storage/StorageManager";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  SET_DEFAULTS_IDAAS_CLIENT,
  TEST_ACCESS_PAIR,
  TEST_ACCESS_TOKEN,
  TEST_ACCESS_TOKEN_OBJECT,
  TEST_ACR_CLAIM,
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

  // @ts-expect-error private
  const spyOnPersistenceGetAccessTokens = spyOn(NO_DEFAULT_IDAAS_CLIENT.storageManager, "getAccessTokens");
  // @ts-expect-error private
  const spyOnRemoveUnusableTokens = spyOn(NO_DEFAULT_IDAAS_CLIENT, "removeUnusableTokens");
  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  const storeToken = (token: AccessToken) => {
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken(token);
  };

  test("fetches stored access tokens from storageManager", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
      fallbackAuthorizationOptions: {
        popup: true,
      },
    });
    expect(spyOnPersistenceGetAccessTokens).toBeCalled();
  });

  describe("fallback options", () => {
    const spyOnLogin = spyOn(NO_DEFAULT_IDAAS_CLIENT.oidc, "login").mockImplementation(async () => "test");

    describe("fallback login parameters", () => {
      test("scope specified in getAccessToken param is passed to login", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          scope: TEST_SCOPE,
          fallbackAuthorizationOptions: {},
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as TokenOptions;
        expect(loginRequest.scope).toStrictEqual(TEST_SCOPE);
      });

      test("audience specified in getAccessToken param is passed to login", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          audience: TEST_AUDIENCE,
          fallbackAuthorizationOptions: {},
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as TokenOptions;
        expect(loginRequest.audience).toStrictEqual(TEST_AUDIENCE);
      });

      test("acr values specified in getAccessToken param is passed to login", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          acrValues: [TEST_ACR_CLAIM],
          fallbackAuthorizationOptions: {},
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as TokenOptions;
        expect(loginRequest.acrValues).toStrictEqual([TEST_ACR_CLAIM]);
      });
    });

    describe("with tokens stored", () => {
      test("if no suitable tokens, throws error if `fallbackAuthorizationOptions` is undefined", () => {
        storeToken(TEST_ACCESS_TOKEN_OBJECT);

        expect(async () => {
          await NO_DEFAULT_IDAAS_CLIENT.getAccessToken();
        }).toThrowError();
      });

      test("if no suitable tokens, calls login with `popup: true` if specified in the fallbackAuthorizationOptions", async () => {
        storeToken(TEST_ACCESS_TOKEN_OBJECT);
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          fallbackAuthorizationOptions: {
            popup: true,
          },
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as OidcLoginOptions;
        expect(loginRequest.popup).toBeTrue();
      });

      test("if no suitable tokens, calls login with `popup: false` if specified in the fallbackAuthorizationOptions", async () => {
        storeToken(TEST_ACCESS_TOKEN_OBJECT);
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          fallbackAuthorizationOptions: {
            popup: false,
          },
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as OidcLoginOptions;
        expect(loginRequest.popup).toBeFalse();
      });
    });

    describe("with no tokens stored", () => {
      test("throws error if `fallbackAuthorizationOptions` is undefined", () => {
        expect(async () => {
          await NO_DEFAULT_IDAAS_CLIENT.getAccessToken();
        }).toThrowError();
      });

      test("calls login with `popup: true` if specified in the fallbackAuthorizationOptions", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          fallbackAuthorizationOptions: {
            popup: true,
          },
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as OidcLoginOptions;
        expect(loginRequest.popup).toBeTrue();
      });

      test("calls login with `popup: false` if specified in the fallbackAuthorizationOptions", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({
          fallbackAuthorizationOptions: {
            popup: false,
          },
        });

        const loginRequest = spyOnLogin.mock.calls[0][0] as OidcLoginOptions;
        expect(loginRequest.popup).toBeFalse();
      });
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

  test("returns the token with a requested acr value", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, acr: "correct", accessToken: "correctAcr" });
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, acr: "wrong", accessToken: "wrongAcr" });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ acrValues: ["correct"], audience: TEST_AUDIENCE });

    expect(token).toStrictEqual("correctAcr");
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

  describe("removeUnusableTokens", () => {
    test("calls removeUnusableTokens", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ fallbackAuthorizationOptions: {} });

      expect(spyOnRemoveUnusableTokens).toBeCalled();
    });

    test("removes tokens that have reached their max_age", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, maxAgeExpiry: 1 });
      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ fallbackAuthorizationOptions: {} });

      // @ts-expect-error private
      expect(NO_DEFAULT_IDAAS_CLIENT.storageManager.getAccessTokens()).toStrictEqual([]);
    });

    test("keeps tokens that have not reached their max_age", async () => {
      storeToken(TEST_ACCESS_TOKEN_OBJECT);
      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ fallbackAuthorizationOptions: {} });

      // @ts-expect-error private
      expect(NO_DEFAULT_IDAAS_CLIENT.storageManager.getAccessTokens()).toStrictEqual([TEST_ACCESS_TOKEN_OBJECT]);
    });

    test("removes a token with the requested scopes and audience that is expired and non-refreshable", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0, accessToken: "expiredToken", refreshToken: undefined });
      storeToken(TEST_ACCESS_TOKEN_OBJECT);

      const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key)).length).toBe(1);
      expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
    });
  });
});
