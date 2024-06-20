import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_BASE_URI, TEST_CLIENT_ID } from "../constants";
import { getLogoutUrlParams, mockFetch, storeData } from "../helpers";

describe("IdaasClient.logout", () => {
  // @ts-ignore not full type
  const _spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  // @ts-ignore private method
  const spyOnGetConfig = spyOn(NO_DEFAULT_IDAAS_CLIENT, "getConfig");
  // @ts-ignore private method
  const spyOnGenerateLogoutUrl = spyOn(NO_DEFAULT_IDAAS_CLIENT, "generateLogoutUrl");
  const startLocation = window.location.href;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    window.location.href = startLocation;
  });

  test("does nothing if no ID token stored", async () => {
    const originalLocation = window.location.href;
    storeData({ tokenParams: true, clientParams: true, accessToken: true });

    await NO_DEFAULT_IDAAS_CLIENT.logout();

    expect(spyOnGenerateLogoutUrl).not.toBeCalled();
    expect(spyOnGetConfig).not.toBeCalled();
    expect(localStorage.length).toBe(3);
    expect(window.location.href).toStrictEqual(originalLocation);
  });

  test("removes all stored data, if ID token stored", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    await NO_DEFAULT_IDAAS_CLIENT.logout();

    expect(localStorage.length).toBe(0);
  });

  test("generates valid logout url with no redirectUri", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    await NO_DEFAULT_IDAAS_CLIENT.logout();

    expect(spyOnGenerateLogoutUrl).toBeCalledTimes(1);
    const generateLogoutCall = spyOnGenerateLogoutUrl.mock.calls[0] as string[];
    const redirectUri = generateLogoutCall[1];
    expect(redirectUri).toBeUndefined();

    const { clientId, logoutRedirect } = getLogoutUrlParams(window.location.href);

    expect(clientId).toStrictEqual(TEST_CLIENT_ID);
    expect(logoutRedirect).toBeNull();
  });

  test("generates valid logout url with redirectUri", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    const redirectUri = TEST_BASE_URI;

    await NO_DEFAULT_IDAAS_CLIENT.logout({ redirectUri });

    expect(spyOnGenerateLogoutUrl).toBeCalledTimes(1);
    const generateLogoutCall = spyOnGenerateLogoutUrl.mock.calls[0] as string[];
    const passedRedirectUri = generateLogoutCall[0];
    expect(passedRedirectUri).toStrictEqual(redirectUri);

    const { clientId, logoutRedirect } = getLogoutUrlParams(window.location.href);
    expect(clientId).toStrictEqual(TEST_CLIENT_ID);
    expect(logoutRedirect).toStrictEqual(TEST_BASE_URI);
  });

  test("fetches end session endpoint from config", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });

    await NO_DEFAULT_IDAAS_CLIENT.logout();
    expect(spyOnGetConfig).toBeCalled();
  });
});
