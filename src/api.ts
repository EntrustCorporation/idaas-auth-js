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
  id_token?: string;
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
  const wellKnownUrl = `${issuerUrl}/.well-known/openid-configuration`;

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
  tokenRequest: AccessTokenRequest | RefreshTokenRequest,
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
