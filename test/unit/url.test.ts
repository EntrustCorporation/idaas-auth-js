import { describe, expect, it } from "bun:test";
import type { OidcConfig } from "../../src/api";
import { generateAuthorizationUrl } from "../../src/utils/url";

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

  const b64urlPattern = /^[A-Za-z0-9\-_]+$/;

  it("builds a standard flow URL with all optional params", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "client123",
      tokenOptions: {
        scope: "openid profile profile email",
        audience: "api://default",
        acrValues: ["urn:acr:bronze", "urn:acr:silver"],
        maxAge: 300,
        useRefreshToken: true,
      },
      responseMode: "query",
      redirectUri: "https://app.example.com/callback",
    });

    const { params, u } = parse(result.url);

    expect(u.origin + u.pathname).toBe(oidcConfig.authorization_endpoint);

    // Scope order: original scopes then appended openid + offline_access
    expect(result.usedScope).toBe("openid profile email offline_access");
    expect(params.scope).toBe(result.usedScope);

    // Required OIDC params
    expect(params.client_id).toBe("client123");
    expect(params.response_type).toBe("code");
    expect(params.code_challenge_method).toBe("S256");

    // Cryptographic values: existence + format (not exact values)
    expect(result.state).toMatch(b64urlPattern);
    expect(result.nonce).toMatch(b64urlPattern);
    expect(result.codeVerifier).toMatch(b64urlPattern);
    expect(params.state).toBe(result.state);
    expect(params.nonce).toBe(result.nonce);
    expect(params.code_challenge).toMatch(b64urlPattern);

    // Distinct
    expect(result.state).not.toBe(result.nonce);
    expect(result.codeVerifier).not.toBe(params.code_challenge); // challenge derived from verifier

    // Optional params present
    expect(params.redirect_uri).toBe("https://app.example.com/callback");
    expect(params.acr_values).toBe("urn:acr:bronze urn:acr:silver");
    expect(params.audience).toBe("api://default");
    expect(params.max_age).toBe("300");
  });

  it("omits optional params when not provided", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "abc",
      tokenOptions: {},
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
      tokenOptions: {
        maxAge: -1,
      },
    });
    const { params } = parse(result.url);
    expect(params.max_age).toBeUndefined();
  });

  it("adds offline_access when useRefreshToken is true", async () => {
    const result = await generateAuthorizationUrl(oidcConfig, {
      type: "standard",
      clientId: "abc",
      tokenOptions: {
        scope: "profile",
        useRefreshToken: true,
      },
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
      tokenOptions: {
        scope: "email",
      },
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
      tokenOptions: {
        scope: "profile email",
      },
    });
    // "profile email" then appended openid -> "profile email openid"
    expect(result.usedScope).toBe("profile email openid");
  });
});
