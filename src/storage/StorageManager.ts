import type { JWTPayload } from "jose";

interface Store {
  save(key: string, data: string): void;
  get(key: string): string | null;
  delete(key: string): void;
}

class MemoryStore implements Store {
  readonly #cache = new Map<string, string>();
  save(key: string, data: string) { this.#cache.set(key, data); }
  get(key: string) { return this.#cache.get(key) ?? null; }
  delete(key: string) { this.#cache.delete(key); }
}

class LocalStore implements Store {
  save(key: string, data: string) { localStorage.setItem(key, data); }
  get(key: string) { return localStorage.getItem(key); }
  delete(key: string) { localStorage.removeItem(key); }
}

/**
 * The parameters that are created during the creation of the authorization URL.
 * @interface ClientParams
 * @member nonce A random generated string used to validate the OIDC flow
 * @member codeVerifier A random generated string that is hashed and encoded for use as a code_challenge
 * @member redirectUri The URI to redirect to upon successful login to the IDP server
 * @member state A random generated string used to validate the OIDC flow
 */
export interface ClientParams {
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

/**
 * Token parameters required in the AccessToken object.
 * Can be used to identify a unique access token.
 */
export interface TokenParams {
  audience?: string;
  scope: string;
  requireIdToken?: boolean;
  acrValues?: string;

  // RFC 9470
  maxAge?: number;
}

/**
 * Contains the encoded and decoded versions of an id token.
 */
export interface IdToken {
  encoded: string;
  decoded: JWTPayload;
}

/**
 * All information associated with a single access token.
 */
export interface AccessToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  audience?: string;
  scope: string;
  maxAgeExpiry?: number;
  acr?: string;
}

export class StorageManager {
  /**
   * @clientParamsStorageKey stores the params generated during the creation of the authorization url.
   * @accessTokensStorageKey stores all access tokens as an array of access tokens.
   * @idTokenStorageKey stores the encoded and decoded versions of a single id token.
   * @tokenParamsStorageKey used to move a token's audience and scope from the authorization url when handling a login redirect.
   */
  readonly #clientParamsStorageKey: string;
  readonly #accessTokenStorageKey: string;
  readonly #idTokenStorageKey: string;
  readonly #tokenParamsStorageKey: string;
  readonly #idaasSessionTokenStorageKey: string;
  readonly #storage: Store;

  constructor(clientId: string, storageType: "memory" | "localstorage") {
    this.#clientParamsStorageKey = `entrust.${clientId}.clientParams`;
    this.#accessTokenStorageKey = `entrust.${clientId}.accessTokens`;
    this.#idTokenStorageKey = `entrust.${clientId}.idToken`;
    this.#idaasSessionTokenStorageKey = `entrust.${clientId}.idaasSessionToken`;
    this.#tokenParamsStorageKey = `entrust.${clientId}.tokenParams`;
    this.#storage = storageType === "memory" ? new MemoryStore() : new LocalStore();
  }

  /**
   * Save ClientParams in local storage that are required to continue the OIDC auth flow on redirect from IDP login.
   * @param data The ClientParams that were generated during the generate the Authorization URL.
   */
  public saveClientParams(data: ClientParams) {
    this.#storage.save(this.#clientParamsStorageKey, JSON.stringify(data));
  }

  /**
   * Save the IDaaS session token in storage.
   * @param token The IDaaS session token string.
   */
  public saveIdaasSessionToken(token: string) {
    this.#storage.save(this.#idaasSessionTokenStorageKey, token);
  }

  /**
   * Save information about the id token in storage.
   * @param data The encoded and decoded id token.
   */
  public saveIdToken(data: IdToken) {
    this.#storage.save(this.#idTokenStorageKey, JSON.stringify(data));
  }

  /**
   * Save the token params in local storage.
   * @param data the token params to be saved.
   */
  public saveTokenParams(data: TokenParams) {
    this.#storage.save(this.#tokenParamsStorageKey, JSON.stringify(data));
  }

  /**
   * Save access tokens in local storage.
   * @param data the access token to be saved.
   */
  public saveAccessToken(data: AccessToken) {
    const accessTokens = this.getAccessTokens();
    accessTokens.push(data);
    this.#storage.save(this.#accessTokenStorageKey, JSON.stringify(accessTokens));
  }

  /**
   * Remove an access token from storage.
   * @param removedToken the token to be removed.
   */
  public removeAccessToken(removedToken: AccessToken) {
    const accessTokens = this.getAccessTokens();
    if (accessTokens.length === 0) {
      return;
    }

    const index = accessTokens.findIndex((token) => token.accessToken === removedToken.accessToken);

    if (index === -1) {
      throw new Error("error removing access token, token not found");
    }

    accessTokens.splice(index, 1);
    this.#storage.save(this.#accessTokenStorageKey, JSON.stringify(accessTokens));
  }

  /**
   * Removes expired token from storage.
   */
  public removeExpiredTokens(): void {
    const tokens = this.getAccessTokens();
    if (!tokens) {
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    // buffer (in seconds) to refresh/delete early, ensures an expired token is not returned
    const buffer = 15;

    for (const token of tokens) {
      if (token.maxAgeExpiry) {
        if (now > token.maxAgeExpiry - buffer) {
          this.removeAccessToken(token);
        }
      }

      if (now > token.expiresAt - buffer) {
        if (!token.refreshToken) {
          this.removeAccessToken(token);
        }
      }
    }
  }

  /**
   * Clears the stored token params.
   */
  public removeTokenParams() {
    this.#storage.delete(this.#tokenParamsStorageKey);
  }

  /**
   * Retrieve the requested object stored in local storage.
   * @param storageKey The type of data to retrieve from local storage.
   * @returns The parsed data or undefined if there is no key.
   */
  #get<T>(storageKey: string): T | undefined {
    const data = this.#storage.get(storageKey);

    if (data) {
      return JSON.parse(data) as T;
    }
    return undefined;
  }

  /**
   * Retrieves the ClientParams stored in local storage.
   * @returns The ClientParams.
   */
  public getClientParams(): ClientParams | undefined {
    return this.#get(this.#clientParamsStorageKey);
  }

  /**
   * Retrieves the access tokens stored in local storage.
   * @returns The array of access tokens.
   */
  public getAccessTokens(): AccessToken[] {
    return this.#get(this.#accessTokenStorageKey) ?? [];
  }

  /**
   * Retrieves the stored token params.
   * @returns The TokenParams object stored.
   */
  public getTokenParams(): TokenParams | undefined {
    return this.#get(this.#tokenParamsStorageKey);
  }

  /**
   * Retrieves the information about the id token stored in local storage.
   * @returns The idToken object stored.
   */
  public getIdToken(): IdToken | undefined {
    return this.#get(this.#idTokenStorageKey);
  }

  /**
   * Retrieves the IDaaS session token stored in storage.
   * @returns The session token string if stored, otherwise undefined.
   */
  public getIdaasSessionToken(): string | undefined {
    return this.#storage.get(this.#idaasSessionTokenStorageKey) ?? undefined;
  }

  /**
   * Remove the stored data in local storage essentially logging the user out.
   */
  public remove() {
    this.#storage.delete(this.#clientParamsStorageKey);
    this.#storage.delete(this.#accessTokenStorageKey);
    this.#storage.delete(this.#idTokenStorageKey);
    this.#storage.delete(this.#tokenParamsStorageKey);
  }
}
