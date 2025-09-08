import type { JWTPayload } from "jose";
import { IdaasClient } from "../../src";
import type { OidcConfig, TokenResponse } from "../../src/api";
import type { AuthorizeResponse } from "../../src/models";
import type { AccessToken, ClientParams, IdToken, TokenParams } from "../../src/storage/StorageManager";
import type { ValidateIdTokenParams, ValidateUserInfoTokenParams } from "../../src/utils/jwt";

export const TEST_BASE_URI = "https://testing.com";
export const TEST_CLIENT_ID = "testingclientid";
export const TEST_ID_TOKEN = "testingidtoken";
export const TEST_NONCE = "testingnonce";
export const TEST_ISSUER_URI = `${TEST_BASE_URI}/issuer`;
export const TEST_ID_TOKEN_SIGNING_ALG_SUPPORTED = ["none", "123"];
export const TEST_SCOPE = "openid profile email";
export const TEST_AUDIENCE = `${TEST_BASE_URI}/audience`;
export const TEST_ACCESS_TOKEN = "testingaccesstoken";
export const TEST_REDIRECT_URI = `${TEST_BASE_URI}/redirect`;
export const TEST_REFRESH_TOKEN = "testingrefreshtoken";
export const TEST_CODE_VERIFIER = "testingcodeverifier";
export const TEST_STATE = "testingstate";
export const TEST_CODE = "testingcode";
export const TEST_SUB_CLAIM = "testingsubclaim";
export const TEST_USER_INFO_STR = `{"sub": "${TEST_SUB_CLAIM}"}`;
export const TEST_ACR_SUPPORTED = ["1"];
export const TEST_JWKS_ENDPOINT = `${TEST_BASE_URI}/jwks`;
export const TEST_DIFFERENT_SCOPE = "different scope";
export const TEST_DIFFERENT_AUDIENCE = "differentAudience";
export const TEST_DIFFERENT_ACCESS_TOKEN = "differentAccessToken";
export const TEST_ACR_CLAIM = "testingacrclaim";
export const TEST_ENCODED_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0aW5nIiwiaXNzIjoidGVzdGluZ2lzc3VlciIsImFjciI6InVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDphYzpjbGFzc2VzOlRpbWVTeW5jVG9rZW4iLCJuYmYiOjE3MjI5NTE5NCwiYXV0aF90aW1lIjoxNzIyOTUxOTQsImV4cCI6MTcyMjk1MjI0LCJpYXQiOjE3MjI5NTE5NH0.7zCvyEgOe07ehsEytm7YAqUwVsCNbv5VOBd_vfqxaUY";
export const TEST_USER_ID = "testingUserId";
export const NO_DEFAULT_IDAAS_CLIENT = new IdaasClient({
  issuerUrl: TEST_ISSUER_URI,
  clientId: TEST_CLIENT_ID,
  storageType: "localstorage",
});

export const SET_DEFAULTS_IDAAS_CLIENT = new IdaasClient({
  issuerUrl: TEST_ISSUER_URI,
  clientId: TEST_CLIENT_ID,
  globalScope: TEST_DIFFERENT_SCOPE,
  globalAudience: TEST_DIFFERENT_AUDIENCE,
  storageType: "localstorage",
});

export const TEST_TOKEN_PARAMS: TokenParams = {
  scope: TEST_SCOPE,
  audience: TEST_AUDIENCE,
};

export const TEST_ACCESS_TOKEN_OBJECT: AccessToken = {
  accessToken: TEST_ACCESS_TOKEN,
  expiresAt: Math.floor(Date.now() / 1000) + 120,
  scope: TEST_SCOPE,
  audience: TEST_AUDIENCE,
  refreshToken: TEST_REFRESH_TOKEN,
  maxAgeExpiry: Math.floor(Date.now() / 1000) + 240,
  acr: TEST_ACR_CLAIM,
};

export const TEST_CLIENT_PARAMS: ClientParams = {
  nonce: TEST_NONCE,
  redirectUri: TEST_REDIRECT_URI,
  codeVerifier: TEST_CODE_VERIFIER,
  state: TEST_STATE,
};

