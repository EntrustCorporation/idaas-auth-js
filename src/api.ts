import type { JWTPayload } from "jose";
import type { IdaasAuthenticationMethod } from "./models/";
import type {
  AuthenticatedResponse,
  ErrorInfo,
  UserAuthenticateParameters,
  UserAuthenticateQueryParameters,
  UserAuthenticateQueryResponse,
  UserChallengeParameters,
} from "./models/openapi-ts";
import {
  logoutUsingPost,
  userAuthenticateUsingPost,
  userAuthenticatorQueryUsingPost,
  userChallengeUsingPost,
} from "./models/openapi-ts";

/**
 * Interface describing the OpenID provider metadata retrieved during OIDC discovery.
 *
 * This is a non-exhaustive interface, and only describes the required fields and those relevant for this client implementation.
 * See more at: https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  acr_values_supported?: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  claims_supported: string[];
  end_session_endpoint: string;
}

/**
 * Required body to present to the Token endpoint.
 *
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
 */
export interface AccessTokenRequest {
  grant_type: "authorization_code";
  code: string;
  code_verifier: string;
  redirect_uri: string;
  client_id: string;
  claims?: string;
}

export interface JwtIdaasTokenRequest {
  grant_type: "jwt_idaas";
  code: string;
  code_verifier: string;
  client_id: string;
  jwt: string;
}

/**
 * Required body to present to the Token endpoint when refreshing tokens.
 *
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#RefreshTokens
 */
export interface RefreshTokenRequest {
  grant_type: "refresh_token";
  refresh_token: string;
  client_id: string;
}

/**
 * Success response from the Token endpoint after making a token request.
 *
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse, https://openid.net/specs/openid-connect-core-1_0.html#RefreshTokenResponse
 */
export interface TokenResponse {
  access_token: string;
  id_token?: string | JWTPayload;
  token_type: string;
  expires_in: string;
  refresh_token?: string;
  scope?: string;
}

/**
 * Fetch the public OpenID Provider (OP) metadata from a well-known endpoint as part of the OIDC discovery specification.
 *
 * See more at: https://openid.net/specs/openid-connect-discovery-1_0.html
 * @param issuerUrl the OP's issuer location
 */
export const fetchOpenidConfiguration = async (issuerUrl: string): Promise<OidcConfig> => {
  const normalizedIssuerUrl = issuerUrl.trim().replace(/\/+$/, "");
  const wellKnownUrl = `${normalizedIssuerUrl}/.well-known/openid-configuration`;

  const response = await fetch(wellKnownUrl);

  return await response.json();
};

/**
 * Make a request to the Token endpoint to fetch the access token, ID token, and refresh token (optional).
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint

 * Make a request to the Token endpoint to fetch a new access token and refresh token.
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#RefreshingAccessToken
 *
 * @param tokenEndpoint the token endpoint as defined in the public OpenID provider metadata
 * @param tokenRequest the authorization grant, in the form of an authorization code
 */
export const requestToken = async (
  tokenEndpoint: string,
  tokenRequest: AccessTokenRequest | RefreshTokenRequest | JwtIdaasTokenRequest,
): Promise<TokenResponse> => {
  const searchParams = new URLSearchParams({
    ...tokenRequest,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: searchParams,
  });

  return await response.json();
};

/**
 * Make a request to the userinfo endpoint.
 *
 * @param userInfoEndpoint the UserInfo endpoint as defined in the public OpenID provider metadata
 * @param accessToken an access token retrieved through the OIDC ceremony, with the OP as the audience
 * @return a string representing either a JSON object or a signed jwt containing the user claims, depending on the OIDC
 * application configuration
 */
export const getUserInfo = async (userInfoEndpoint: string, accessToken: string) => {
  const response = await fetch(userInfoEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return await response.text();
};

/**
 * Queries the IDaaS Authentication API for authentication options available to the user.
 *
 * @param requestBody the body of the request to send
 * @param baseUrl the origin of the url to send the request to
 */
export const queryUserAuthOptions = async (
  requestBody: UserAuthenticateQueryParameters,
  baseUrl: string,
): Promise<UserAuthenticateQueryResponse> => {
  const { data, error } = await userAuthenticatorQueryUsingPost({
    baseUrl,
    body: { ...requestBody },
  });

  if (error) {
    throw parseResponseError(error);
  }
  return data;
};

/**
 * Requests an authentication challenge from the IDaaS Authentication API.
 *
 * @param requestBody the body of the request to send
 * @param authenticator the method of authentication to request a challenge for
 * @param baseUrl the origin of the url to send the request to
 */
export const requestAuthChallenge = async (
  requestBody: UserChallengeParameters,
  authenticator: IdaasAuthenticationMethod,
  baseUrl: string,
): Promise<AuthenticatedResponse> => {
  const { data, error } = await userChallengeUsingPost({
    baseUrl,
    body: { ...requestBody },
    path: { authenticator },
  });

  if (error) {
    throw parseResponseError(error);
  }
  return data;
};

/**
 * Sends the user's response to an authentication challenge to the IDaaS Authentication API.
 *
 * @param requestBody the body of the request to send
 * @param authenticator the method of authentication that was used
 * @param authorization the token received when requesting the challenge
 * @param baseUrl the origin of the url to send the request to
 */
export const submitAuthChallenge = async (
  requestBody: UserAuthenticateParameters,
  authenticator: IdaasAuthenticationMethod,
  authorization: string,
  baseUrl: string,
): Promise<AuthenticatedResponse> => {
  const { data, error } = await userAuthenticateUsingPost({
    baseUrl,
    headers: { Authorization: authorization },
    body: { ...requestBody },
    path: { authenticator },
  });

  if (error) {
    throw parseResponseError(error);
  }
  return data;
};

/**
 * Revokes the server session without redirecting the browser by calling the logout endpoint.
 *
 * @param authorization bearer token identifying the session to terminate
 * @param baseUrl origin of the IDaaS API host
 */
export const logoutSilently = async (authorization: string, baseUrl: string): Promise<void> => {
  const { error } = await logoutUsingPost({
    baseUrl,
    headers: { Authorization: `Bearer ${authorization}` },
  });

  if (error) {
    throw parseResponseError(error);
  }
};

export const getAuthRequestId = async (endpoint: string) => {
  const response = await fetch(endpoint, {
    method: "POST",
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.error_description, {
      cause: responseJson.error,
    });
  }

  return responseJson;
};

const parseResponseError = (errorResponse: ErrorInfo) => {
  return new Error(errorResponse.errorCode, {
    cause: errorResponse.errorMessage,
  });
};
