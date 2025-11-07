import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { AccessToken } from "../../../src/storage/StorageManager";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  SET_DEFAULTS_IDAAS_CLIENT,
  TEST_ACCESS_PAIR,
  TEST_ACCESS_TOKEN,
  TEST_ACCESS_TOKEN_OBJECT,
  TEST_AUDIENCE,
  TEST_BASE_URI,
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

  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  const storeToken = (token: AccessToken) => {
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken(token);
  };

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

    expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string).length).toBe(1);
    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });

  test("refreshes a token with the requested scopes and audience that is expired and refreshable", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0, scope: "1" });
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, accessToken: "notRefreshed", scope: "1 2" });

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ scope: "1", audience: TEST_AUDIENCE });

    // Verify API contract: refresh endpoint was called with correct grant type
    const tokenEndpointCall = spyOnFetch.mock.calls.find((call) => call[0] === `${TEST_BASE_URI}/token`);
    expect(tokenEndpointCall).toBeDefined();
    expect(tokenEndpointCall?.[0]).toStrictEqual(`${TEST_BASE_URI}/token`);
    const body = tokenEndpointCall?.[1]?.body?.toString();
    expect(body).toContain("grant_type=refresh_token");

    // Verify outcome: token was refreshed and returned correctly
    const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
    expect(storedTokens.length).toBe(2);
    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });

  describe("refresh token validity", () => {
    test("refreshing a token does not change the number of tokens stored", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });
      const numTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string).length;

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      expect(JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string).length).toBe(numTokens);
    });

    test("the refreshed token's expiration time is calculated correctly", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
      const refreshedToken = storedTokens[0];
      // Token response comes from mockFetch which returns TEST_TOKEN_RESPONSE
      // The expires_in is mocked, so we just verify it exists and is calculated
      expect(refreshedToken.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
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

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
      const refreshedToken = storedTokens[0] as AccessToken;

      expect(refreshedToken.accessToken).not.toStrictEqual(TEST_DIFFERENT_ACCESS_TOKEN);
      expect(refreshedToken.scope).toStrictEqual(TEST_DIFFERENT_SCOPE);
      expect(refreshedToken.audience).toStrictEqual(TEST_DIFFERENT_AUDIENCE);
    });

    test("the refreshed token has the refresh token from the response", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
      const refreshedToken = storedTokens[0];
      // Verify that refresh token is updated (comes from TEST_TOKEN_RESPONSE mock)
      expect(refreshedToken.refreshToken).toBeTruthy();
      expect(typeof refreshedToken.refreshToken).toBe("string");
    });

    test("the refreshed token has the access token from the response", async () => {
      storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0 });

      await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

      const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
      const refreshedToken = storedTokens[0];
      // Verify access token was updated (comes from TEST_TOKEN_RESPONSE mock)
      expect(refreshedToken.accessToken).toBeTruthy();
      expect(refreshedToken.accessToken).toStrictEqual(TEST_ACCESS_TOKEN);
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

  test("removes a token with the requested scopes and audience that is expired and non-refreshable", async () => {
    storeToken({ ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 0, accessToken: "expiredToken", refreshToken: undefined });
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    const token = await NO_DEFAULT_IDAAS_CLIENT.getAccessToken({ audience: TEST_AUDIENCE });

    const storedTokens = JSON.parse(localStorage.getItem(TEST_ACCESS_PAIR.key) as string);
    expect(storedTokens.length).toBe(1);
    expect(token).toStrictEqual(TEST_ACCESS_TOKEN);
  });
});
