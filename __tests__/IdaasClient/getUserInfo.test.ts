import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import type { IdToken } from "../../src/PersistenceManager";

import { NO_DEFAULT_IDAAS_CLIENT, TEST_ACCESS_TOKEN, TEST_BASE_URI, TEST_ID_PAIR, TEST_SUB_CLAIM } from "../constants";
import { mockFetch } from "../helpers";

describe("IdaasClient.getUserInfo", () => {
  const spyOnFetch = vi.spyOn(window as any, "fetch").mockImplementation(mockFetch);
  const spyOnGetIdToken = vi.spyOn((NO_DEFAULT_IDAAS_CLIENT as any).persistenceManager, "getIdToken");
  const spyOnGetAccessToken = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT, "getAccessToken");

  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("throws error if no user info access token", () => {
    expect(async () => await NO_DEFAULT_IDAAS_CLIENT.getUserInfo()).rejects.toThrowError();
  });

  test("makes a fetch request to the userinfo endpoint", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    const requests = spyOnFetch.mock.calls;
    const userInfoRequest = requests.find((request) => request.includes(`${TEST_BASE_URI}/userinfo`));
    expect(userInfoRequest).toBeTruthy();
  });

  test("returns null if the obtained user info sub claim is not equal to the stored id token's sub claim", async () => {
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify({ ...TEST_ID_PAIR.data, decoded: { sub: "notEqual" } }));
    const result = await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    expect(spyOnGetIdToken).toBeCalled();
    const storedIdToken = spyOnGetIdToken.mock.results[0].value as IdToken;
    const storedSubClaim = storedIdToken.decoded.sub;

    expect(storedSubClaim).not.toStrictEqual(TEST_SUB_CLAIM);
    expect(result).toBeNull();
  });

  test("returns the user's info if the obtained user info sub claim is equal to the stored id token's sub claim", async () => {
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
    const result = await NO_DEFAULT_IDAAS_CLIENT.getUserInfo(TEST_ACCESS_TOKEN);

    expect(spyOnGetIdToken).toBeCalled();
    const storedIdToken = spyOnGetIdToken.mock.results[0].value as IdToken;
    const storedSubClaim = storedIdToken.decoded.sub;

    expect(storedSubClaim).toStrictEqual(TEST_SUB_CLAIM);
    expect(result).not.toBeUndefined();
  });

  test("throws error if client is not authorized to access userInfo endpoint", () => {
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
    spyOnGetAccessToken.mockImplementationOnce(() => undefined);

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.getUserInfo();
    }).rejects.toThrowError("Client is not authorized");
  });
});
