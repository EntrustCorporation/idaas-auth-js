import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { decodeProtectedHeader } from "jose";
import { generateDpopKeyMaterial } from "../../../src/utils/dpop";
import { persistDpopKeyMaterial } from "../../../src/utils/dpopKeyStore";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  TEST_ACCESS_TOKEN,
  TEST_ACCESS_TOKEN_OBJECT,
  TEST_BASE_URI,
  TEST_DIFFERENT_ACCESS_TOKEN,
  TEST_DIFFERENT_SCOPE,
  TEST_ID_PAIR,
  TEST_SUB_CLAIM,
} from "../constants";
import { mockFetch } from "../helpers";

describe("IdaasClient.getUserInfo", () => {
  // @ts-expect-error not full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("throws error if no user info access token", () => {
    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.getUserInfo();
    }).toThrowError();
  });

  test("makes a fetch request to the userinfo endpoint", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    const requests = spyOnFetch.mock.calls;
    const userInfoRequest = requests.find((request) => request.includes(`${TEST_BASE_URI}/userinfo`));
    expect(userInfoRequest).toBeTruthy();
  });

  test("returns null if the obtained user info sub claim does not match stored id token sub claim", async () => {
    // Store ID token with different sub claim
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify({ ...TEST_ID_PAIR.data, decoded: { sub: "notEqual" } }));

    const result = await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    // Test outcome: should return null when sub claims don't match
    expect(result).toBeNull();
  });

  test("returns user info when sub claim matches stored id token sub claim", async () => {
    // Store ID token with matching sub claim
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));

    const result = await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    // Test outcome: should return user info object
    expect(result).toBeDefined();
    expect(result?.sub).toStrictEqual(TEST_SUB_CLAIM);
  });

  test("uses persisted DPoP key algorithm for DPoP-bound UserInfo even when configured alg differs", async () => {
    const keyMaterial = await generateDpopKeyMaterial("PS256");
    const dpopKeyRef = await persistDpopKeyMaterial({ alg: "PS256", ...keyMaterial });

    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      accessToken: TEST_ACCESS_TOKEN,
      dpopBound: true,
      dpopKeyRef,
    });

    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN, { dpop: { alg: "ES256" } });

    const userInfoRequest = spyOnFetch.mock.calls.find((request) => request[0] === `${TEST_BASE_URI}/userinfo`);
    const headers = userInfoRequest?.[1]?.headers as Record<string, string>;

    expect(headers.DPoP).toBeDefined();
    expect(decodeProtectedHeader(headers.DPoP as string).alg).toBe("PS256");
  });

  test("uses persisted DPoP key reference for DPoP-bound UserInfo without tokenOptions.dpop", async () => {
    const keyMaterial = await generateDpopKeyMaterial("PS256");
    const dpopKeyRef = await persistDpopKeyMaterial({ alg: "PS256", ...keyMaterial });

    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      accessToken: TEST_ACCESS_TOKEN,
      dpopBound: true,
      dpopKeyRef,
    });

    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    const userInfoRequest = spyOnFetch.mock.calls.find((request) => request[0] === `${TEST_BASE_URI}/userinfo`);
    const headers = userInfoRequest?.[1]?.headers as Record<string, string>;

    expect(headers.DPoP).toBeDefined();
    expect(decodeProtectedHeader(headers.DPoP as string).alg).toBe("PS256");
  });

  test("passes tokenOptions through when acquiring a UserInfo access token", async () => {
    const keyMaterial = await generateDpopKeyMaterial("ES256");
    const dpopKeyRef = await persistDpopKeyMaterial({ alg: "ES256", ...keyMaterial });

    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      accessToken: TEST_ACCESS_TOKEN,
      audience: undefined,
    });
    // @ts-expect-error private method call
    NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      accessToken: TEST_DIFFERENT_ACCESS_TOKEN,
      audience: undefined,
      scope: TEST_DIFFERENT_SCOPE,
      dpopBound: true,
      dpopKeyRef,
    });

    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(undefined, { scope: TEST_DIFFERENT_SCOPE, dpop: { alg: "ES256" } });

    const userInfoRequest = spyOnFetch.mock.calls.find((request) => request[0] === `${TEST_BASE_URI}/userinfo`);
    const headers = userInfoRequest?.[1]?.headers as Record<string, string>;

    expect(headers.Authorization).toBe(`DPoP ${TEST_DIFFERENT_ACCESS_TOKEN}`);
    expect(headers.DPoP).toBeDefined();
  });
});
