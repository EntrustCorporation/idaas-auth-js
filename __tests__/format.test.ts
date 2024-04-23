import { describe, expect, test } from "bun:test";
import { formatUrl, sanitizeUri } from "../src/utils/format";

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

  test("doesn't override http:// if localhost url", () => {
    const localhostUrl = "http://localhost:3000/";
    const formattedLocalhostUrl = "http://localhost:3000";
    expect(formatUrl(localhostUrl)).toBe(formattedLocalhostUrl);
  });
});

test("removes trailing '?'", () => {
  const url = "https://test.com/?";
  expect(sanitizeUri(url)).toBe("https://test.com/");
});
