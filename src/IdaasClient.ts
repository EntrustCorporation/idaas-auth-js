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
  private readonly storageManager: StorageManager;

  private context: IdaasContext;
  private _oidcClient: OidcClient;
  private _rbaClient: RbaClient;
  private _authClient: AuthClient;

  /**
   * Creates a new IdaasClient instance for handling OIDC authentication flows.
   *
   * @param options Configuration options for the client including issuer URL, client ID, and storage type
   * @param tokenOptions Default token options including audience, scope, and refresh token settings
   */
  constructor({ issuerUrl, clientId, storageType = "memory" }: IdaasClientOptions, tokenOptions: TokenOptions = {}) {
    this.storageManager = new StorageManager(clientId, storageType);

    // Normalize token options with defaults (audience remains optional per OIDC spec)
    const normalizedTokenOptions: NormalizedTokenOptions = {
      scope: tokenOptions.scope ?? "openid profile email",
      audience: tokenOptions.audience,
      useRefreshToken: tokenOptions.useRefreshToken ?? false,
      maxAge: tokenOptions.maxAge ?? -1,
      acrValues: tokenOptions.acrValues ?? [],
    };

    this.context = new IdaasContext({
      issuerUrl,
      clientId,
      tokenOptions: normalizedTokenOptions,
    });

    // Initialize clients with this.context instance as the context provider
    this._oidcClient = new OidcClient(this.context, this.storageManager);
    this._rbaClient = new RbaClient(this.context, this.storageManager);
    this._authClient = new AuthClient(this._rbaClient);
  }

  // Public API exposing the client instances

  /**
   * Provides access to IDaaS hosted OIDC methods.
   * Contains login, logout, and handleRedirect methods.
   */
  public get oidc() {
    return this._oidcClient;
  }

  /**
   * Provides access to self hosted RBA OIDC methods.
   * Contains requestChallenge, submitChallenge, poll, and cancel methods.
   */
  public get rba() {
    return this._rbaClient;
  }

  /**
   * Provides access to self hosted auth convenience methods.
   * Contains password.
   */
  public get auth() {
    return this._authClient;
  }

  /**
   * Checks if the user is currently authenticated by verifying the presence of a valid ID token.
   *
   * @returns True if the user is authenticated, false otherwise
   */
  public isAuthenticated(): boolean {
    return !!this.storageManager.getIdToken();
  }

  /**
   * Fetch the user information stored in the id_token
   * @returns returns the decodedIdToken containing the user info.
   */
  public getIdTokenClaims(): UserClaims | null {
    const idToken = this.storageManager.getIdToken();
    if (!idToken?.decoded) {
      return null;
    }

    return idToken.decoded as UserClaims;
  }

  /**
   * Returns an access token with the required scopes and audience that is unexpired or refreshable.
   */
  public async getAccessToken({
    audience = this.context.tokenOptions.audience,
    scope = this.context.tokenOptions.scope,
    acrValues = [],
  }: TokenOptions = {}): Promise<string | null> {
    // 1. Remove tokens that are no longer valid
    this.storageManager.removeExpiredTokens();
    let accessTokens = this.storageManager.getAccessTokens();
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
        } = await this.requestTokenUsingRefreshToken(refreshToken);

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

        this.storageManager.removeAccessToken(requestedToken);
        this.storageManager.saveAccessToken(newAccessToken);
        return newEncodedAccessToken;
      }
    }

    throw new Error("Requested token not found");
  }

  /**
   * Get the user claims from the OpenId Provider using the userinfo endpoint.
   *
   * @param accessToken when provided its scopes will be used to determine the claims returned from the userinfo endpoint.
   * If not provided, the access token with the default scopes and audience will be used if available.
   */
  public async getUserInfo(accessToken?: string): Promise<UserClaims | null> {
    const { userinfo_endpoint, issuer, jwks_uri } = await this.context.getConfig();

    const userInfoAccessToken = accessToken ?? (await this.getAccessToken({}));

    if (!userInfoAccessToken) {
      throw new Error("Client is not authorized to access the UserInfo endpoint");
    }

    const userInfo = await getUserInfo(userinfo_endpoint, userInfoAccessToken);

    let claims: UserClaims | null;

    // 1. Check if userInfo is a JWT. If it is, its signature must be verified.
    claims = await validateUserInfoToken({
      userInfoToken: userInfo,
      clientId: this.context.clientId,
      jwksEndpoint: jwks_uri,
      issuer,
    });

    // 2. If not a jwt, treat the response as an unsigned JSON
    if (!claims) {
      claims = JSON.parse(userInfo) as UserClaims;
    }

    // 3. Finally, validate that the sub claim in the UserInfo response exactly matches the sub claim in the ID token
    const idToken = this.storageManager.getIdToken();
    if (idToken?.decoded.sub !== claims.sub) {
      return null;
    }

    return claims;
  }

  // Service methods for OidcClient and RbaClient

  private async requestTokenUsingRefreshToken(refreshToken: string): Promise<TokenResponse> {
    const { token_endpoint } = await this.context.getConfig();

    const tokenRequest: RefreshTokenRequest = {
      client_id: this.context.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    return await requestToken(token_endpoint, tokenRequest);
  }
}