export const TEST_JWT_PAYLOAD: JWTPayload = {
  sub: TEST_SUB_CLAIM,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 120,
  aud: TEST_CLIENT_ID,
  iss: TEST_ISSUER_URI,
  nbf: Math.floor(Date.now() / 1000),
  jti: "jti",
  nonce: TEST_NONCE,
  azp: TEST_CLIENT_ID,
};

export const TEST_VALIDATE_USER_INFO_PARAMS: ValidateUserInfoTokenParams = {
  userInfoToken: "adsa",
  issuer: TEST_ISSUER_URI,
  clientId: TEST_CLIENT_ID,
  jwksEndpoint: TEST_JWKS_ENDPOINT,
};

export const TEST_VALIDATE_ID_TOKEN_PARAMS: ValidateIdTokenParams = {
  idToken: TEST_JWT_PAYLOAD,
  clientId: TEST_CLIENT_ID,
  issuer: TEST_ISSUER_URI,
  nonce: TEST_NONCE,
  idTokenSigningAlgValuesSupported: TEST_ID_TOKEN_SIGNING_ALG_SUPPORTED,
  acrValuesSupported: TEST_ACR_SUPPORTED,
};

export const TEST_ID_TOKEN_OBJECT: IdToken = {
  encoded: TEST_ID_TOKEN,
  decoded: { sub: TEST_SUB_CLAIM, acr: TEST_ACR_CLAIM },
};

export const TEST_OIDC_CONFIG: OidcConfig = {
  issuer: TEST_ISSUER_URI,
  authorization_endpoint: `${TEST_BASE_URI}/authorization`,
  token_endpoint: `${TEST_BASE_URI}/token`,
  userinfo_endpoint: `${TEST_BASE_URI}/userinfo`,
  jwks_uri: TEST_JWKS_ENDPOINT,
  registration_endpoint: `${TEST_BASE_URI}/registration`,
  scopes_supported: ["openid", "profile", "email", "offline_access"],
  response_modes_supported: ["query", "web_message"],
  grant_types_supported: ["0", "1", "2", "3"],
  acr_values_supported: TEST_ACR_SUPPORTED,
  subject_types_supported: ["0", "1", "2", "3"],
  id_token_signing_alg_values_supported: TEST_ID_TOKEN_SIGNING_ALG_SUPPORTED,
  claims_supported: ["0", "1", "2", "3"],
  end_session_endpoint: `${TEST_BASE_URI}/endsession`,
};

export const TEST_AUTH_RESPONSE: AuthorizeResponse = {
  code: TEST_CODE,
  state: TEST_STATE,
  error: null,
  error_description: null,
};

export const TEST_TOKEN_RESPONSE: TokenResponse = {
  refresh_token: TEST_REFRESH_TOKEN,
  scope: TEST_SCOPE,
  id_token: TEST_ID_TOKEN,
  access_token: TEST_ACCESS_TOKEN,
  expires_in: "300",
  token_type: "Bearer",
};

export const TEST_ACCESS_TOKEN_KEY = `entrust.${TEST_CLIENT_ID}.accessTokens`;

export const TEST_ACCESS_PAIR = {
  key: TEST_ACCESS_TOKEN_KEY,
  data: [TEST_ACCESS_TOKEN_OBJECT],
};

export const TEST_ID_TOKEN_KEY = `entrust.${TEST_CLIENT_ID}.idToken`;

export const TEST_ID_PAIR = {
  key: TEST_ID_TOKEN_KEY,
  data: TEST_ID_TOKEN_OBJECT,
};

export const TEST_CLIENT_PARAMS_KEY = `entrust.${TEST_CLIENT_ID}.clientParams`;

export const TEST_CLIENT_PAIR = {
  key: TEST_CLIENT_PARAMS_KEY,
  data: TEST_CLIENT_PARAMS,
};

export const TEST_TOKEN_PARAMS_KEY = `entrust.${TEST_CLIENT_ID}.tokenParams`;

export const TEST_TOKEN_PAIR = {
  key: TEST_TOKEN_PARAMS_KEY,
  data: TEST_TOKEN_PARAMS,
};
