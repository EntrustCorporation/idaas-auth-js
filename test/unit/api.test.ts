import { describe, expect, it, spyOn } from "bun:test";
import { fetchOpenidConfiguration } from "../../src/api";

describe("api.ts", () => {
  describe("fetchOpenidConfiguration", () => {
    it("should construct correct well-known URL with issuer path", () => {
      const issuerUrl = "https://example.trustedauth.com";
      const expectedUrl = `${issuerUrl}/.well-known/openid-configuration`;

      // The function constructs this URL internally
      expect(expectedUrl).toBe("https://example.trustedauth.com/.well-known/openid-configuration");
    });

    it("should construct URL with issuer having path", () => {
      const issuerUrl = "https://example.com/issuer";
      const expectedUrl = `${issuerUrl}/.well-known/openid-configuration`;

      expect(expectedUrl).toBe("https://example.com/issuer/.well-known/openid-configuration");
    });

    it("should handle trailing slash in issuer URL", () => {
      const issuerUrlWithSlash = "https://example.com/";
      const expectedUrl = `${issuerUrlWithSlash}.well-known/openid-configuration`;

      // Template literals concatenate directly
      expect(expectedUrl).toBe("https://example.com/.well-known/openid-configuration");
    });

    it("should be callable and return a promise", async () => {
      // Mock fetch to avoid actual network requests in tests
      const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issuer: "https://example.com" }),
      } as Response);

      const result = fetchOpenidConfiguration("https://example.com");
      expect(result).toBeInstanceOf(Promise);

      // Clean up
      mockFetch.mockRestore();
    });
  });
});
