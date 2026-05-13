import { afterEach, describe, expect, it, jest, spyOn } from "bun:test";
import { IdaasContext } from "../../src/IdaasContext";
import { TEST_CLIENT_ID, TEST_ISSUER_URI, TEST_OIDC_CONFIG } from "./constants";

describe("IdaasContext", () => {
  const tokenOptions = {
    scope: "openid profile",
    useRefreshToken: false,
    maxAge: 300,
    acrValues: ["acr"],
    audience: "https://example.com/audience",
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes issuer, client, and token options", () => {
    const context = new IdaasContext({
      issuerUrl: TEST_ISSUER_URI,
      clientId: TEST_CLIENT_ID,
      tokenOptions,
    });

    expect(context.issuerUrl).toBe(TEST_ISSUER_URI);
    expect(context.clientId).toBe(TEST_CLIENT_ID);
    expect(context.tokenOptions).toEqual(tokenOptions);
  });

  it("fetches and caches the OIDC config", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => TEST_OIDC_CONFIG,
    } as Response);

    const context = new IdaasContext({
      issuerUrl: TEST_ISSUER_URI,
      clientId: TEST_CLIENT_ID,
      tokenOptions,
    });

    const first = await context.getConfig();
    const second = await context.getConfig();

    expect(first).toBe(TEST_OIDC_CONFIG);
    expect(second).toBe(TEST_OIDC_CONFIG);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(`${TEST_ISSUER_URI}/.well-known/openid-configuration`);
  });

  it("normalizes trailing slashes when fetching OIDC config", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => TEST_OIDC_CONFIG,
    } as Response);

    const context = new IdaasContext({
      issuerUrl: `${TEST_ISSUER_URI}///`,
      clientId: TEST_CLIENT_ID,
      tokenOptions,
    });

    await context.getConfig();

    expect(fetchSpy).toHaveBeenCalledWith(`${TEST_ISSUER_URI}/.well-known/openid-configuration`);
  });
});
