import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import * as api from "../../../src/api";
import { IdaasClient } from "../../../src/IdaasClient";
import * as urlUtils from "../../../src/utils/url";
import { TEST_CLIENT_ID, TEST_ISSUER_URI, TEST_OIDC_CONFIG } from "../constants";

describe("IdaasClient.rba.requestChallenge", () => {
  // @ts-expect-error non full type
  const spyOnFetch = spyOn(window, "fetch").mockImplementation(async (url: string) => {
    if (url === `${TEST_ISSUER_URI}/.well-known/openid-configuration`) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(TEST_OIDC_CONFIG),
      } as Response);
    }

    throw new Error(`Unexpected fetch call in test: ${url}`);
  });

  const spyOnGetAuthRequestId = spyOn(api, "getAuthRequestId").mockResolvedValue({
    authRequestKey: "test-auth-request-key",
    applicationId: "test-application-id",
  });

  const spyOnRequestAuthChallenge = spyOn(api, "requestAuthChallenge").mockResolvedValue({
    token: "test-token",
  } as never);

  const spyOnGenerateAuthorizationUrl = spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
    url: `${TEST_ISSUER_URI}/authorizejwt?scope=profile%20email`,
    nonce: "test-nonce",
    state: "test-state",
    codeVerifier: "test-code-verifier",
    usedScope: "profile email",
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("propagates includeOpenidScope=false in RBA token options", async () => {
    const client = new IdaasClient(
      {
        issuerUrl: TEST_ISSUER_URI,
        clientId: TEST_CLIENT_ID,
        storageType: "localstorage",
      },
      {
        scope: "openid profile email",
      },
    );

    await client.rba.requestChallenge(
      {
        userId: "user@example.com",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
      {
        scope: "profile email",
        includeOpenidScope: false,
      },
    );

    expect(spyOnGetAuthRequestId).toHaveBeenCalledTimes(1);
    expect(spyOnRequestAuthChallenge).toHaveBeenCalledTimes(1);
    expect(spyOnFetch).toHaveBeenCalledTimes(1);

    expect(spyOnGenerateAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(spyOnGenerateAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: `${TEST_ISSUER_URI}/authorizejwt`,
        clientId: TEST_CLIENT_ID,
        tokenOptions: expect.objectContaining({
          scope: "profile email",
          includeOpenidScope: false,
        }),
      }),
    );
  });

  test("preserves default scope when includeOpenidScope=false", async () => {
    const client = new IdaasClient(
      {
        issuerUrl: TEST_ISSUER_URI,
        clientId: TEST_CLIENT_ID,
        storageType: "localstorage",
      },
      {
        scope: "openid profile email",
      },
    );

    await client.rba.requestChallenge(
      {
        userId: "user@example.com",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
      {
        includeOpenidScope: false,
      },
    );

    expect(spyOnGenerateAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: `${TEST_ISSUER_URI}/authorizejwt`,
        clientId: TEST_CLIENT_ID,
        tokenOptions: expect.objectContaining({
          scope: "openid profile email",
          includeOpenidScope: false,
        }),
      }),
    );
  });
});
