import { type AccessTokenRequest, requestToken } from "../api";
import type { ValidatedTokenResponse } from "../IdaasClient";
import type { IdaasContext } from "../IdaasContext";
import type { AccessToken, StorageManager } from "../storage/StorageManager";
import { calculateEpochExpiry } from "../utils/format";
import { readAccessToken, validateIdToken } from "../utils/jwt";

/**
 * Exchanges an authorization code for tokens and validates the ID token.
 *
 * Makes a token request to the OIDC provider using the authorization code
 * and PKCE code verifier, then validates the returned ID token's signature
 * and claims.
 *
 * @param code - Authorization code received from the authorization endpoint
 * @param codeVerifier - PKCE code verifier used during the authorization request
 * @param redirectUri - Redirect URI used in the authorization request
 * @param nonce - Nonce value to validate in the ID token
 */
export const requestAndValidateTokens = async (
  code: string,
  codeVerifier: string,
  redirectUri: string,
  nonce: string,
  context: IdaasContext,
) => {
  const { token_endpoint, id_token_signing_alg_values_supported, acr_values_supported } = await context.getConfig();

  const tokenRequest: AccessTokenRequest = {
    client_id: context.clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  };

  const tokenResponse = await requestToken(token_endpoint, tokenRequest);

  const { decodedJwt: decodedIdToken, idToken } = validateIdToken({
    clientId: context.clientId,
    idToken: tokenResponse.id_token,
    issuer: context.issuerUrl,
    nonce,
    idTokenSigningAlgValuesSupported: id_token_signing_alg_values_supported,
    acrValuesSupported: acr_values_supported,
  });

  return { tokenResponse, decodedIdToken, encodedIdToken: idToken };
};

/**
 * Parses the token response from the OIDC provider and saves tokens to storage.
 * Extracts access token, ID token, and refresh token (if available).
 * @param validatedTokenResponse The validated response from the token endpoint
 * @param storageManager The storage manager instance to save tokens
 */
export const parseAndSaveTokenResponse = (
  validatedTokenResponse: ValidatedTokenResponse,
  storageManager: StorageManager,
): void => {
  const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
  const { refresh_token, access_token, expires_in } = tokenResponse;
  const authTime = readAccessToken(access_token)?.auth_time;
  const expiresAt = calculateEpochExpiry(expires_in, authTime);
  const tokenParams = storageManager.getTokenParams();

  if (!tokenParams) {
    throw new Error("No token params stored, unable to parse");
  }

  const { audience, scope, maxAge } = tokenParams;
  const maxAgeExpiry = maxAge ? calculateEpochExpiry(maxAge.toString(), authTime) : undefined;

  storageManager.removeTokenParams();

  const token = readAccessToken(access_token);
  const acr = token?.acr ?? undefined;

  const newAccessToken: AccessToken = {
    refreshToken: refresh_token,
    accessToken: access_token,
    expiresAt,
    audience,
    scope,
    maxAgeExpiry,
    acr,
  };

  storageManager.saveIdToken({
    encoded: encodedIdToken,
    decoded: decodedIdToken,
  });
  storageManager.saveAccessToken(newAccessToken);
};
