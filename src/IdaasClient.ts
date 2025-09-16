import type { JWTPayload } from "jose";
import {
  fetchOpenidConfiguration,
  getUserInfo,
  type OidcConfig,
  type RefreshTokenRequest,
  requestToken,
  type TokenResponse,
} from "./api";
import type { IdaasServices } from "./IdaasServices";
import type { GetAccessTokenOptions, IdaasClientOptions, UserClaims } from "./models";
import { OidcClient } from "./OidcClient";
import { RbaClient } from "./RbaClient";
import { type AccessToken, StorageManager } from "./storage/StorageManager";
import { calculateEpochExpiry, formatUrl } from "./utils/format";
import { readAccessToken, validateUserInfoToken } from "./utils/jwt";

/**
 * A validated token response, contains the TokenResponse as well as the decoded and encoded id token.
 */
export interface ValidatedTokenResponse {
  tokenResponse: TokenResponse;
  decodedIdToken: JWTPayload;
  encodedIdToken: string;
}

export class IdaasClient implements IdaasServices {
  readonly storageManager: StorageManager;
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly globalScope: string;
  readonly globalAudience: string | undefined;
  readonly globalUseRefreshToken: boolean;

  private config?: OidcConfig;
  private _oidcClient: OidcClient;
  private _rbaClient: RbaClient;

  /**
   * Creates a new IdaasClient instance for handling OIDC authentication flows.
   *
   * @param options Configuration options for the client including issuer URL, client ID, and global settings
   */
  constructor({
    issuerUrl,
    clientId,
    globalAudience,
    globalScope,
    globalUseRefreshToken,
    storageType = "memory",
  }: IdaasClientOptions) {
    this.globalAudience = globalAudience;
    this.globalScope = globalScope ?? "openid profile email";
    this.globalUseRefreshToken = globalUseRefreshToken ?? false;
    this.issuerUrl = formatUrl(issuerUrl);
    this.storageManager = new StorageManager(clientId, storageType);
    this.clientId = clientId;

    // Initialize clients with this instance as the services provider
    this._oidcClient = new OidcClient(this);
    this._rbaClient = new RbaClient(this);
  }

  //Public API exposing the client instances

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
   * The `fallbackAuthorizationOptions` parameter determines the result if there are no access tokens with the required scopes and audience that are unexpired or refreshable.
   */
  public async getAccessToken({
    audience = this.globalAudience,
    scope = this.globalScope,
    acrValues = [],
    fallbackAuthorizationOptions,
  }: GetAccessTokenOptions = {}): Promise<string | null> {
    // 1. Remove tokens that are no longer valid
    this.removeUnusableTokens();
    let accessTokens = this.storageManager.getAccessTokens();
    const requestedScopes = scope.split(" ");
    const now = Date.now();
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    if (accessTokens) {
      // 2. Find all tokens with the required audience that possess all required scopes
      // Tokens that have the required audience
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

    // 4. If no suitable tokens were found or all suitable tokens were expired and not refreshable, attempt to login using the fallbackAuthorizationOptions
    // No suitable tokens found
    if (fallbackAuthorizationOptions) {
      const { redirectUri, useRefreshToken, popup } = fallbackAuthorizationOptions;

      return await this.oidc.login({
        scope,
        audience,
        popup,
        useRefreshToken,
        redirectUri,
        acrValues,
      });
    }

    throw new Error("Requested token not found, no fallback login specified");
  }

  /**
   * Get the user claims from the OpenId Provider using the userinfo endpoint.
   *
   * @param accessToken when provided its scopes will be used to determine the claims returned from the userinfo endpoint.
   * If not provided, the access token with the default scopes and audience will be used if available.
   */
  public async getUserInfo(accessToken?: string): Promise<UserClaims | null> {
    const { userinfo_endpoint, issuer, jwks_uri } = await this.getConfig();

    const userInfoAccessToken = accessToken ?? (await this.getAccessToken({}));

    if (!userInfoAccessToken) {
      throw new Error("Client is not authorized to access the UserInfo endpoint");
    }

    const userInfo = await getUserInfo(userinfo_endpoint, userInfoAccessToken);

    let claims: UserClaims | null;

    // 1. Check if userInfo is a JWT. If it is, its signature must be verified.
    claims = await validateUserInfoToken({
      userInfoToken: userInfo,
      clientId: this.clientId,
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

  /** @internal */
  public removeUnusableTokens(): void {
    const tokens = this.storageManager.getAccessTokens();
    if (!tokens) {
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    for (const token of tokens) {
      if (token.maxAgeExpiry) {
        if (now > token.maxAgeExpiry - buffer) {
          this.storageManager.removeAccessToken(token);
        }
      }

      if (now > token.expiresAt - buffer) {
        if (!token.refreshToken) {
          this.storageManager.removeAccessToken(token);
        }
      }
    }
  }

  /** @internal */
  public async getConfig(): Promise<OidcConfig> {
    if (!this.config) {
      this.config = await fetchOpenidConfiguration(this.issuerUrl);
    }
    return this.config;
  }

  /** @internal */
  public parseAndSaveTokenResponse(validatedTokenResponse: ValidatedTokenResponse): void {
    const { tokenResponse, decodedIdToken, encodedIdToken } = validatedTokenResponse;
    const { refresh_token, access_token, expires_in } = tokenResponse;
    const authTime = readAccessToken(access_token)?.auth_time;
    const expiresAt = calculateEpochExpiry(expires_in, authTime);
    const tokenParams = this.storageManager.getTokenParams();

    if (!tokenParams) {
      throw new Error("No token params stored, unable to parse");
    }

    const { audience, scope, maxAge } = tokenParams;
    const maxAgeExpiry = maxAge ? calculateEpochExpiry(maxAge.toString(), authTime) : undefined;

    this.storageManager.removeTokenParams();

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

    this.storageManager.saveIdToken({
      encoded: encodedIdToken,
      decoded: decodedIdToken,
    });
    this.storageManager.saveAccessToken(newAccessToken);
  }

  private async requestTokenUsingRefreshToken(refreshToken: string): Promise<TokenResponse> {
    const { token_endpoint } = await this.getConfig();

    const tokenRequest: RefreshTokenRequest = {
      client_id: this.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    return await requestToken(token_endpoint, tokenRequest);
  }
}
