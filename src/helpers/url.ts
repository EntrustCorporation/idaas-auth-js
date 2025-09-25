// URL generation functions
import type { OidcConfig } from "../api";
import type { IdaasContext } from "../IdaasContext";
import type { AuthorizeResponse } from "../models";
import type { StorageManager } from "../storage/StorageManager";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "../utils/crypto";

export interface GenerateAuthorizationUrlOptions {
  // Common parameters
  clientId: string;
  scope?: string;
  audience?: string;
  acrValues?: string[];
  maxAge?: number;
  useRefreshToken?: boolean;

  // Authorization type specific params
  responseMode?: "query" | "web_message";
  redirectUri?: string;

  // Control parameters
  type: "standard" | "jwt";

  // For JWT flows, we need issuer for the endpoint
  issuer?: string;

  // Optional storage manager to save params
  storageManager?: StorageManager;
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
    if (!options.issuer) {
      throw new Error("Issuer is required for JWT authorization URLs");
    }
    baseUrl = `${options.issuer}/authorizejwt`;
  } else {
    baseUrl = oidcConfig.authorization_endpoint;
  }

  // Process scope
  const scopeAsArray = (options.scope || "").split(" ").filter(Boolean);
  scopeAsArray.push("openid");

  if (options.useRefreshToken) {
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

  if (options.audience) {
    url.searchParams.append("audience", options.audience);
  }

  // Add maxAge if provided and >= 0
  if (options.maxAge !== undefined && options.maxAge >= 0) {
    url.searchParams.append("max_age", options.maxAge.toString());
  }

  // Add ACR values if provided
  if (options.acrValues && options.acrValues.length > 0) {
    url.searchParams.append("acr_values", options.acrValues.join(" "));
  }

  // Add OIDC-specific parameters
  if (options.type === "standard") {
    url.searchParams.append("response_type", "code");

    if (options.responseMode) {
      url.searchParams.append("response_mode", options.responseMode);
    }

    if (options.redirectUri) {
      url.searchParams.append("redirect_uri", options.redirectUri);
    }
  }

  // Save token parameters if storage manager provided
  if (options.storageManager) {
    if (options.maxAge !== undefined && options.maxAge >= 0) {
      options.storageManager.saveTokenParams({
        audience: options.audience,
        scope: usedScope,
        maxAge: options.maxAge,
      });
    } else {
      options.storageManager.saveTokenParams({
        audience: options.audience,
        scope: usedScope,
      });
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

/**
 * Generate the endsession url with the required query params to log out the user from the OpenID Provider
 * @param context - The IdaasContext containing configuration and client ID
 * @param redirectUri - Optional URI to redirect to after logout
 * @returns The complete logout URL
 */
export const generateLogoutUrl = async (context: IdaasContext, redirectUri?: string): Promise<string> => {
  const { end_session_endpoint } = await context.getConfig();

  const url = new URL(end_session_endpoint);
  url.searchParams.append("client_id", context.clientId);
  if (redirectUri) {
    url.searchParams.append("post_logout_redirect_uri", redirectUri);
  }
  return url.toString();
};

/**
 * Parses the current URL for OIDC authorization response parameters and cleans up the URL.
 *
 * Extracts state, code, and error parameters from the current URL, then removes
 * these query parameters to prevent them from being reused in subsequent operations.
 *
 * @returns {AuthorizeResponse | null} Authorization response object or null if invalid
 */
export const parseRedirect = (): AuthorizeResponse | null => {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;

  if (searchParams.toString() === "") {
    return null;
  }

  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  // Authorization response must always contain state
  if (!state) {
    return null;
  }

  // Authorization response must contain code OR error
  if (!(code || error)) {
    return null;
  }

  url.search = "";
  window.history.replaceState(null, document.title, url.toString());

  return {
    state,
    code,
    error,
    error_description,
  };
};

/**
 * Validates the OIDC authorization response.
 *
 * @param response - The authorization response from redirect
 * @param expectedState - The state value from the initial authorization request
 * @returns The authorization code for token exchange
 * @throws Error if validation fails
 */
export const validateAuthorizeResponse = (
  { state, code, error, error_description }: AuthorizeResponse,
  expectedState: string,
): string => {
  if (error) {
    throw new Error("Error during authorization", {
      cause: error_description,
    });
  }

  if (!(code && state)) {
    throw new Error("URL must contain state and code for the authorization flow");
  }

  if (expectedState !== state) {
    throw new Error("State received during redirect does not match the state from the beginning of the OIDC ceremony");
  }

  return code;
};
