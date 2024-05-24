import type { JWTPayload } from "jose";

/**
 * The parameters that are created during the creation of the authorization URL.
 * @interface ClientParams
 * @member nonce A random generated string used to validate the OIDC flow
 * @member codeVerifier A random generated string that is hashed and encoded for use as a code_challenge
 * @member redirectUri The URI to redirect to upon successful login to the IDP server
 * @member state A random generated string used to validate the OIDC flow
 */
interface ClientParams {
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

/**
 * Token parameters required in the AccessToken object.
 * Can be used to identify a unique access token.
 */
interface TokenParams {
  audience?: string;
  scope: string;
}

/**
 * Contains the encoded and decoded versions of an id token.
 */
interface IdToken {
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
}

export class PersistenceManager {
  /**
   * @clientParamsStorageKey stores the params generated during the creation of the authorization url.
   * @accessTokensStorageKey stores all access tokens as an array of access tokens.
   * @idTokenStorageKey stores the encoded and decoded versions of a single id token.
   * @tokenParamsStorageKey used to move a token's audience and scope from the authorization url when handling a login redirect.
   */
  private readonly clientParamsStorageKey: string;
  private readonly accessTokenStorageKey: string;
  private readonly idTokenStorageKey: string;
  private readonly tokenParamsStorageKey: string;

  constructor(clientId: string) {
    this.clientParamsStorageKey = `entrust.clientParams.${clientId}`;
    this.accessTokenStorageKey = `entrust.accessTokens.${clientId}`;
    this.idTokenStorageKey = `entrust.idToken.${clientId}`;
    this.tokenParamsStorageKey = `entrust.tokenParams.${clientId}`;
  }

  /**
   * Saves values in local storage that are required for the OIDC auth flow.
   * @param data The data to be stored in local storage.
   * @param storageKey The key used to store the data.
   */
  private save(storageKey: string, data: string) {
    localStorage.setItem(storageKey, data);
  }

  /**
   * Save ClientParams in local storage that are required to continue the OIDC auth flow on redirect from IDP login.
   * @param data The ClientParams that were generated during the generate the Authorization URL.
   */
  public saveClientParams(data: ClientParams) {
    const stringifiedData = JSON.stringify(data);
    this.save(this.clientParamsStorageKey, stringifiedData);
  }

  /**
   * Save information about the id token in storage.
   * @param data The encoded and decoded id token.
   */
  public saveIdToken(data: IdToken) {
    const stringifiedData = JSON.stringify(data);
    this.save(this.idTokenStorageKey, stringifiedData);
  }

  /**
   * Save the token params in local storage.
   * @param data the token params to be saved.
   */
  public saveTokenParams(data: TokenParams) {
    const stringifiedDate = JSON.stringify(data);
    this.save(this.tokenParamsStorageKey, stringifiedDate);
  }

  /**
   * Save access tokens in local storage.
   * @param data the access token to be saved.
   */
  public saveAccessToken(data: AccessToken) {
    const accessTokens = this.getAccessTokens();

    if (!accessTokens) {
      const stringifiedData = JSON.stringify([data]);
      this.save(this.accessTokenStorageKey, stringifiedData);
      return;
    }

    accessTokens.push(data);
    const stringifiedData = JSON.stringify(accessTokens);
    this.save(this.accessTokenStorageKey, stringifiedData);
  }

  /**
   * Remove an access token from storage.
   * @param removedToken the token to be removed.
   */
  public removeAccessToken(removedToken: AccessToken) {
    const accessTokens = this.getAccessTokens();
    if (!accessTokens) {
      return;
    }
    const index = accessTokens.indexOf(removedToken);
    accessTokens.splice(index, 1);
    const stringifiedData = JSON.stringify(accessTokens);
    this.save(this.accessTokenStorageKey, stringifiedData);
  }

  /**
   * Clears the stored token params.
   */
  public removeTokenParams() {
    localStorage.removeItem(this.tokenParamsStorageKey);
  }

  /**
   * Retrieve the requested object stored in local storage.
   * @param storageKey The type of data to retrieve from local storage.
   * @returns The parsed data or undefined if there is no key.
   */
  private get(storageKey: string) {
    const data = localStorage.getItem(storageKey);

    if (data) {
      return JSON.parse(data);
    }
    return undefined;
  }

  /**
   * Retrieves the ClientParams stored in local storage.
   * @returns The ClientParams.
   */
  public getClientParams(): ClientParams | undefined {
    return this.get(this.clientParamsStorageKey);
  }

  /**
   * Retrieves the access tokens stored in local storage.
   * @returns The array of access tokens.
   */
  public getAccessTokens(): AccessToken[] | undefined {
    return this.get(this.accessTokenStorageKey);
  }

  /**
   * Retrieves the stored token params.
   * @returns The TokenParams object stored.
   */
  public getTokenParams() {
    return this.get(this.tokenParamsStorageKey);
  }

  /**
   * Retrieves the information about the id token stored in local storage.
   * @returns The idToken object stored.
   */
  public getIdToken(): IdToken | undefined {
    return this.get(this.idTokenStorageKey);
  }

  /**
   * Remove the stored data in local storage essentially logging the user out.
   */
  public remove() {
    localStorage.removeItem(this.clientParamsStorageKey);
    localStorage.removeItem(this.accessTokenStorageKey);
    localStorage.removeItem(this.idTokenStorageKey);
    localStorage.removeItem(this.tokenParamsStorageKey);
  }
}
