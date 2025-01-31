import { afterEach, describe, expect, test } from "bun:test";
import { StorageManager } from "../../../src/storage/StorageManager";
import { getAccessToken, getClientParams, getIdToken, getTokenParams } from "../helpers";

const CLIENT_ID = "client_id";

describe("StorageManager", () => {
  const storageManager = new StorageManager(CLIENT_ID, "localstorage");

  afterEach(() => {
    localStorage.clear();
  });

  describe("access token storage", () => {
    test("returns undefined if no tokens stored", () => {
      const result = storageManager.getAccessTokens();
      expect(result).toEqual([]);
    });

    test("returns an array of tokens if a single token stored", () => {
      const accessToken = getAccessToken();
      storageManager.saveAccessToken(accessToken);

      const result = storageManager.getAccessTokens();

      expect(result).toStrictEqual([accessToken]);
    });

    test("returns an array of tokens if multiple tokens stored", () => {
      const tokens = new Array(3).fill(getAccessToken());

      for (const token of tokens) {
        storageManager.saveAccessToken(token);
      }

      const result = storageManager.getAccessTokens();

      expect(result).toStrictEqual(tokens);
    });

    test("does nothing if no tokens stored", () => {
      expect(() => {
        storageManager.removeAccessToken(getAccessToken());
      }).not.toThrowError();
    });

    test("removes the correct token if multiple stored", () => {
      const token1 = getAccessToken();
      const token2 = getAccessToken();

      storageManager.saveAccessToken(token1);
      storageManager.saveAccessToken(token2);

      storageManager.removeAccessToken(token2);

      const tokens = storageManager.getAccessTokens();

      expect(tokens.length).toEqual(1);
      expect(tokens).toEqual([token1]);
    });

    test("stores multiple tokens with different scopes, same audience", () => {
      const token1 = getAccessToken({ scope: "1" });
      const token2 = getAccessToken({ scope: "2" });

      storageManager.saveAccessToken(token1);
      storageManager.saveAccessToken(token2);

      const tokens = storageManager.getAccessTokens();

      expect(tokens.length).toBe(2);
      expect(tokens).toEqual([token1, token2]);
    });

    test("stores multiple tokens with different audience, same scopes", () => {
      const token1 = getAccessToken({ audience: "1" });
      const token2 = getAccessToken({ audience: "2" });

      storageManager.saveAccessToken(token1);
      storageManager.saveAccessToken(token2);

      const tokens = storageManager.getAccessTokens();

      expect(tokens.length).toBe(2);
      expect(tokens).toEqual([token1, token2]);
    });
  });

  describe("token param storage", () => {
    test("returns undefined if no token params stored", () => {
      expect(storageManager.getTokenParams()).toBeUndefined();
    });

    test("saves and returns the stored token params", () => {
      const tokenParams = getTokenParams();

      storageManager.saveTokenParams(tokenParams);

      const result = storageManager.getTokenParams();

      expect(result).toStrictEqual(tokenParams);
    });
  });

  describe("client param storage", () => {
    test("returns undefined if no client params stored", () => {
      expect(storageManager.getClientParams()).toBeUndefined();
    });

    test("saves and returns the stored client params", () => {
      const clientParams = getClientParams();

      storageManager.saveClientParams(clientParams);

      const result = storageManager.getClientParams();

      expect(result).toStrictEqual(clientParams);
    });
  });

  describe("ID token storage", () => {
    test("returns undefined if no ID token stored", () => {
      expect(storageManager.getIdToken()).toBeUndefined();
    });

    test("saves and returns the stored ID token", () => {
      const idToken = getIdToken();

      storageManager.saveIdToken(idToken);

      const result = storageManager.getIdToken();

      expect(result).toStrictEqual(idToken);
    });
  });

  test("remove() clears storage", () => {
    storageManager.saveAccessToken(getAccessToken());
    storageManager.saveClientParams(getClientParams());
    storageManager.saveIdToken(getIdToken());
    storageManager.saveTokenParams(getTokenParams());

    storageManager.remove();

    expect(storageManager.getAccessTokens().length).toBe(0);
    expect(storageManager.getClientParams()).toBeUndefined();
    expect(storageManager.getIdToken()).toBeUndefined();
    expect(storageManager.getTokenParams()).toBeUndefined();

    expect(localStorage.length).toBe(0);
  });
});
