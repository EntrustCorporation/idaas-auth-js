import type { AccessToken, ClientParams, IdToken, TokenParams } from "../../src/storage/StorageManager";
import {
  TEST_ACCESS_PAIR,
  TEST_BASE_URI,
  TEST_CLIENT_PAIR,
  TEST_ID_PAIR,
  TEST_OIDC_CONFIG,
  TEST_TOKEN_PAIR,
  TEST_TOKEN_RESPONSE,
  TEST_USER_INFO_STR,
} from "./constants";

interface Opts {
  audience?: string;
  scope?: string;
}

export const getAccessToken = (opts: Opts = {}): AccessToken => {
  const { audience, scope } = opts;

  return {
    accessToken: Bun.randomUUIDv7("base64"),
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    scope: scope ?? "openid profile email",
    audience: audience ?? "https://entrust.com/audience",
    refreshToken: "testingrefreshtoken",
    maxAgeExpiry: Math.floor(Date.now() / 1000) + 240,
    acr: "testingacrclaim",
  };
};

export const getClientParams = (): ClientParams => {
  return {
    nonce: Bun.randomUUIDv7("hex"),
    redirectUri: `${TEST_BASE_URI}/redirect`,
    codeVerifier: Bun.randomUUIDv7("hex"),
    state: Bun.randomUUIDv7("hex"),
  };
};

export const getIdToken = (): IdToken => {
  return {
    encoded: Bun.randomUUIDv7("base64"),
    decoded: {
      sub: "testingsubclaim",
      acr: "testingacrclaim",
    },
  };
};

export const getTokenParams = (): TokenParams => {
  return {
    scope: "openid profile email",
    audience: "https://entrust.com/audience",
  };
};

export const mockFetch = async (url, _config) => {
  switch (url) {
    case `${TEST_BASE_URI}/token`: {
      return Promise.resolve({
        json: () => Promise.resolve(TEST_TOKEN_RESPONSE),
      });
    }
    case `${TEST_BASE_URI}/issuer/.well-known/openid-configuration`: {
      return Promise.resolve({
        json: () => Promise.resolve(TEST_OIDC_CONFIG),
      });
    }
    case `${TEST_BASE_URI}/userinfo`: {
      return Promise.resolve({
        text: () => Promise.resolve(TEST_USER_INFO_STR),
      });
    }
  }
};

interface StoreData {
  idToken?: boolean;
  accessToken?: boolean;
  clientParams?: boolean;
  tokenParams?: boolean;
}

export const storeData = ({ idToken, accessToken, clientParams, tokenParams }: StoreData) => {
  if (idToken) {
    localStorage.setItem(TEST_ID_PAIR.key, JSON.stringify(TEST_ID_PAIR.data));
  }
  if (accessToken) {
    localStorage.setItem(TEST_ACCESS_PAIR.key, JSON.stringify(TEST_ACCESS_PAIR.data));
  }
  if (clientParams) {
    localStorage.setItem(TEST_CLIENT_PAIR.key, JSON.stringify(TEST_CLIENT_PAIR.data));
  }
  if (tokenParams) {
    localStorage.setItem(TEST_TOKEN_PAIR.key, JSON.stringify(TEST_TOKEN_PAIR.data));
  }
};

export const getUrlParams = (href: string) => {
  const url = new URL(href);
  const searchParams = url.searchParams;
  // biome-ignore lint: type depends on url, only use in tests
  const paramData: any = {};

  searchParams.forEach((val, key) => {
    paramData[key] = val;
  });

  return paramData;
};
