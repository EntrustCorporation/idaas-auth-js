import type { JWTPayload } from "jose";
import { AuthClient } from "./AuthClient";
import { getUserInfo, type RefreshTokenRequest, requestToken, type TokenResponse } from "./api";
import { IdaasContext, type NormalizedTokenOptions } from "./IdaasContext";
import type { IdaasClientOptions, TokenOptions, UserClaims } from "./models";
import { OidcClient } from "./OidcClient";
import { RbaClient } from "./RbaClient";
import { type AccessToken, StorageManager } from "./storage/StorageManager";
import { calculateEpochExpiry } from "./utils/format";
import { readAccessToken, validateUserInfoToken } from "./utils/jwt";

/**
 * A validated token response, contains the TokenResponse as well as the decoded and encoded id token.
 */
export interface ValidatedTokenResponse {
  tokenResponse: TokenResponse;
  decodedIdToken: JWTPayload;
  encodedIdToken: string;
}
/**
 * The main client class for interacting with IDaaS authentication services.
 * Provides methods for OIDC authentication flows and RBA challenge handling.
 * @public
 */

export class IdaasClient {
  readonly #storageManager: StorageManager;

  readonly #context: IdaasContext;
  readonly #oidcClient: OidcClient;
  readonly #rbaClient: RbaClient;
  readonly #authClient: AuthClient;

