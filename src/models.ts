/**
 * The configurable options of the IdaasClient.
 */
export interface IdaasClientOptions {
  /**
   * The issuer to be used for validation of JWTs and for fetching API endpoints, typically `https://{yourIdaasDomain}.region.trustedauth.com/api/oidc`.
   */
  issuerUrl: string;

  /**
   * The Client ID found on your IDaaS Application settings page.
   */
  clientId: string;

  /**
   * The global scope to be used.
   *
   * This defaults to `openid profile email` if not set. If you are setting extra scopes and require `profile` and `email` to be included then you must include them in the provided scope.
   *
   * Note: The `openid` scope is always applied regardless of this setting.
   */
  globalScope?: string;

  /**
   * The global audience to be used for requesting API access.
   */
  globalAudience?: string;

  /**
   * If true, refresh tokens are used to fetch new access tokens from the IDaaS server.
   * The default setting is `false`.
   *
   * Note: Use of refresh tokens must be enabled on your IDaaS client application. Tokens using refresh tokens will have the `offline_access` scope applied.
   */
  globalUseRefreshToken?: boolean;
}

/**
 * The configurable options for the Login method.
 */
export interface LoginOptions {
  /**
   * The audience to be used for requesting API access. This defaults to the `globalAudience` set in your `IdaasClientOptions` if not set.
   */
  audience?: string;

  /**
   * The scope to be used on this authentication request.
   *
   * This defaults to the `globalScope` in your `IdaasClientOptions` if not set. If you are setting extra scopes and require `profile` and `email` to be included then you must include them in the provided scope.
   *
   * Note: The `openid` scope is always applied regardless of this setting.
   */
  scope?: string;

  /**
   * The URI to be redirected to after a successful login. The default value is the current page.
   * This URI must be included in the `Login Redirect URI(s)` field in your IDaaS client application settings.
   */
  redirectUri?: string;

  /**
   * Determines whether the token obtained from this login request can use refresh tokens.  This defaults to the `globalUseRefreshToken` set in your `IdaasClientOptions` if not set.
   *
   * Note: Use of refresh tokens must be enabled on your IDaaS client application.
   */
  useRefreshToken?: boolean;

  /**
   * Determines the method of login that will be used to authenticate the user.
   * The default setting is `false`.
   */
  popup?: boolean;

  /**
   * Determines the strength/quality of the method used to authenticate the user.
   */
  acrValues?: string[];

  /**
   * Specifies the maximum age of a token, this value does not change on token refresh.
   */
  maxAge?: string;
}

/**
 * The configurable options for the Logout method.
 */
export interface LogoutOptions {
  /**
   * The URI to be redirected to after a successful logout. This URI must be included in the `Logout Redirect URI(s)` field in your IDaaS client application settings.
   */
  redirectUri?: string;
}

/**
 * The configurable options for a fallback login.
 */
export interface FallbackAuthorizationOptions {
  /**
   * The URI to be redirected to after a successful login. The default value is the current page.
   * This URI must be included in the `Login Redirect URI(s)` field in your IDaaS client application settings.
   */
  redirectUri?: string;

  /**
   * Determines whether the token obtained from this login request can use refresh tokens.  This defaults to the `globalUseRefreshToken` set in your `IdaasClientOptions` if not set.
   *
   * Note: Use of refresh tokens must be enabled on your IDaaS client application.
   */
  useRefreshToken?: boolean;

  /**
   * Determines the method of login that will be used to authenticate the user.
   * The default setting is `false`.
   */
  popup?: boolean;

  /**
   * Determines the strength/quality of the method used to authenticate the user.
   */
  acrValues?: string[];
}

/**
 * The configurable options when requesting an AccessToken.
 */
export interface GetAccessTokenOptions {
  /**
   * The audience the token must have. This defaults to the `globalAudience` in your `IdaasClientOptions` if not set.
   */
  audience?: string;

  /**
   * The scope(s) the token must have. This defaults to the `globalScope` in your `IdaasClientOptions` if not set.
   */
  scope?: string;

  /**
   * The acr value(s) that are acceptable for this token to have, the returned token's acr claim will be one of these values.
   */
  acrValues?: string[];

  /**
   * The values that will be used to attempt a login if the requested token is not found.
   */
  fallbackAuthorizationOptions?: FallbackAuthorizationOptions;
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
