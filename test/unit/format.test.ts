import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";
import { calculateEpochExpiry, formatUrl, sanitizeUri } from "../../src/utils/format";

describe("formatUrl", () => {
  const expected = "https://test.com";

  it("should prepend 'https://' if missing", () => {
    expect(formatUrl("test.com")).toBe(expected);
  });

  it("should remove trailing slash", () => {
    expect(formatUrl("https://test.com/")).toBe(expected);
  });

  it("should allow http:// for localhost url", () => {
    expect(formatUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(formatUrl("https://localhost:3000/")).toBe("https://localhost:3000");
  });

  it("should set protocol to HTTPS", () => {
    expect(formatUrl("http://test.com")).toBe("https://test.com");
    expect(formatUrl("ftp://test.com")).toBe("https://test.com");
    expect(formatUrl("ftp://localhost")).toBe("https://localhost");
  });
});

describe("calculateEpochExpiry", () => {
  const expiresIn = 30000;
  const now = 1737751858;
  const expected = now + expiresIn;

  beforeAll(() => {
    setSystemTime(1737751858716);
  });

  afterAll(() => {
    setSystemTime();
  });

  it("should add the expiry to the auth time", () => {
    expect(calculateEpochExpiry(String(expiresIn), String(now))).toBe(expected);
  });

  it("should default to the current time", () => {
    expect(calculateEpochExpiry(String(expiresIn))).toBe(expected);
  });
});

describe("sanitizeUri", () => {
  it("removes query parameters from URL", () => {
    const url = "https://test.com/?foo=bar";
    expect(sanitizeUri(url)).toBe("https://test.com/");
  });
});
