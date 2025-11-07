import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_BASE_URI, TEST_CLIENT_ID } from "../constants";
import { getUrlParams, mockFetch, storeData } from "../helpers";

describe("IdaasClient.oidc.logout", () => {
  // @ts-expect-error not full type
  const _spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  const startLocation = window.location.href;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    window.location.href = startLocation;
  });

  test("clears stored data and redirects even without ID token", async () => {
    storeData({ tokenParams: true, clientParams: true, accessToken: true });

    await NO_DEFAULT_IDAAS_CLIENT.oidc.logout();

    // Should clear all stored data
    expect(localStorage.length).toBe(0);
    // Should redirect to end session endpoint
    expect(window.location.href).toContain("/endsession");
  });

  test("removes all stored data, if ID token stored", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    await NO_DEFAULT_IDAAS_CLIENT.oidc.logout();

    expect(localStorage.length).toBe(0);
  });

  test("generates valid logout url with no redirectUri", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    await NO_DEFAULT_IDAAS_CLIENT.oidc.logout();

    const { client_id, post_logout_redirect_uri } = getUrlParams(window.location.href);

    expect(client_id).toStrictEqual(TEST_CLIENT_ID);
    expect(post_logout_redirect_uri).toBeUndefined();
  });

  test("generates valid logout url with redirectUri", async () => {
    storeData({ idToken: true, tokenParams: true, clientParams: true, accessToken: true });
    const redirectUri = TEST_BASE_URI;

    await NO_DEFAULT_IDAAS_CLIENT.oidc.logout({ redirectUri });

    const { client_id, post_logout_redirect_uri } = getUrlParams(window.location.href);
    expect(client_id).toStrictEqual(TEST_CLIENT_ID);
    expect(post_logout_redirect_uri).toStrictEqual(TEST_BASE_URI);
  });
});
