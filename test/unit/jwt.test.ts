import { describe, expect, spyOn, test } from "bun:test";
import * as jose from "jose";
import { readAccessToken, validateIdToken, validateUserInfoToken } from "../../src/utils/jwt";
import {
  TEST_CLIENT_ID,
  TEST_ENCODED_TOKEN,
  TEST_JWT_PAYLOAD,
  TEST_VALIDATE_ID_TOKEN_PARAMS,
  TEST_VALIDATE_USER_INFO_PARAMS,
} from "./constants";

const TEST_RS256_HEADER = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
const TEST_RS256_PAYLOAD = Buffer.from(JSON.stringify(TEST_JWT_PAYLOAD)).toString("base64url");
const TEST_RS256_TOKEN = `${TEST_RS256_HEADER}.${TEST_RS256_PAYLOAD}.signature`;

describe("jwt.ts", () => {
  describe("validateIdToken", () => {
    test("throw error if idToken not supplied", async () => {
      const promise = validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: undefined });
      expect(promise).rejects.toThrow("ID");
    });

    test("throw error if idToken is not signed JWT or JSON object", async () => {
      const promise = validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: "notValid" });
      expect(promise).rejects.toThrow("format");
    });

    test("throw error if sub claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, sub: undefined },
      });
      expect(promise).rejects.toThrow("sub");
    });

    test("throw error if iat claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, iat: undefined },
      });
      expect(promise).rejects.toThrow("iat");
    });

    test("throw error if iss claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, iss: undefined },
      });
      expect(promise).rejects.toThrow("iss");
    });

    test("throw error if aud claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: undefined },
      });
      expect(promise).rejects.toThrow("aud");
    });

    test("throw error if exp claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, exp: undefined },
      });
      expect(promise).rejects.toThrow("exp");
    });

    test("throw error if iss claim does not match expected", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, iss: "different" },
      });
      expect(promise).rejects.toThrow("iss");
    });

    test("throw error if aud claim as string does not match expected", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: "different" },
      });
      expect(promise).rejects.toThrow("aud");
    });

    test("throw error if aud claim as array does not include expected", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: ["different"] },
      });
      expect(promise).rejects.toThrow("array");
    });

    test("throw error if more than one audience and azp claim is missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"], azp: undefined },
      });
      expect(promise).rejects.toThrow("azp");
    });

    test("throw error if more than one audience and azp claim is different than expected", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"], azp: "different" },
      });
      expect(promise).rejects.toThrow("match");
    });

    test("throw error if alg claim is not supported", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: TEST_RS256_TOKEN,
        idTokenSigningAlgValuesSupported: ["PS256"],
      });
      expect(promise).rejects.toThrow("alg");
    });

    test("throw error if user requested algorithm list excludes token alg", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: TEST_RS256_TOKEN,
        allowedIdTokenSigningAlgorithms: ["PS256"],
      });
      expect(promise).rejects.toThrow("allowed");
    });

    test("throw error if user requested algorithm list contains unsupported algorithm", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: TEST_RS256_TOKEN,
        allowedIdTokenSigningAlgorithms: ["HS256"],
      });
      expect(promise).rejects.toThrow("unsupported");
    });

    test("throw error if idToken is an unsigned object", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: TEST_JWT_PAYLOAD,
      });
      expect(promise).rejects.toThrow("none");
    });

    test("throw error if token is expired", async () => {
      const promise = validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, exp: 0 } });
      expect(promise).rejects.toThrow("exp");
    });

    test("throw error if iat claim is in the future", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, iat: Math.floor(Date.now() / 1000) + 60 },
      });
      expect(promise).rejects.toThrow("iat");
    });

    test("throw error if iat claim is not a valid number", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, iat: Number.POSITIVE_INFINITY },
      });
      expect(promise).rejects.toThrow("numeric");
    });

    test("throw error if iat claim is after exp claim", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: {
          ...TEST_JWT_PAYLOAD,
          iat: Math.floor(Date.now() / 1000) + 120,
          exp: Math.floor(Date.now() / 1000) + 60,
        },
      });
      expect(promise).rejects.toThrow("later than");
    });

    test("token is used before nbf claim", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, nbf: Math.floor(Math.floor(Date.now() / 1000) + 60) },
      });
      expect(promise).rejects.toThrow("nbf");
    });

    test("throw error if nonce claim missing", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, nonce: undefined },
      });
      expect(promise).rejects.toThrow("nonce");
    });

    test("throw error if nonce is different than expected", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, nonce: "different" },
      });
      expect(promise).rejects.toThrow("match");
    });

    test("throw error if acr claim is not supported", async () => {
      const promise = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, acr: "different" },
      });
      expect(promise).rejects.toThrow("supported");
    });

    test("successful validation with single aud returns a decoded id token and an encoded id token", async () => {
      // Mock createRemoteJWKSet to avoid network requests during signature verification.
      // @ts-expect-error - simplified mock implementation for testing
      const _spyOnCreateRemoteJWKSet = spyOn(jose, "createRemoteJWKSet").mockImplementationOnce(() => {
        return async () => ({ keys: [] });
      });

      const _spyOnJwtVerify = spyOn(jose, "jwtVerify").mockImplementationOnce(
        // @ts-expect-error not full return type
        async () => ({ payload: TEST_JWT_PAYLOAD }),
      );

      const result = await validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: TEST_RS256_TOKEN });

      expect(typeof result.idToken).toBe("string");
      expect(result.decodedJwt.sub).toBeTruthy();
    });

    test("successful validation with multiple aud returns a decoded id token and an encoded id token", async () => {
      // Mock createRemoteJWKSet to avoid network requests during signature verification.
      // @ts-expect-error - simplified mock implementation for testing
      const _spyOnCreateRemoteJWKSet = spyOn(jose, "createRemoteJWKSet").mockImplementationOnce(() => {
        return async () => ({ keys: [] });
      });

      const _spyOnJwtVerify = spyOn(jose, "jwtVerify").mockImplementationOnce(
        // @ts-expect-error not full return type
        async () => ({ payload: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"] } }),
      );

      const result = await validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: `${TEST_RS256_HEADER}.${Buffer.from(JSON.stringify({ ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"] })).toString("base64url")}.signature`,
      });

      expect(typeof result.idToken).toBe("string");
      expect(result.decodedJwt.sub).toBeTruthy();
    });
  });

  describe("validateUserInfoToken", () => {
    test("returns null if userInfoToken is not a JWT", async () => {
      const result = await validateUserInfoToken({ ...TEST_VALIDATE_USER_INFO_PARAMS, userInfoToken: "not a JWT" });
      expect(result).toBeNull();
    });

    test("returns the JWT payload if no errors raised from jwtVerify", async () => {
      // Mock createRemoteJWKSet to avoid actual network requests to JWKS endpoint
      // @ts-expect-error - Mocking with simplified implementation for testing
      const _spyOnCreateRemoteJWKSet = spyOn(jose, "createRemoteJWKSet").mockImplementationOnce(() => {
        return async () => ({ keys: [] });
      });

      const _spyOnJwtVerify = spyOn(jose, "jwtVerify").mockImplementationOnce(
        // @ts-expect-error not full return type
        async (userInfoToken) => ({ payload: jose.decodeJwt(userInfoToken) }),
      );

      const result = await validateUserInfoToken({
        ...TEST_VALIDATE_USER_INFO_PARAMS,
        userInfoToken: TEST_ENCODED_TOKEN,
      });
      expect(result).toBeTruthy();
    });
  });

  describe("readAccessToken", () => {
    test("returns an object containing the acr claim", () => {
      const result = readAccessToken(TEST_ENCODED_TOKEN);
      expect(result?.acr).toBeTruthy();
    });

    test("returns null if the passed token is not a JWT", () => {
      const result = readAccessToken("not a JWT");
      expect(result).toBeNull();
    });
  });
});
