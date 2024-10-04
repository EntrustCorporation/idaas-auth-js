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
  const paramData: any = {};

  searchParams.forEach((val, key) => {
    paramData[key] = val;
  });

  return paramData;
};
