import { afterAll, afterEach, describe, expect, jest, test } from "bun:test";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ID_PAIR, TEST_ID_TOKEN_OBJECT } from "../constants";

describe("IdaasClient.isAuthenticated", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const key = TEST_ID_PAIR.key;

  test("returns true if token is stored", () => {
    localStorage.setItem(key, JSON.stringify(TEST_ID_TOKEN_OBJECT));
    expect(localStorage.getItem(key)).toBeTruthy();

    const result = NO_DEFAULT_IDAAS_CLIENT.isAuthenticated();
    expect(result).toBeTrue();
  });

  test("returns false if no token is stored", () => {
    expect(localStorage.getItem(key)).toBeNull();
    const result = NO_DEFAULT_IDAAS_CLIENT.isAuthenticated();
    expect(result).toBeFalse();
  });
});
