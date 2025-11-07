import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ACCESS_TOKEN, TEST_BASE_URI, TEST_ID_PAIR, TEST_SUB_CLAIM } from "../constants";
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
});
