import { beforeAll, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import type { OidcConfig } from "../../src/api";

// Install mock BEFORE importing the module under test
const createRandomString = jest.fn().mockReturnValueOnce("stateRaw").mockReturnValueOnce("nonceRaw");

mock.module("../../src/utils/crypto", () => ({
  base64UrlStringEncode: (v: string) => `enc(${v})`,
  createRandomString,
  generateChallengeVerifierPair: () => ({
    codeVerifier: "testVerifier",
    codeChallenge: "testChallenge",
  }),
}));

// Import after mocking so url.ts sees the mocked crypto
let generateAuthorizationUrl: typeof import("../../src/utils/url").generateAuthorizationUrl;
beforeAll(async () => {
  ({ generateAuthorizationUrl } = await import("../../src/utils/url"));
});

describe("generateAuthorizationUrl", () => {
  const oidcConfig: OidcConfig = {
    issuer: "https://issuer.example.com",
    authorization_endpoint: "https://issuer.example.com/authorize",
    token_endpoint: "",
    userinfo_endpoint: "",
    jwks_uri: "",
    registration_endpoint: "",
    scopes_supported: [],
    subject_types_supported: [],
    id_token_signing_alg_values_supported: [],
    claims_supported: [],
    end_session_endpoint: "",
  };

  const parse = (urlStr: string) => {
    const u = new URL(urlStr);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    return { u, params };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-seed sequential returns if needed in future tests:
    createRandomString.mockReset().mockReturnValueOnce("stateRaw").mockReturnValueOnce("nonceRaw");
  });

  it("builds a standard flow URL with all optional params", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "client123",
      scope: "openid profile profile email",
      audience: "api://default",
      acrValues: ["urn:acr:bronze", "urn:acr:silver"],
      maxAge: 300,
      responseMode: "query",
      redirectUri: "https://app.example.com/callback",
      useRefreshToken: true,
    });

    const { params, u } = parse(result.url);

    expect(u.origin + u.pathname).toBe(oidcConfig.authorization_endpoint);

    // Implementation appends openid (already present) and offline_access, then de-duplicates preserving first occurrences.
    // Input scope: "openid profile profile email"
    // After push openid: (openid profile email openid)
    // After offline_access: (openid profile email openid offline_access)
    // Set preserves first occurrences => "openid profile email offline_access"
    expect(result.usedScope).toBe("openid profile email offline_access");
    expect(params.scope).toBe("openid profile email offline_access");

    expect(params.client_id).toBe("client123");
    expect(params.audience).toBe("api://default");
    expect(params.acr_values).toBe("urn:acr:bronze urn:acr:silver");
    expect(params.max_age).toBe("300");
    expect(params.response_mode).toBe("query");
    expect(params.redirect_uri).toBe("https://app.example.com/callback");
    expect(params.response_type).toBe("code");

    expect(params.code_challenge).toBe("testChallenge");
    expect(params.code_challenge_method).toBe("S256");
    expect(params.state).toBe("enc(stateRaw)");
    expect(params.nonce).toBe("enc(nonceRaw)");
    expect(result.state).toBe("enc(stateRaw)");
    expect(result.nonce).toBe("enc(nonceRaw)");
    expect(result.codeVerifier).toBe("testVerifier");

    expect(createRandomString).toHaveBeenCalledTimes(2);
  });

  it("omits optional params when not provided", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "abc",
    });

    const { params } = parse(result.url);
    expect(result.usedScope).toBe("openid");
    expect(params.scope).toBe("openid");
    expect(params.max_age).toBeUndefined();
    expect(params.acr_values).toBeUndefined();
    expect(params.audience).toBeUndefined();
    expect(params.response_mode).toBeUndefined();
    expect(params.redirect_uri).toBeUndefined();
  });

  it("does not include max_age when negative", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "abc",
      maxAge: -1,
    });
    const { params } = parse(result.url);
    expect(params.max_age).toBeUndefined();
  });

  it("adds offline_access when useRefreshToken is true", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "abc",
      scope: "profile",
      useRefreshToken: true,
    });

    // Order: original scopes ("profile"), then appended openid, then offline_access -> "profile openid offline_access"
    expect(result.usedScope).toBe("profile openid offline_access");
  });

  it("uses issuer/authorizejwt for jwt flow and ignores redirect_uri & response_mode", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "jwt",
      clientId: "jwtClient",
      redirectUri: "https://should-not.be/included",
      responseMode: "web_message",
      scope: "email",
    });

    const { u, params } = parse(result.url);
    expect(u.origin + u.pathname).toBe("https://issuer.example.com/authorizejwt");
    expect(params.redirect_uri).toBeUndefined();
    expect(params.response_mode).toBeUndefined();
    expect(params.response_type).toBe("code");
    // Input scope: "email" then appended openid => "email openid"
    expect(result.usedScope).toBe("email openid");
  });

  it("adds openid when missing and preserves order", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "dupTest",
      scope: "profile email",
    });
    // "profile email" then appended openid -> "profile email openid"
    expect(result.usedScope).toBe("profile email openid");
  });
});
