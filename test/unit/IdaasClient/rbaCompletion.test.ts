import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import * as api from "../../../src/api";
import { IdaasClient } from "../../../src/IdaasClient";
import * as jwt from "../../../src/utils/jwt";
import * as urlUtils from "../../../src/utils/url";
import { TEST_CLIENT_ID, TEST_ISSUER_URI, TEST_OIDC_CONFIG } from "../constants";

describe("IdaasClient.rba completion", () => {
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

  const spyOnGenerateAuthorizationUrl = spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
    url: `${TEST_ISSUER_URI}/authorizejwt?scope=openid%20profile%20email`,
    nonce: "test-nonce",
    state: "test-state",
    codeVerifier: "test-code-verifier",
    usedScope: "openid profile email",
  });

  const spyOnGetAuthRequestId = spyOn(api, "getAuthRequestId").mockResolvedValue({
    authRequestKey: "test-auth-request-key",
    applicationId: "test-application-id",
  });

  const spyOnRequestAuthChallenge = spyOn(api, "requestAuthChallenge").mockResolvedValue({
    token: "challenge-token",
  } as never);

  const spyOnSubmitAuthChallenge = spyOn(api, "submitAuthChallenge").mockResolvedValue({
    authenticationCompleted: true,
    token: "completed-token",
  } as never);

  const spyOnRequestToken = spyOn(api, "requestToken");
  const spyOnValidateIdToken = spyOn(jwt, "validateIdToken").mockResolvedValue({
    idToken: "encoded-id-token",
    decodedJwt: {
      sub: "test-sub",
      nonce: "test-nonce",
    },
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("validates id token with requested acr values when openid scope is included", async () => {
    const client = new IdaasClient({
      issuerUrl: TEST_ISSUER_URI,
      clientId: TEST_CLIENT_ID,
      storageType: "localstorage",
    });

    spyOnRequestToken.mockResolvedValueOnce({
      access_token: "access-token",
      id_token: "id-token",
      token_type: "Bearer",
      expires_in: "300",
    });

    await client.rba.requestChallenge(
      {
        userId: "user@example.com",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
      {
        acrValues: "1 2",
      },
    );

    await client.rba.submitChallenge({ response: "password" });

    expect(spyOnFetch).toHaveBeenCalledTimes(1);
    expect(spyOnGenerateAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(spyOnGetAuthRequestId).toHaveBeenCalledTimes(1);
    expect(spyOnRequestAuthChallenge).toHaveBeenCalledTimes(1);
    expect(spyOnSubmitAuthChallenge).toHaveBeenCalledTimes(1);
    expect(spyOnRequestToken).toHaveBeenCalledTimes(1);

    expect(spyOnValidateIdToken).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: "test-nonce",
        requestedAcrValues: ["1", "2"],
      }),
    );
  });

  test("does not validate id token when openid scope is omitted", async () => {
    const client = new IdaasClient({
      issuerUrl: TEST_ISSUER_URI,
      clientId: TEST_CLIENT_ID,
      storageType: "localstorage",
    });

    spyOnRequestToken.mockResolvedValueOnce({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: "300",
    });

    await client.rba.requestChallenge(
      {
        userId: "user@example.com",
        strict: true,
        preferredAuthenticationMethod: "PASSWORD",
      },
      {
        includeOpenidScope: false,
        scope: "profile email",
      },
    );

    await client.rba.submitChallenge({ response: "password" });

    expect(spyOnRequestToken).toHaveBeenCalledTimes(1);
    expect(spyOnValidateIdToken).not.toHaveBeenCalled();
  });
});
