/**
 * The configurable options of the IdaasClient.
 */
export interface IdaasClientOptions {
  issuerUrl: string;
  clientId: string;
  defaultScope?: string;
  defaultAudience?: string;
  defaultUseRefreshToken?: boolean;
}

/**
 * The searchParams returned to the browser after an attempted OIDC login.
 */
export interface AuthorizeResponse {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
}

/**
 * The standard user claims of OIDC.
 */
export interface UserClaims {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: string;
  updated_at?: number;
  [propName: string]: unknown;
}

/**
 * The configurable options for the Login method.
 */
export interface LoginOptions {
  audience?: string;
  scope?: string;
  redirectUri?: string;
  useRefreshToken?: boolean;
  popup?: boolean;
}

/**
 * The configurable options when requesting an AccessToken.
 */
export interface GetAccessTokenOptions {
  audience?: string;
  scope?: string;
  fallback?: "redirect" | "popup";
  redirectUri?: string;
  useRefreshToken?: boolean;
}
