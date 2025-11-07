import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { formatUrl } from "../../../src/utils/format";
import * as urlUtils from "../../../src/utils/url";
import {
  NO_DEFAULT_IDAAS_CLIENT,
  SET_DEFAULTS_IDAAS_CLIENT,
  TEST_ACR_CLAIM,
  TEST_BASE_URI,
  TEST_CLIENT_PAIR,
  TEST_DIFFERENT_SCOPE,
  TEST_OIDC_CONFIG,
  TEST_REDIRECT_URI,
  TEST_SCOPE,
  TEST_TOKEN_PAIR,
} from "../constants";
import { getUrlParams, mockFetch } from "../helpers";

describe("IdaasClient.oidc.login", () => {
  // @ts-expect-error not full type
  const _spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);
  // @ts-expect-error accessing context
  const spyOnGetConfig = spyOn(NO_DEFAULT_IDAAS_CLIENT.oidc.context, "getConfig");
  const spyOnGenerateAuthorizationUrl = spyOn(urlUtils, "generateAuthorizationUrl");
  const startLocation = TEST_BASE_URI;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    window.location.href = startLocation;
  });

  test("throws error if attempting to login with popup, but web_message response mode not supported", () => {
    spyOnGetConfig.mockResolvedValueOnce({ ...TEST_OIDC_CONFIG, response_modes_supported: ["query"] });

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login({ popup: true });
    }).toThrowError();
  });

  test("redirects to authorization URL when popup is false", async () => {
    const startUrl = window.location.href;
    await NO_DEFAULT_IDAAS_CLIENT.oidc.login({ popup: false });

    // Should redirect to authorization endpoint
    expect(window.location.href).not.toBe(startUrl);
    expect(window.location.href).toContain("/authorization");
  });

  test("redirects to authorization URL when popup param not supplied (defaults to redirect)", async () => {
    const startUrl = window.location.href;
    await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

    // Should redirect to authorization endpoint (default behavior)
    expect(window.location.href).not.toBe(startUrl);
    expect(window.location.href).toContain("/authorization");
  });

  describe("login with redirect", () => {
    test("client params are saved", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      expect(localStorage.getItem(TEST_CLIENT_PAIR.key)).toBeTruthy();
    });

    test("token params are saved", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      expect(localStorage.getItem(TEST_TOKEN_PAIR.key)).toBeTruthy();
    });

    test("generates authorization URL with all required parameters", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      const { url, nonce, state, codeVerifier } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as {
        url: string;
        nonce: string;
        state: string;
        codeVerifier: string;
      };

      // Verify all required parameters are generated
      expect(url).toBeTruthy();
      expect(typeof url).toBe("string");
      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe("string");
      expect(state).toBeTruthy();
      expect(typeof state).toBe("string");
      expect(codeVerifier).toBeTruthy();
      expect(typeof codeVerifier).toBe("string");
    });

    describe("scopes in auth url", () => {
      test("auth url contains scopes", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);

        expect(scope).toBeTruthy();
      });

      test("scopes specified in login call are used", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.login({}, { scope: "test_scope1 test_scope2" });

        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);
        const scopeArr = scope.split(" ");

        expect(scopeArr).toContain("test_scope1");
        expect(scopeArr).toContain("test_scope2");
      });

      test("default scope used if none supplied in client constructor or login call", async () => {
        await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

        const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
        const { scope } = getUrlParams(authUrl);
        const sortedUrlScope = scope.split(" ").sort().join(", ");
        const sortedTestScope = TEST_SCOPE.split(" ").sort().join(", ");

        expect(sortedTestScope).toBeTruthy();
        expect(sortedUrlScope).toStrictEqual(sortedTestScope);
      });

      test("scope supplied in constructor used if not specified in login call", async () => {
        await SET_DEFAULTS_IDAAS_CLIENT.oidc.login();

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
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { response_mode, response_type } = getUrlParams(authUrl);

      expect(response_type).toStrictEqual("code");
      expect(response_mode).toStrictEqual("query");
    });

    test("auth url contains max_age param if maxAge >= 0", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login({}, { maxAge: 0 });

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age: maxAge } = getUrlParams(authUrl);

      expect(maxAge).toBe("0");
    });

    test("auth url does not contain max_age param if maxAge is undefined", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age } = getUrlParams(authUrl);

      expect(max_age).toBeUndefined();
    });

    test("auth url does not contain max_age param if maxAge is negative", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login({}, { maxAge: -1 });

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { max_age: maxAge } = getUrlParams(authUrl);

      expect(maxAge).toBeUndefined();
    });

    test("auth url contains acr_values if acrValues is passed", async () => {
      const thisTestDifferentAcr = "different";
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login({}, { acrValues: [TEST_ACR_CLAIM, thisTestDifferentAcr] });

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values: acrValuesFromUrl } = getUrlParams(authUrl);
      const acrArr = acrValuesFromUrl.split(" ");

      expect(acrArr).toContain(TEST_ACR_CLAIM);
      expect(acrArr).toContain(thisTestDifferentAcr);
    });

    test("auth url does not contain claims request if acrValues is not passed", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values } = getUrlParams(authUrl);

      expect(acr_values).toBeUndefined();
    });

    test("auth url does not contain claims request if acrValues is passed as empty array", async () => {
      await NO_DEFAULT_IDAAS_CLIENT.oidc.login({}, { acrValues: [] });

      const { url: authUrl } = (await spyOnGenerateAuthorizationUrl.mock.results[0].value) as { url: string };
      const { acr_values } = getUrlParams(authUrl);

      expect(acr_values).toBeUndefined();
    });

    test("redirects to the url provided by generateAuthorizationUrl", async () => {
      // @ts-expect-error same as all other .mockResolvedValue issues
      spyOnGenerateAuthorizationUrl.mockResolvedValueOnce({ url: TEST_REDIRECT_URI });

      await NO_DEFAULT_IDAAS_CLIENT.oidc.login();
      const newLocation = formatUrl(window.location.href);

      expect(newLocation).toStrictEqual(formatUrl(TEST_REDIRECT_URI));
    });
  });

  // Note: Popup flow tests have been removed as they were testing implementation details
  // (private method calls and internal state) which are fragile and not valuable.
  // The popup login flow is adequately covered by E2E tests.
});
