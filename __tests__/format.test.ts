import { describe, expect, test } from "bun:test";
import { formatUrl } from "../src/utils/format";

describe("formatIssuerUrl", () => {
  const expected = "https://test.com";

  test("removes trailing '/'", () => {
    const url = "https://test.com/";
    expect(formatUrl(url)).toBe(expected);
  });

  test("prepends 'https://' if missing", () => {
    const url = "test.com";
    expect(formatUrl(url)).toBe(expected);
  });

  test("prepends 'https://' if missing and removes trailing '/'", () => {
    const url = "test.com/";
    expect(formatUrl(url)).toBe(expected);
  });

  test("does not change formatting of properly formatted url", () => {
    expect(formatUrl(expected)).toBe(expected);
  });
});
