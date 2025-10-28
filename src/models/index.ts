import type { OidcConfig } from "../api";
import type {
  FaceChallenge,
  GridChallenge,
  KbaChallenge,
  TempAccessCodeChallenge,
  TransactionDetail,
  UserChallengeParameters,
} from "./openapi-ts";

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
   * The storage mechanism to use for ID and access tokens.
   *
   * @default "memory"
   */
  storageType?: "memory" | "localstorage";

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
 * Options for smart credential authentication.
 */
export interface SmartCredentialOptions {
  /**
   * The push authentication challenge that appears in the user's mobile application.
   */
  summary?: string;

  /**
   * Defines an identifier to retrieve customized SDK push message configuration.
   */
  pushMessageIdentifier?: string;
}

/**
 * The configurable options for the `login` and `requestChallenge` methods.
 */
export interface TokenOptions {
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
   * Determines whether the token obtained from this login request can use refresh tokens.  This defaults to the `globalUseRefreshToken` set in your `IdaasClientOptions` if not set.
   *
   * Note: Use of refresh tokens must be enabled on your IDaaS client application.
   */
  useRefreshToken?: boolean;

  /**
   * Specifies the maximum age of a token in seconds.
   * When tokens are refreshed using a refresh token, the original authentication time is preserved and this maxAge value continues to apply to that original authentication timestamp, not the refresh time.
   */
  maxAge?: number;

  /**
   * Determines the strength/quality of the method used to authenticate the user.
   */
  acrValues?: string[];
}

/**
 * The configurable options specific to the OIDC `login` method.
 */
export interface OidcLoginOptions {
  /**
   * The URI to be redirected to after a successful login. The default value is the current page.
   * This URI must be included in the `Login Redirect URI(s)` field in your IDaaS client application settings.
   */
  redirectUri?: string;

  /**
   * Determines the method of login that will be used to authenticate the user.
   * The default setting is `false`.
   */
  popup?: boolean;
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

export interface AuthenticationTransactionOptions {
  /**
   * The OIDC config of the IDaaSClient.
   */
  oidcConfig: OidcConfig;

  /**
   * The client ID of the IDaasClient.
   */
  clientId: string;

  /**
   * The configurable options when requesting an authentication challenge.
   */
  authenticationRequestParams?: AuthenticationRequestParams;

  /**
   * The configurable options when requesting an AccessToken.
   */
  tokenOptions: TokenOptions;

  /**
   * Determines whether the token obtained from this login request can use refresh tokens.  This defaults to the `globalUseRefreshToken` set in your `IdaasClientOptions` if not set.
   *
   * Note: Use of refresh tokens must be enabled on your IDaaS client application.
   */
  useRefreshToken: boolean;
}

/**
 * The configurable options when requesting a FACE authentication challenge.
 */
export interface FaceBiometricOptions {
  /**
   * Determines if the user must answer a mutual challenge for the FACE authenticators.
   */
  mutualChallenge?: boolean;
}

/**
 * The configurable options when requesting a TOKEN/TOKENPUSH authentication challenge.
 */
export interface SoftTokenOptions {
  /**
   * Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
   */
  push?: boolean;

  /**
   * Determines if the user must answer a mutual challenge for the TOKENPUSH authenticators. Ignored if push is false.
   */
  mutualChallenge?: boolean;
}
export interface OtpOptions {
  /**
   * The delivery type for the OTP challenge.
   */
  otpDeliveryType?: UserChallengeParameters["otpDeliveryType"];

  /**
   * The name of the delivery attribute to use for the OTP challenge, such as a "business-email".
   */
  otpDeliveryAttribute?: string;
}

/**
 * The configurable options when requesting an authentication challenge.
 */
export interface AuthenticationRequestParams {
  /**
   * The user ID of the user to request the challenge for.
   */
  userId?: string;

  /**
   * The user's password to submit for MFA flows.
   */
  password?: string;

  /**
   * The preferred method of authentication.
   */
  preferredAuthenticationMethod?: IdaasAuthenticationMethod;

  /**
   * Determines if the preferred authentication method must be used.
   */
  strict?: boolean;

  /**
   * Options available during OTP authentication
   */
  otpOptions?: OtpOptions;

  /**
   * Options available during TOKENPUSH authentication
   */
  softTokenOptions?: SoftTokenOptions;

  /**
   * Options available during SMART_CREDENTIAL authentication
   */
  smartCredentialOptions?: SmartCredentialOptions;

  /**
   * Options available during FACE authentication
   */
  faceBiometricOptions?: FaceBiometricOptions;

  /**
   * The transaction details of the request.
   */
  transactionDetails?: TransactionDetail[];
}

/**
 * The configurable options when submitting a response to an authentication challenge.
 */
export interface AuthenticationSubmissionParams {
  /**
   * The user's response to the authentication challenge.
   */
  response?: string;

  /**
   * The user's answers to the KBA challenge questions.
   * Answers must be in the order of the questions returned when requesting the challenge.
   */
  // TODO: individual responses (ie gridResponse, password, OTP, etc) ??
  kbaChallengeAnswers?: string[];

  /**
   * The credential returned from navigator.credentials.get(credentialRequestOptions).
   */
  passkeyResponse?: PublicKeyCredential;
}

export interface AuthenticationResponse {
  token?: string;
  /**
   * A flag indicating if authentication has been completed.
   */
  authenticationCompleted?: boolean;

  /**
   * The second factor authenticator that will be used.
   */
  secondFactorMethod?: IdaasAuthenticationMethod;

  /**
   * The method of authentication that will be used.
   */
  method?: IdaasAuthenticationMethod;

  /**
   * A flag indicating if `pollAuth` should be called.
   */
  pollForCompletion?: boolean;

  /**
   * The user ID of the authenticated user.
   */
  userId?: string;

  /**
   * Parameters required for completing the `GRID` authentication method.
   */
  gridChallenge?: GridChallenge;

  /**
   * Parameters required for completing the `KBA` authentication method.
   */
  kbaChallenge?: KbaChallenge;

  /**
   * Parameters required for completing the `FACE` authentication method.
   */
  faceChallenge?: FaceChallenge;

  /**
   * Parameters defining the behaviour of the `TEMP_ACCESS_CODE` authentication method.
   */
  tempAccessCodeChallenge?: TempAccessCodeChallenge;

  /**
   * Push authentication mutual challenge for token or Face Biometric.
   */
  pushMutualChallenge?: string;

  /**
   * The PublicKeyCredentialRequestOptions to be passed in the publicKey field to the navigator.credential.get() call.
   */
  passkeyChallenge?: PublicKeyCredentialRequestOptions;
}

export type IdaasAuthenticationMethod =
  | "PASSWORD"
  | "KBA"
  | "TEMP_ACCESS_CODE"
  | "OTP"
  | "GRID"
  | "TOKEN"
  | "TOKENPUSH"
  | "FIDO"
  | "SMARTCREDENTIALPUSH"
  | "PASSWORD_AND_SECONDFACTOR"
  | "MAGICLINK"
  | "PASSKEY"
  | "FACE"
  | "EXTERNAL";
