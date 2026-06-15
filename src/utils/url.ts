// URL generation functions
import type { TokenOptions } from "../models";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "../utils/crypto";

export interface GenerateAuthorizationUrlOptions {
  // Common parameters
  clientId: string;
  tokenOptions: TokenOptions;

  // OIDC flow params
  baseUrl: string;
  responseMode?: "query" | "web_message";
  redirectUri?: string;
}

export interface AuthorizationUrlResult {
  url: string;
  nonce: string;
  state: string;
  codeVerifier: string;
  usedScope: string;
}

/**
 * Generates an authorization URL for OIDC and JWT auth flows.
 * @param options - Authorization URL generation options
 * @returns Authorization URL details including url, state, nonce and code verifier
 */
export const generateAuthorizationUrl = async (
  options: GenerateAuthorizationUrlOptions,
): Promise<AuthorizationUrlResult> => {
  // Process scope (default to empty string if not provided)
  const scopeAsArray = options.tokenOptions.scope ? options.tokenOptions.scope.split(" ").filter(Boolean) : [];

  // Add openid scope if requested (for OIDC authentication to receive ID token)
  if (options.tokenOptions.includeOpenidScope !== false) {
    scopeAsArray.push("openid");
  }

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
  const url = new URL(options.baseUrl);

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
  if (options.tokenOptions.acrValues && options.tokenOptions.acrValues.trim().length > 0) {
    url.searchParams.append("acr_values", options.tokenOptions.acrValues);
  }

  url.searchParams.append("response_type", "code");

  // If offline_access is requested, add prompt=consent
  if (scopeAsArray.includes("offline_access")) {
    url.searchParams.append("prompt", "consent");
  }

  // Add OIDC flow parameters
  if (options.responseMode) {
    url.searchParams.append("response_mode", options.responseMode);
  }

  if (options.redirectUri) {
    url.searchParams.append("redirect_uri", options.redirectUri);
  }

  return {
    url: url.toString(),
    nonce,
    state,
    codeVerifier,
    usedScope,
  };
};
