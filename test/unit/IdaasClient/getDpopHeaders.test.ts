import { afterEach, describe, expect, test } from "bun:test";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { generateDpopKeyMaterial } from "../../../src/utils/dpop";
import { persistDpopKeyMaterial } from "../../../src/utils/dpopKeyStore";
import { NO_DEFAULT_IDAAS_CLIENT, TEST_ACCESS_TOKEN, TEST_ACCESS_TOKEN_OBJECT } from "../constants";

const storeToken = (token: typeof TEST_ACCESS_TOKEN_OBJECT) => {
  // @ts-expect-error private method call
  NO_DEFAULT_IDAAS_CLIENT.storageManager.saveAccessToken(token);
};

describe("IdaasClient.getDpopHeaders", () => {
  afterEach(() => {
    localStorage.clear();
  });

  test("throws when the selected token is not DPoP-bound", async () => {
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    await expect(
      NO_DEFAULT_IDAAS_CLIENT.getDpopHeaders({
        method: "GET",
        uri: "https://api.example.com/accounts",
        accessToken: TEST_ACCESS_TOKEN,
      }),
    ).rejects.toThrow("Selected access token is not DPoP-bound.");
  });

  test("returns DPoP Authorization and proof headers for a DPoP-bound token", async () => {
    const keyMaterial = await generateDpopKeyMaterial("PS256");
    const dpopKeyRef = await persistDpopKeyMaterial({ alg: "PS256", ...keyMaterial });

    storeToken({
      ...TEST_ACCESS_TOKEN_OBJECT,
      accessToken: TEST_ACCESS_TOKEN,
      dpopBound: true,
      dpopKeyRef,
    });

    const headers = await NO_DEFAULT_IDAAS_CLIENT.getDpopHeaders({
      method: "get",
      uri: "https://api.example.com/accounts?include=balances#summary",
      accessToken: TEST_ACCESS_TOKEN,
    });

    expect(headers.Authorization).toBe(`DPoP ${TEST_ACCESS_TOKEN}`);
    expect(headers.DPoP).toBeDefined();

    const protectedHeader = decodeProtectedHeader(headers.DPoP as string);
    expect(protectedHeader.alg).toBe("PS256");
    expect(protectedHeader.typ).toBe("dpop+jwt");
    expect(protectedHeader.jwk).toBeDefined();

    if (!protectedHeader.jwk) {
      throw new Error("Expected DPoP proof to include a public JWK");
    }

    const verificationKey = await importJWK(protectedHeader.jwk, protectedHeader.alg);
    const { payload } = await jwtVerify(headers.DPoP as string, verificationKey);

    expect(payload.htm).toBe("GET");
    expect(payload.htu).toBe("https://api.example.com/accounts");
    expect(typeof payload.jti).toBe("string");
    expect(typeof payload.ath).toBe("string");
  });

  test("rejects non-http protected resource URIs", async () => {
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    await expect(
      NO_DEFAULT_IDAAS_CLIENT.getDpopHeaders({
        method: "GET",
        uri: "file:///tmp/accounts",
        accessToken: TEST_ACCESS_TOKEN,
      }),
    ).rejects.toThrow("Protected resource URI must use http or https.");
  });

  test("rejects invalid protected resource URIs with SDK error", async () => {
    storeToken(TEST_ACCESS_TOKEN_OBJECT);

    await expect(
      NO_DEFAULT_IDAAS_CLIENT.getDpopHeaders({
        method: "GET",
        uri: "/accounts",
        accessToken: TEST_ACCESS_TOKEN,
      }),
    ).rejects.toThrow("Protected resource URI must be a valid absolute URL.");
  });
});
