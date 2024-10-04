import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import * as browser from "../../src/utils/browser";
import { formatUrl } from "../../src/utils/format";
import * as jwt from "../../src/utils/jwt";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  SET_DEFAULTS_IDAAS_CLIENT,
  TEST_ACCESS_TOKEN,
  TEST_ACR_CLAIM,
  TEST_AUTH_RESPONSE,
  TEST_BASE_URI,
  TEST_CLIENT_PAIR,
  TEST_DIFFERENT_SCOPE,
  TEST_ID_TOKEN_OBJECT,
  TEST_OIDC_CONFIG,
  TEST_REDIRECT_URI,
  TEST_SCOPE,
  TEST_TOKEN_PAIR,
} from "../constants";
import { getUrlParams, mockFetch } from "../helpers";

describe("IdaasClient.login", () => {
  const _spyOnFetch = vi.spyOn(window as any, "fetch").mockImplementation(mockFetch);
  const spyOnLoginWithRedirect = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "loginWithRedirect");
  const spyOnLoginWithPopup = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "loginWithPopup");
  const spyOnGetConfig = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "getConfig");
  const spyOnGenerateAuthorizationUrl = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "generateAuthorizationUrl");
  const startLocation = TEST_BASE_URI;

  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.location.href = startLocation;
  });

  test("fetches supported response modes from config", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.login();

    expect(spyOnGetConfig).toBeCalled();
  });

  test("throws error if attempting to login with popup, but web_message response mode not supported", () => {
    spyOnGetConfig.mockResolvedValueOnce({ ...TEST_OIDC_CONFIG, response_modes_supported: ["query"] });

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });
    }).rejects.toThrowError();
  });

  test("calls loginWithPopup if popup is true", async () => {
    spyOnLoginWithPopup.mockImplementationOnce(async () => "success");
    await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

    expect(spyOnLoginWithRedirect).not.toBeCalled();
    expect(spyOnLoginWithPopup).toBeCalled();
  });

  test("calls loginWithRedirect if popup is false", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.login({ popup: false });

    expect(spyOnLoginWithRedirect).toBeCalled();
    expect(spyOnLoginWithPopup).not.toBeCalled();
  });

  test("defaults to loginWithRedirect if popup param not supplied", async () => {
    await NO_DEFAULT_IDAAS_CLIENT.login();

    expect(spyOnLoginWithRedirect).toBeCalled();
    expect(spyOnLoginWithPopup).not.toBeCalled();
  });

  describe("login with redirect", () => {
    test("client params are saved", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(localStorage.getItem(TEST_CLIENT_PAIR.key)).toBeTruthy();
    });

    test("token params are saved", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(localStorage.getItem(TEST_TOKEN_PAIR.key)).toBeTruthy();
    });

    test("generateAuthorizationUrl returns {url, nonce, state, codeVerifier}", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url, nonce, state, codeVerifier } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as {
        url: string;
        nonce: string;
        state: string;
        codeVerifier: string;
      };
      const resultArr = [url, nonce, state, codeVerifier];

      for (const result of resultArr) {
        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
      }
    });

    describe("scopes in auth url", () => {
      test("auth url contains scopes", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.login();

        expect(spyOnGenerateAuthorizationUrl).toBeCalled();
        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);

        expect(scope).toBeTruthy();
      });

      test("if refresh token is true, `offline_access` scope is present", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.login({ useRefreshToken: true });

        expect(spyOnGenerateAuthorizationUrl).toBeCalled();
        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);

        expect(scope.split(" ")).toContain("offline_access");
      });

      test("scopes specified in login call are used", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.login({ scope: "test_scope1 test_scope2" });

        expect(spyOnGenerateAuthorizationUrl).toBeCalled();
        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);
        const scopeArr = scope.split(" ");

        expect(scopeArr).toContain("test_scope1");
        expect(scopeArr).toContain("test_scope2");
      });

      test("default scope used if none supplied in client constructor or login call", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.login();

        expect(spyOnGenerateAuthorizationUrl).toBeCalled();
        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);
        const sortedUrlScope = scope.split(" ").sort().join(", ");
        const sortedTestScope = TEST_SCOPE.split(" ").sort().join(", ");

        expect(sortedTestScope).toBeTruthy();
        expect(sortedUrlScope).toStrictEqual(sortedTestScope);
      });

      test("scope supplied in constructor used if not specified in login call", async () => {
        const spyOnGenerateAuthorizationUrl = vi.spyOn(SET_DEFAULTS_IDAAS_CLIENT as any, "generateAuthorizationUrl");

        await SET_DEFAULTS_IDAAS_CLIENT.login();

        expect(spyOnGenerateAuthorizationUrl).toBeCalled();
        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);
        const requiredScopes = TEST_DIFFERENT_SCOPE.split(" ");
        const receivedScopes = scope.split(" ");

        for (const scope of requiredScopes) {
          expect(receivedScopes).toContain(scope);
        }
      });
    });

    test("auth url contains correct response_mode and response_type", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { response_mode, response_type } = getUrlParams(authUrl);

      expect(response_type).toStrictEqual("code");
      expect(response_mode).toStrictEqual("query");
    });

    test("auth url contains max_age param if maxAge >= 0", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ maxAge: 0 });

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age } = getUrlParams(authUrl);

      expect(max_age).toStrictEqual("0");
    });

    test("auth url does not contain max_age param if maxAge is undefined", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age } = getUrlParams(authUrl);

      expect(max_age).toBeUndefined();
    });

    test("auth url does not contain max_age param if maxAge is negative", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ maxAge: -1 });

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age } = getUrlParams(authUrl);

      expect(max_age).toBeUndefined();
    });

    test("auth url contains acr_values if acrValues is passed", async () => {
      const thisTestDifferentAcr = "different";
      await NO_DEFAULT_IDAAS_CLIENT.login({ acrValues: [TEST_ACR_CLAIM, thisTestDifferentAcr] });

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values } = getUrlParams(authUrl);

      expect(acr_values.split(" ")).toContain(TEST_ACR_CLAIM);
      expect(acr_values.split(" ")).toContain(thisTestDifferentAcr);
    });

    test("auth url does not contain claims request if acrValues is not passed", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login();

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values } = getUrlParams(authUrl);

      expect(acr_values).toBeUndefined();
    });

    test("auth url does not contain claims request if acrValues is passed as empty array", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ acrValues: [] });

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values } = getUrlParams(authUrl);

      expect(acr_values).toBeUndefined();
    });

    test("redirects to the url provided by generateAuthorizationUrl", async () => {
      spyOnGenerateAuthorizationUrl.mockResolvedValueOnce({ url: TEST_REDIRECT_URI });

      await NO_DEFAULT_IDAAS_CLIENT.login();
      const newLocation = formatUrl(window.location.href);

      expect(newLocation).toStrictEqual(formatUrl(TEST_REDIRECT_URI));
    });
  });

  describe("login with popup", () => {
    vi.spyOn(browser as any, "openPopup").mockImplementation(() => "test");
    vi.spyOn(browser, "listenToPopup").mockResolvedValue(TEST_AUTH_RESPONSE);
    vi.spyOn(jwt, "validateIdToken").mockImplementation(() => {
      return { decodedJwt: TEST_ID_TOKEN_OBJECT.decoded, idToken: TEST_ID_TOKEN_OBJECT.encoded };
    });

    const spyOnValidateAuthorizeResponse = vi
      .spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "validateAuthorizeResponse")
      .mockImplementation((object) => (object as any).code);
    const spyOnRequestAndValidateTokens = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "requestAndValidateTokens");
    const spyOnParseAndSaveTokenResponse = vi.spyOn(NO_DEFAULT_IDAAS_CLIENT as any, "parseAndSaveTokenResponse");

    test("generateAuthorizationUrl is called", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(spyOnGenerateAuthorizationUrl).toBeCalled();
    });

    test("generateAuthorizationUrl gives the correct responseMode", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      const result = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const url = new URL(result.url);
      const searchParams = url.searchParams;
      const responseMode = searchParams.get("response_mode");

      expect(responseMode).toStrictEqual("web_message");
    });

    test("validateAuthorizeResponse is called", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(spyOnValidateAuthorizeResponse).toBeCalled();
    });

    test("requestAndValidateTokens is called", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(spyOnRequestAndValidateTokens).toBeCalled();
    });

    test("parseAndSaveTokens is called", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(spyOnParseAndSaveTokenResponse).toBeCalled();
    });

    test("redirects to new window if redirectUri is present", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true, redirectUri: TEST_REDIRECT_URI });

      expect(formatUrl(window.location.href)).toStrictEqual(TEST_REDIRECT_URI);
    });

    test("does not redirect to new window if redirectUri is not present", async () => {
      const startLocation = formatUrl(window.location.href);
      await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(formatUrl(window.location.href)).toStrictEqual(startLocation);
    });

    test("returns the access token generated", async () => {
      const result = await NO_DEFAULT_IDAAS_CLIENT.login({ popup: true });

      expect(result).toStrictEqual(TEST_ACCESS_TOKEN);
    });
  });
});