  /**
   * Creates a new IdaasClient instance for handling OIDC authentication flows.
   *
   * @param options Configuration options for the client including issuer URL, client ID, and storage type
   * @param tokenOptions Default token options including audience, scope, and refresh token settings
   */
  constructor({ issuerUrl, clientId, storageType = "memory" }: IdaasClientOptions, tokenOptions: TokenOptions = {}) {
    this.#storageManager = new StorageManager(clientId, storageType);

    // Normalize token options with defaults (audience remains optional per OIDC spec)
    const normalizedTokenOptions: NormalizedTokenOptions = {
      scope: tokenOptions.scope ?? "openid profile email",
      audience: tokenOptions.audience,
      useRefreshToken: tokenOptions.useRefreshToken ?? false,
      maxAge: tokenOptions.maxAge ?? -1,
      acrValues: tokenOptions.acrValues ?? [],
    };

    this.#context = new IdaasContext({
      issuerUrl,
      clientId,
      tokenOptions: normalizedTokenOptions,
    });

    // Initialize clients with this.#context instance as the context provider
    this.#oidcClient = new OidcClient(this.#context, this.#storageManager);
    this.#rbaClient = new RbaClient(this.#context, this.#storageManager);
    this.#authClient = new AuthClient(this.#rbaClient);
  }

  // Public API exposing the client instances

  /**
   * Provides access to IDaaS hosted OIDC methods.
   *
   * Use this when you want Entrust to host the entire login UI. It handles PKCE, redirects, and logout
   * for a quick hosted authentication experience.
   *
   * Available methods:
   * - `login(options?, tokenOptions?)` - Initiate login via redirect or popup
   * - `logout(options?)` - Log user out with optional redirect
   * - `handleRedirect()` - Process OAuth callback after redirect
   *
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md OIDC Guide}
   */
  public get oidc() {
    return this.#oidcClient;
  }

  /**
   * Provides access to self-hosted Risk-Based Authentication (RBA) methods.
   *
   * Use this when building your own UI and need full control over multi-factor and risk-based challenges.
   * Requires Resource Rules to be configured in IDaaS for risk evaluation.
   *
   * Available methods:
   * - `requestChallenge(params?, tokenOptions?)` - Request authentication challenge with risk evaluation
   * - `submitChallenge(params)` - Submit user response to challenge
   * - `poll()` - Poll for asynchronous authentication completion
   * - `cancel()` - Cancel ongoing authentication
   * - `logout()` - End user session
   *
   * **Note:** Supply the user's identifier (`userId`) in `AuthenticationRequestParams` unless the
   * authenticator explicitly allows anonymous flows (e.g., passkey with discoverable credentials).
   *
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md RBA Guide}
   */
  public get rba() {
    return this.#rbaClient;
  }

  /**
   * Provides access to self-hosted auth convenience methods.
   *
   * Use these simplified helpers when you want custom UI but have a fixed authentication method
   * configured in IDaaS (not using Resource Rules for risk-based decisions).
   *
   * Available methods:
   * - `password(userId, password)` - Password authentication
   * - `softToken(userId, options?)` - Soft token (TOTP or push)
   * - `grid(userId)` - Grid card authentication
   * - `passkey(userId?)` - WebAuthn/FIDO2 passkey (omit userId for discoverable credentials)
   * - `kba(userId)` - Knowledge-based authentication
   * - `tempAccessCode(userId, code)` - Temporary access code
   * - `otp(userId, options?)` - One-time password
   * - `smartCredential(userId, options?)` - Smart credential push
   * - `faceBiometric(userId, options?)` - Face biometric authentication
   * - `magicLink(userId)` - Magic link authentication
   * - `submit(params?)` - Submit challenge response
   * - `poll()` - Poll for completion
   * - `cancel()` - Cancel authentication
   * - `logout()` - End session
   *
   * **Note:** Almost every convenience helper expects `userId` as the first argument.
   *
   * @see {@link https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md Convenience Auth Guide}
   */
  public get auth() {
    return this.#authClient;
  }

  /**
   * Checks if the user is currently authenticated by verifying the presence of a valid ID token.
   *
   * @returns `true` when an ID token exists, `false` otherwise
   */
  public isAuthenticated(): boolean {
    return !!this.#storageManager.getIdToken();
  }

  /**
   * Retrieves decoded ID token claims containing user information.
   *
   * The ID token is a JWT that contains standard OIDC claims about the authenticated user
   * such as `sub` (subject/user ID), `email`, `name`, etc.
   *
   * @returns Decoded ID token claims, or `null` if no ID token exists
   */
  public getIdTokenClaims(): UserClaims | null {
    const idToken = this.#storageManager.getIdToken();
    if (!idToken?.decoded) {
      return null;
    }

    return idToken.decoded as UserClaims;
  }

  /**
   * Retrieves a cached access token matching the specified criteria.
   *
   * If the token is expired and a refresh token is available (subject to tenant configuration),
   * the SDK automatically performs a token refresh.
   *
   * @param options Token options to match (audience, scope, acrValues)
   * @returns Access token string, or `null` when no matching session exists
   * @throws Error if the refresh/token exchange fails
   */
  public async getAccessToken({
    audience = this.#context.tokenOptions.audience,
    scope = this.#context.tokenOptions.scope,
    acrValues = [],
  }: TokenOptions = {}): Promise<string | null> {
    // 1. Remove tokens that are no longer valid
    this.#storageManager.removeExpiredTokens();
    let accessTokens = this.#storageManager.getAccessTokens();
    const requestedScopes = scope.split(" ");
    const now = Date.now();
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    if (accessTokens) {
      // 2. Find all tokens with the required audience that possess all required scopes
      // Tokens that have the required audience (both undefined means match, or exact string match)
      accessTokens = accessTokens.filter((token) => token.audience === audience);

      // Tokens that have the required audience and all scopes
      accessTokens = accessTokens.filter((token) => {
        const tokenScopes = token.scope.split(" ");
        return requestedScopes.every((scope: string) => tokenScopes.includes(scope));
      });

      if (acrValues && acrValues.length > 0) {
        // Tokens that have the required audience, all scopes, and a requested acr
        accessTokens = accessTokens.filter((token) => {
          if (token.acr) {
            return acrValues.includes(token.acr);
          }

          return false;
        });
      }

      // Sorts tokens by number of scopes in ascending order
      accessTokens.sort((token1, token2) => token1.scope.split(" ").length - token2.scope.split(" ").length);

      // 3. Taking the token with the fewest number of scopes:
      // - If the token is not expired, return it
      // - If the token is expired but refreshable, refresh it, remove it from storage, store the refreshed token, then return the refreshed token
      if (accessTokens[0]) {
        const requestedToken = accessTokens[0];
        const { refreshToken, accessToken, expiresAt, scope, audience, acr } = requestedToken;
        const expDate = (expiresAt - buffer) * 1000;

        // Token not expired
        if (expDate > now) {
          return accessToken;
        }

        if (!refreshToken) {
          throw new Error("Token that is not valid was not removed");
        }

        const {
          refresh_token: newRefreshToken,
          access_token: newEncodedAccessToken,
          expires_in,
        } = await this.#requestTokenUsingRefreshToken(refreshToken);

        const authTime = readAccessToken(newEncodedAccessToken)?.auth_time;
        const newExpiration = calculateEpochExpiry(expires_in, authTime);

        // the refreshed access token to be stored, maintaining expired token's scope and audience
        const newAccessToken: AccessToken = {
          accessToken: newEncodedAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiration,
          audience,
          scope,
          acr,
        };

        this.#storageManager.removeAccessToken(requestedToken);
        this.#storageManager.saveAccessToken(newAccessToken);
        return newEncodedAccessToken;
      }
    }

    throw new Error("Requested token not found");
  }

  /**
   * Retrieves user claims from the OpenID Provider using the userinfo endpoint.
   *
   * This method fetches fresh user information from the identity provider, as opposed to
   * `getIdTokenClaims()` which returns cached claims from the ID token.
   *
   * @param accessToken Optional access token to use. When provided, its scopes determine the claims
   * returned from the userinfo endpoint. If not provided, the access token with default scopes and
   * audience will be used if available.
   * @returns User claims from the OpenID Provider, or `null` if unavailable
   */
  public async getUserInfo(accessToken?: string): Promise<UserClaims | null> {
    const { userinfo_endpoint, issuer, jwks_uri } = await this.#context.getConfig();

    const userInfoAccessToken = accessToken ?? (await this.getAccessToken({}));

    if (!userInfoAccessToken) {
      throw new Error("Client is not authorized to access the UserInfo endpoint");
    }

    const userInfo = await getUserInfo(userinfo_endpoint, userInfoAccessToken);

    let claims: UserClaims | null;

    // 1. Check if userInfo is a JWT. If it is, its signature must be verified.
    claims = await validateUserInfoToken({
      userInfoToken: userInfo,
      clientId: this.#context.clientId,
      jwksEndpoint: jwks_uri,
      issuer,
    });

    // 2. If not a jwt, treat the response as an unsigned JSON
    if (!claims) {
      claims = JSON.parse(userInfo) as UserClaims;
    }

    // 3. Finally, validate that the sub claim in the UserInfo response exactly matches the sub claim in the ID token
    const idToken = this.#storageManager.getIdToken();
    if (idToken?.decoded.sub !== claims.sub) {
      return null;
    }

    return claims;
  }

  // Service methods for OidcClient and RbaClient
  async #requestTokenUsingRefreshToken(refreshToken: string): Promise<TokenResponse> {
    const { token_endpoint } = await this.#context.getConfig();

    const tokenRequest: RefreshTokenRequest = {
      client_id: this.#context.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    return await requestToken(token_endpoint, tokenRequest);
  }
}
