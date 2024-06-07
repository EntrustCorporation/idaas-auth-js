import { afterEach, describe, expect, test } from "bun:test";
import { type AccessToken, PersistenceManager } from "../src/PersistenceManager";
import {
  TEST_ACCESS_TOKEN_OBJECT,
  TEST_CLIENT_ID,
  TEST_CLIENT_PARAMS,
  TEST_ID_TOKEN_OBJECT,
  TEST_TOKEN_PARAMS,
} from "./constants";

describe("PersistenceManager", () => {
  const persistenceManager = new PersistenceManager(TEST_CLIENT_ID);

  afterEach(() => {
    localStorage.clear();
  });

  describe("access token storage", () => {
    const key = `entrust.accessTokens.${TEST_CLIENT_ID}`;

    describe("getAccessToken", () => {
      test("returns undefined if no tokens stored", () => {
        const result = persistenceManager.getAccessTokens();
        expect(result).toBeUndefined();
      });

      test("returns an array of tokens if a single token stored", () => {
        const value = [TEST_ACCESS_TOKEN_OBJECT];
        localStorage.setItem(key, JSON.stringify(value));

        const result = persistenceManager.getAccessTokens();
        expect(result).toStrictEqual(value);
      });

      test("returns an array of tokens if multiple tokens stored", () => {
        const value = new Array(3).fill(TEST_ACCESS_TOKEN_OBJECT);
        localStorage.setItem(key, JSON.stringify(value));

        const result = persistenceManager.getAccessTokens();
        expect(result).toStrictEqual(value);
      });
    });

    describe("removeAccessToken", () => {
      test("does nothing if no tokens stored", () => {
        const value = [];
        localStorage.setItem(key, JSON.stringify(value));

        expect(() => {
          persistenceManager.removeAccessToken(TEST_ACCESS_TOKEN_OBJECT);
        }).not.toThrowError();
      });

      test("removes the final token stored", () => {
        const value = [TEST_ACCESS_TOKEN_OBJECT];
        localStorage.setItem(key, JSON.stringify(value));

        persistenceManager.removeAccessToken(TEST_ACCESS_TOKEN_OBJECT);
        expect(localStorage.getItem(key)).toBe(JSON.stringify([]));
      });

      test("removes the correct token if multiple stored", () => {
        const token1: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 123 };
        const token2: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, expiresAt: 321 };
        const value = [token1, token2];
        localStorage.setItem(key, JSON.stringify(value));

        persistenceManager.removeAccessToken(token2);
        expect(localStorage.getItem(key)).toStrictEqual(JSON.stringify([token1]));
      });
    });

    describe("saveAccessToken", () => {
      test("stores access token as an array if none already stored", () => {
        persistenceManager.saveAccessToken(TEST_ACCESS_TOKEN_OBJECT);
        expect(localStorage.getItem(key)).toStrictEqual(JSON.stringify([TEST_ACCESS_TOKEN_OBJECT]));
      });

      test("stores multiple tokens with different scopes, same audience", () => {
        const token1: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, scope: "1" };
        const token2: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, scope: "2" };

        persistenceManager.saveAccessToken(token1);
        expect(JSON.parse(localStorage.getItem(key)).length).toBe(1);

        persistenceManager.saveAccessToken(token2);
        expect(JSON.parse(localStorage.getItem(key)).length).toBe(2);
      });

      test("stores multiple tokens with different audience, same scopes", () => {
        const token1: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, audience: "1" };
        const token2: AccessToken = { ...TEST_ACCESS_TOKEN_OBJECT, audience: "2" };

        persistenceManager.saveAccessToken(token1);
        expect(JSON.parse(localStorage.getItem(key)).length).toBe(1);

        persistenceManager.saveAccessToken(token2);
        expect(JSON.parse(localStorage.getItem(key)).length).toBe(2);
      });
    });
  });

  describe("token param storage", () => {
    const key = `entrust.tokenParams.${TEST_CLIENT_ID}`;

    describe("getTokenParams", () => {
      test("returns undefined if no token params stored", () => {
        expect(persistenceManager.getTokenParams()).toBeUndefined();
      });

      test("returns the stored token params", () => {
        localStorage.setItem(key, JSON.stringify(TEST_TOKEN_PARAMS));
        expect(persistenceManager.getTokenParams()).toStrictEqual(TEST_TOKEN_PARAMS);
      });
    });

    describe("removeTokenParams", () => {
      test("does nothing if no token params stored", () => {
        expect(() => {
          persistenceManager.removeTokenParams();
        }).not.toThrowError();
      });

      test("removes the stored token params", () => {
        localStorage.setItem(key, JSON.stringify(TEST_TOKEN_PARAMS));
        persistenceManager.removeTokenParams();
        expect(localStorage.getItem(key)).toBeNull();
      });
    });

    describe("saveTokenParams", () => {
      test("stores the given token params", () => {
        persistenceManager.saveTokenParams(TEST_TOKEN_PARAMS);
        expect(localStorage.getItem(key)).toStrictEqual(JSON.stringify(TEST_TOKEN_PARAMS));
      });
    });
  });
  describe("client param storage", () => {
    const key = `entrust.clientParams.${TEST_CLIENT_ID}`;

    describe("getClientParams", () => {
      test("returns undefined if no client params stored", () => {
        expect(persistenceManager.getClientParams()).toBeUndefined();
      });

      test("returns the stored client params", () => {
        localStorage.setItem(key, JSON.stringify(TEST_CLIENT_PARAMS));
        const result = persistenceManager.getClientParams();
        expect(result).toStrictEqual(TEST_CLIENT_PARAMS);
      });
    });

    describe("saveClientParams", () => {
      test("stores the given client params", () => {
        persistenceManager.saveClientParams(TEST_CLIENT_PARAMS);
        expect(localStorage.getItem(key)).toStrictEqual(JSON.stringify(TEST_CLIENT_PARAMS));
      });
    });
  });

  describe("ID token storage", () => {
    const key = `entrust.idToken.${TEST_CLIENT_ID}`;

    describe("getIdToken", () => {
      test("returns undefined if no ID token stored", () => {
        expect(persistenceManager.getIdToken()).toBeUndefined();
      });

      test("returns the stored ID token", () => {
        localStorage.setItem(key, JSON.stringify(TEST_ID_TOKEN_OBJECT));
        const result = persistenceManager.getIdToken();
        expect(result).toStrictEqual(TEST_ID_TOKEN_OBJECT);
      });
    });

    describe("saveIdToken", () => {
      test("stores the given ID token", () => {
        persistenceManager.saveIdToken(TEST_ID_TOKEN_OBJECT);
        expect(localStorage.getItem(key)).toStrictEqual(JSON.stringify(TEST_ID_TOKEN_OBJECT));
      });
    });
  });

  test("remove() clears storage", () => {
    localStorage.setItem(`entrust.tokenParams.${TEST_CLIENT_ID}`, JSON.stringify(TEST_TOKEN_PARAMS));
    localStorage.setItem(`entrust.accessTokens.${TEST_CLIENT_ID}`, JSON.stringify(TEST_ACCESS_TOKEN_OBJECT));
    localStorage.setItem(`entrust.idToken.${TEST_CLIENT_ID}`, JSON.stringify(TEST_ID_TOKEN_OBJECT));
    localStorage.setItem(`entrust.clientParams.${TEST_CLIENT_ID}`, JSON.stringify(TEST_CLIENT_PARAMS));
    persistenceManager.remove();
    expect(localStorage.length).toBe(0);
  });
});
