// URL generation functions
import type { OidcConfig } from "../api";
import type { TokenOptions } from "../models";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "../utils/crypto";

export interface GenerateAuthorizationUrlOptions {
  // Common parameters
  clientId: string;
  tokenOptions: TokenOptions;

  // OIDC flow params
  responseMode?: "query" | "web_message";
  redirectUri?: string;

  // Control parameters
  type: "standard" | "jwt";
}

export interface AuthorizationUrlResult {
  url: string;
  nonce: string;
  state: string;
  codeVerifier: string;
  usedScope: string;
}

/**
 * Unified method to generate authorization URLs for both standard OIDC flows and JWT auth flows
 * @param oidcConfig - OIDC configuration with endpoints
 * @param options - Authorization URL generation options
 * @returns Authorization URL details including url, state, nonce and code verifier
 */
export const generateAuthorizationUrl = async (
  oidcConfig: OidcConfig,
  options: GenerateAuthorizationUrlOptions,
): Promise<AuthorizationUrlResult> => {
  // Determine the base URL based on flow type
  let baseUrl: string;
  if (options.type === "jwt") {
    baseUrl = `${oidcConfig.issuer}/authorizejwt`;
  } else {
    baseUrl = oidcConfig.authorization_endpoint;
  }

  // Process scope (default to empty string if not provided)
  const scopeAsArray = options.tokenOptions.scope ? options.tokenOptions.scope.split(" ").filter(Boolean) : [];
  scopeAsArray.push("openid");

  if (options.tokenOptions.useRefreshToken) {
    scopeAsArray.push("offline_access");
  }

  // Remove duplicate scopes
  const usedScope = [...new Set(scopeAsArray)].join(" ");

  // Generate cryptographic values
  const state = base64UrlStringEncode(createRandomString());
  const nonce = base64UrlStringEncode(createRandomString());
  const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();

  // Build URL
  const url = new URL(baseUrl);

  // Add common parameters
  url.searchParams.append("client_id", options.clientId);
  url.searchParams.append("scope", usedScope);
  url.searchParams.append("state", state);
  url.searchParams.append("nonce", nonce);
  url.searchParams.append("code_challenge", codeChallenge);
  url.searchParams.append("code_challenge_method", "S256");

  if (options.tokenOptions.audience) {
    url.searchParams.append("audience", options.tokenOptions.audience);
  }

  // Add maxAge if provided and >= 0
  if (options.tokenOptions.maxAge !== undefined && options.tokenOptions.maxAge >= 0) {
    url.searchParams.append("max_age", options.tokenOptions.maxAge.toString());
  }

  // Add ACR values if provided
  if (options.tokenOptions.acrValues && options.tokenOptions.acrValues.length > 0) {
    url.searchParams.append("acr_values", options.tokenOptions.acrValues.join(" "));
  }

  url.searchParams.append("response_type", "code");

  // Add OIDC flow parameters
  if (options.type === "standard") {
    if (options.responseMode) {
      url.searchParams.append("response_mode", options.responseMode);
    }

    if (options.redirectUri) {
      url.searchParams.append("redirect_uri", options.redirectUri);
    }
  }

  return {
    url: url.toString(),
    nonce,
    state,
    codeVerifier,
    usedScope,
  };
};
