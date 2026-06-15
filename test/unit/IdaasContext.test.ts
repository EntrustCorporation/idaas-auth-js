import { describe, expect, test } from "bun:test";
import { IdaasContext } from "../../src/IdaasContext";
import { retrievePersistedDpopKeyMaterial } from "../../src/utils/dpopKeyStore";
import { TEST_BASE_URI, TEST_CLIENT_ID } from "./constants";

describe("IdaasContext", () => {
  const createContext = () =>
    new IdaasContext({
      issuerUrl: TEST_BASE_URI,
      clientId: TEST_CLIENT_ID,
      tokenOptions: {
        scope: "openid profile email",
        acrValues: "",
        useRefreshToken: false,
        includeOpenidScope: true,
      },
    });

  test("persists key material for the requested algorithm after another algorithm is used", async () => {
    const context = createContext();

    await context.getDpopJkt({ alg: "ES256", includeJkt: true });
    await context.createDpopProof({
      method: "POST",
      uri: "https://example.com/token",
      dpopOptions: { alg: "PS256" },
    });

    const dpopKeyRef = await context.persistCurrentDpopKeyMaterialForAlg("ES256");
    const persistedKeyMaterial = await retrievePersistedDpopKeyMaterial(dpopKeyRef);

    expect(persistedKeyMaterial?.alg).toBe("ES256");
  });
});
