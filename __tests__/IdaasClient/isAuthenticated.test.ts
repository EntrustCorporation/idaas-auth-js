import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ID_PAIR, TEST_ID_TOKEN_OBJECT } from "../constants";

describe("IdaasClient.isAuthenticated", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const key = TEST_ID_PAIR.key;

  test("returns true if token is stored", () => {
    localStorage.setItem(key, JSON.stringify(TEST_ID_TOKEN_OBJECT));
    expect(localStorage.getItem(key)).toBeTruthy();

    const result = NO_DEFAULT_IDAAS_CLIENT.isAuthenticated();
    expect(result).toBeTruthy();
  });

  test("returns false if no token is stored", () => {
    expect(localStorage.getItem(key)).toBeNull();
    const result = NO_DEFAULT_IDAAS_CLIENT.isAuthenticated();
    expect(result).toBeFalsy();
  });
});
