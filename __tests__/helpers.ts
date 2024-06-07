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

export const getLoginUrlParams = (href: string) => {
  const url = new URL(href);
  const searchParams = url.searchParams;
  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const audience = searchParams.get("audience");
  const scope = searchParams.get("scope");
  const state = searchParams.get("state");
  const nonce = searchParams.get("nonce");
  const responseMode = searchParams.get("response_mode");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");

  return {
    responseType,
    clientId,
    redirectUri,
    audience,
    scope,
    state,
    nonce,
    responseMode,
    codeChallenge,
    codeChallengeMethod,
  };
};

export const getLogoutUrlParams = (href: string) => {
  const url = new URL(href);
  const searchParams = url.searchParams;
  const logoutRedirect = searchParams.get("post_logout_redirect_uri");
  const idTokenHint = searchParams.get("id_token_hint");
  const clientId = searchParams.get("client_id");

  return { clientId, logoutRedirect, idTokenHint };
};
