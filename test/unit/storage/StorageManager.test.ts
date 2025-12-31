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
    test("returns an empty array if no tokens stored", () => {
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

    test("throws if removing a token that is not stored", () => {
      const token1 = getAccessToken();
      const token2 = getAccessToken();

      storageManager.saveAccessToken(token1);

      expect(() => {
        storageManager.removeAccessToken(token2);
      }).toThrow("error removing access token");
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

  describe("expired token cleanup", () => {
    const bufferSeconds = 15;

    test("removes expired tokens without refresh tokens", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = { ...getAccessToken(), expiresAt: now - 1, refreshToken: undefined };
      const validToken = { ...getAccessToken(), expiresAt: now + 120 };

      storageManager.saveAccessToken(expiredToken);
      storageManager.saveAccessToken(validToken);

      storageManager.removeExpiredTokens();

      const tokens = storageManager.getAccessTokens();
      expect(tokens).toEqual([validToken]);
    });

    test("keeps expired tokens when refresh token exists", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = { ...getAccessToken(), expiresAt: now - 1, refreshToken: "refresh" };

      storageManager.saveAccessToken(expiredToken);

      storageManager.removeExpiredTokens();

      const tokens = storageManager.getAccessTokens();
      expect(tokens).toEqual([expiredToken]);
    });

    test("removes tokens that exceed maxAgeExpiry", () => {
      const now = Math.floor(Date.now() / 1000);
      const maxAgeExpiredToken = {
        ...getAccessToken(),
        expiresAt: now + 120,
        maxAgeExpiry: now - 1,
        refreshToken: "refresh",
      };

      storageManager.saveAccessToken(maxAgeExpiredToken);

      storageManager.removeExpiredTokens();

      const tokens = storageManager.getAccessTokens();
      expect(tokens).toEqual([]);
    });

    test("removes tokens at the buffer boundary when not refreshable", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + bufferSeconds - 1;
      const nearExpiryToken = { ...getAccessToken(), expiresAt, refreshToken: undefined };

      storageManager.saveAccessToken(nearExpiryToken);

      storageManager.removeExpiredTokens();

      expect(storageManager.getAccessTokens()).toEqual([]);
    });

    test("retains tokens outside the buffer window", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + bufferSeconds + 1;
      const token = { ...getAccessToken(), expiresAt, refreshToken: undefined };

      storageManager.saveAccessToken(token);

      storageManager.removeExpiredTokens();

      expect(storageManager.getAccessTokens()).toEqual([token]);
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

  describe("IDaaS session token storage", () => {
    test("returns undefined if no session token stored", () => {
      expect(storageManager.getIdaasSessionToken()).toBeUndefined();
    });

    test("saves and returns the stored session token", () => {
      const sessionToken = { token: "session-token" };

      storageManager.saveIdaasSessionToken(sessionToken);

      const result = storageManager.getIdaasSessionToken();

      expect(result).toStrictEqual(sessionToken);
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
