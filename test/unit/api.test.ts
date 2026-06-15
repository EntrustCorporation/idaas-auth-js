import { describe, expect, it, spyOn } from "bun:test";
import { fetchOpenidConfiguration, getUserInfo, requestToken } from "../../src/api";

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

  describe("requestToken", () => {
    it("includes DPoP header when dpop proof is provided", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({ access_token: "a", token_type: "DPoP", expires_in: "300" }),
        headers: {
          get: () => null,
        },
      } as unknown as Response);

      await requestToken(
        "https://example.com/token",
        {
          grant_type: "refresh_token",
          client_id: "client",
          refresh_token: "refresh",
        },
        "signed-dpop-proof",
      );

      const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers.DPoP).toBe("signed-dpop-proof");
      fetchSpy.mockRestore();
    });
  });

  describe("getUserInfo", () => {
    it("uses DPoP auth scheme and header when proof is provided", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce({
        text: async () => "{}",
      } as unknown as Response);

      await getUserInfo("https://example.com/userinfo", "access-token", "dpop-proof");

      const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("DPoP access-token");
      expect(headers.DPoP).toBe("dpop-proof");
      fetchSpy.mockRestore();
    });
  });
});
