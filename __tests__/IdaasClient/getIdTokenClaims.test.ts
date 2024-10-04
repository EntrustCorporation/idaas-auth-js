import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ID_PAIR } from "../constants";

describe("IdaasClient.getIdTokenClaims", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("if user info is stored, returns the user info", () => {
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));

    const user = NO_DEFAULT_IDAAS_CLIENT.getIdTokenClaims();

    expect(user).toBeTruthy();
    expect(user.sub).toStrictEqual(TEST_ID_PAIR.data.decoded.sub);
  });

  test("if user info is not stored, returns null", () => {
    const user = NO_DEFAULT_IDAAS_CLIENT.getIdTokenClaims();

    expect(user).toBeNull();
  });
});
