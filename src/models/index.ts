import type { OidcConfig } from "../api";
import type {
  FaceChallenge,
  GridChallenge,
  KbaChallenge,
  TempAccessCodeChallenge,
  TransactionDetail,
} from "./openapi-ts";

/**
 * The configurable options of the IdaasClient.
 * @public
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
   * default "memory"
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
 * @public
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
 * @public
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
 * @public
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
 * @public
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

export interface AuthenticationTransactionOptions extends AuthenticationRequestParams {
  /**
   * The OIDC config of the IDaaSClient.
   */
  oidcConfig: OidcConfig;

  /**
   * The client ID of the IDaasClient.
   */
  clientId: string;
}

export interface MutualChallenge {
  /**
   * Determines if the user must answer a mutual challenge for the TOKENPUSH and FACE authenticators.
   */
  mutualChallengeEnabled?: boolean;
}

/**
 * The configurable options when requesting a FACE authentication challenge.
 */
export interface FaceBiometricOptions extends MutualChallenge {}

/**
 * The configurable options when requesting a TOKENPUSH authentication challenge.
 */
export interface TokenPushOptions extends MutualChallenge {}

/**
 * The configurable options when requesting an authentication challenge.
 * @public
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
   * Options available during TOKENPUSH authentication
   */
  tokenPushOptions?: TokenPushOptions;

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
 * @public
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
  credential?: Credential;
}

/** @public */
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
   *
   * TODO: onfido SDK integration, not necessary when complete. Required for WEB bio auth
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
  publicKeyCredentialRequestOptions?: PublicKeyCredentialRequestOptions;
}
/** @public */
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
  | "PASSKEY"
  | "FACE" // TODO onfido sdk integration for web auth
  | "EXTERNAL";

export interface PublicKeyCredentialRequestOptionsJSON
  extends Omit<PublicKeyCredentialRequestOptions, "challenge" | "allowCredentials"> {
  challenge: string;
  allowCredentials?: { id: string; type: PublicKeyCredentialType }[];
}

export interface PublicKeyCredentialDescriptorJSON extends Omit<PublicKeyCredentialDescriptor, "id"> {
  id: string;
}

interface AuthenticationCredentialResponse {
  userHandle: ArrayBuffer;
  authenticatorData: ArrayBuffer;
  clientDataJSON: ArrayBuffer;
  signature: ArrayBuffer;
}

export interface AuthenticationCredential extends Credential {
  response: AuthenticationCredentialResponse;
}
