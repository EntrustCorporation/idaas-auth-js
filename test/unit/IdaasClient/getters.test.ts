import { describe, expect, it } from "bun:test";
import { IdaasClient } from "../../../src";
import { TEST_CLIENT_ID, TEST_ISSUER_URI } from "../constants";

describe("IdaasClient getters", () => {
  it("exposes oidc, rba, and auth clients", () => {
    const client = new IdaasClient({
      issuerUrl: TEST_ISSUER_URI,
      clientId: TEST_CLIENT_ID,
      storageType: "localstorage",
    });

    expect(client.oidc).toBeDefined();
    expect(client.rba).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(typeof client.oidc.login).toBe("function");
    expect(typeof client.rba.requestChallenge).toBe("function");
    expect(typeof client.auth.password).toBe("function");
  });
});
