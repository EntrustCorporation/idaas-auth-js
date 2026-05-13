import { afterAll, afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import * as jwtUtils from "../../../src/utils/jwt";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ACCESS_TOKEN, TEST_BASE_URI, TEST_ID_PAIR, TEST_SUB_CLAIM } from "../constants";
import { mockFetch } from "../helpers";

describe("IdaasClient.getUserInfo", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(window, "fetch").mockImplementation(((input: RequestInfo | URL, _init?: RequestInit) =>
      mockFetch(input.toString())) as typeof fetch);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    fetchSpy.mockRestore();
  });

  test("throws error if no user info access token", async () => {
    await expect(NO_DEFAULT_IDAAS_CLIENT.getUserInfo()).rejects.toThrow();
  });

  test("makes a fetch request to the userinfo endpoint", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    const requests = fetchSpy.mock.calls;
    const userInfoRequest = requests.find((request: [RequestInfo, RequestInit?]) =>
      request[0].toString().includes(`${TEST_BASE_URI}/userinfo`),
    );
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

  test("returns claims when userinfo is a JWT", async () => {
    const jwtClaims = { sub: "jwt-sub" };
    const validateSpy = spyOn(jwtUtils, "validateUserInfoToken").mockResolvedValue(jwtClaims);
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify({ ...TEST_ID_PAIR.data, decoded: { sub: jwtClaims.sub } }));

    fetchSpy.mockImplementation(((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === `${TEST_BASE_URI}/userinfo`) {
        return Promise.resolve({
          text: async () => "not-json",
        } as Response);
      }

      return mockFetch(url);
    }) as typeof fetch);

    const result = await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    expect(result).toEqual(jwtClaims);
    expect(validateSpy).toHaveBeenCalledWith({
      userInfoToken: "not-json",
      clientId: expect.any(String),
      jwksEndpoint: `${TEST_BASE_URI}/jwks`,
      issuer: `${TEST_BASE_URI}/issuer`,
    });
  });
});
