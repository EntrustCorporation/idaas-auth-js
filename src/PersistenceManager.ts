import type { JWTPayload } from "jose";
import type { TokenResponse } from "./api";

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
 * The authenticated state after completing the OIDC authorization flow.
 *
 * Includes the access token, ID token, and refresh token (optional), as well as the decoded ID token claims
 */
interface Tokens extends TokenResponse {
  decodedIdToken: JWTPayload;
  expiresAt: number;
}

export class PersistenceManager {
  private readonly clientParamsStorageKey: string;
  private readonly tokensStorageKey: string;

  constructor(clientId: string) {
    this.clientParamsStorageKey = `entrust.clientParams.${clientId}`;
    this.tokensStorageKey = `entrust.token.${clientId}`;
  }

  /**
   * Saves values in local storage that are required for the OIDC auth flow.
   * @param data The data to be stored in local storage.
   * @param storageKey The key used to store the data
   */
  private save(storageKey: string, data: string) {
    localStorage.setItem(storageKey, data);
  }

  /**
   * Save ClientParams in local storage that are required to continue the OIDC auth flow on redirect from IDP login.
   * @param data The ClientParams that were generated during the generate the Authorization URL
   */
  public saveClientParams(data: ClientParams) {
    const stringifiedData = JSON.stringify(data);
    this.save(this.clientParamsStorageKey, stringifiedData);
  }

  /**
   * Save Tokens in local storage that are returned from the Token endpoint.
   * @param data The tokens that will be used to grant the user access to protected resources.
   */
  public saveTokens(data: Tokens) {
    const stringifiedData = JSON.stringify(data);
    this.save(this.tokensStorageKey, stringifiedData);
  }

  /**
   * Retrieve the requested object stored in local storage.
   * @param storageKey The type of data to retrieve from local storage
   * @returns The parsed data or undefined if there is no key
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
   * @returns The ClientParams
   */
  public getClientParams(): ClientParams | undefined {
    return this.get(this.clientParamsStorageKey);
  }

  /**
   * Retrieves the Tokens stored in local storage.
   * @returns The Tokens
   */
  public getTokens(): Tokens | undefined {
    return this.get(this.tokensStorageKey);
  }

  /**
   * Remove the stored data in local storage essentially logging the user out.
   */
  public remove() {
    localStorage.removeItem(this.clientParamsStorageKey);
    localStorage.removeItem(this.tokensStorageKey);
  }
}
