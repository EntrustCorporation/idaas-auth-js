import { afterEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import * as api from "../../src/api";
import type { IdaasContext } from "../../src/IdaasContext";
import { OidcClient } from "../../src/OidcClient";
import { StorageManager } from "../../src/storage/StorageManager";
import * as browserUtils from "../../src/utils/browser";
import * as jwtUtils from "../../src/utils/jwt";
import * as urlUtils from "../../src/utils/url";
import { TEST_CLIENT_ID, TEST_ISSUER_URI, TEST_OIDC_CONFIG } from "./constants";

describe("OidcClient popup login", () => {
  const context = {
    issuerUrl: TEST_ISSUER_URI,
    clientId: TEST_CLIENT_ID,
    tokenOptions: {
      scope: "openid profile",
      useRefreshToken: false,
      maxAge: 0,
      acrValues: [],
      audience: undefined,
    },
    getConfig: mock(async () => TEST_OIDC_CONFIG),
  } as unknown as IdaasContext;

  const storageManager = new StorageManager(TEST_CLIENT_ID, "localstorage");

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("completes the popup login flow and stores tokens", async () => {
    const client = new OidcClient(context, storageManager);
    const popup = { closed: false, close: mock(() => {}) } as unknown as Window;

    spyOn(urlUtils, "generateAuthorizationUrl").mockResolvedValue({
      url: "https://example.com/authorize",
      nonce: "nonce",
      state: "state",
      codeVerifier: "verifier",
      usedScope: "openid profile",
    });
    const openSpy = spyOn(browserUtils, "openPopup").mockReturnValue(popup);
    const listenSpy = spyOn(browserUtils, "listenToAuthorizePopup").mockResolvedValue({
      code: "code",
      state: "state",
      error: null,
      error_description: null,
    });
    const requestTokenSpy = spyOn(api, "requestToken").mockResolvedValue({
      access_token: "access-token",
      id_token: "id-token",
      expires_in: "60",
      token_type: "Bearer",
    });
    spyOn(jwtUtils, "validateIdToken").mockReturnValue({
      decodedJwt: { sub: "sub" },
      idToken: "id-token",
    } as ReturnType<typeof jwtUtils.validateIdToken>);

    window.location.href = "https://example.com/start";

    const result = await client.login(
      { popup: true, redirectUri: "https://example.com/callback" },
      { scope: "openid profile" },
    );

    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls.some(([url]) => url === "https://example.com/authorize")).toBe(true);
    expect(listenSpy).toHaveBeenCalledWith(popup, "https://example.com/authorize");
    expect(result).toBe("access-token");
    expect(storageManager.getIdToken()?.encoded).toBe("id-token");
    expect(storageManager.getAccessTokens().length).toBe(1);
    expect(window.location.href).toBe("https://example.com/callback");

    expect(requestTokenSpy).toHaveBeenCalledTimes(1);
    const [, tokenRequest] = requestTokenSpy.mock.calls[0] ?? [];
    expect(tokenRequest).toEqual(
      expect.objectContaining({
        client_id: TEST_CLIENT_ID,
        code: "code",
        code_verifier: "verifier",
        grant_type: "authorization_code",
        redirect_uri: "https://example.com/callback",
      }),
    );
  });
});
