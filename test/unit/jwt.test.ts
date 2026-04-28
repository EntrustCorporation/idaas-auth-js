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

describe("jwt.ts", () => {
  describe("validateIdToken", () => {
    test("throw error if idToken not supplied", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: undefined });
      }).toThrowError("ID");
    });

    test("throw error if idToken is not signed JWT or JSON object", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: "notValid" });
      }).toThrowError("format");
    });

    test("throw error if sub claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, sub: undefined } });
      }).toThrowError("sub");
    });

    test("throw error if iat claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, iat: undefined } });
      }).toThrowError("iat");
    });

    test("throw error if iss claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, iss: undefined } });
      }).toThrowError("iss");
    });

    test("throw error if aud claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, aud: undefined } });
      }).toThrowError("aud");
    });

    test("throw error if exp claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, exp: undefined } });
      }).toThrowError("exp");
    });

    test("throw error if iss claim does not match expected", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, iss: "different" } });
      }).toThrowError("iss");
    });

    test("throw error if aud claim as string does not match expected", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, aud: "different" } });
      }).toThrowError("aud");
    });

    test("throw error if aud claim as array does not include expected", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, aud: ["different"] } });
      }).toThrowError("array");
    });

    test("throw error if more than one audience and azp claim is missing", () => {
      expect(() => {
        validateIdToken({
          ...TEST_VALIDATE_ID_TOKEN_PARAMS,
          idToken: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"], azp: undefined },
        });
      }).toThrowError("azp");
    });

    test("throw error if more than one audience and azp claim is different than expected", () => {
      expect(() => {
        validateIdToken({
          ...TEST_VALIDATE_ID_TOKEN_PARAMS,
          idToken: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"], azp: "different" },
        });
      }).toThrowError("match");
    });

    test("throw error if alg claim is missing", () => {
      const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const unsignedToken = `${base64Url({ typ: "JWT" })}.${base64Url(TEST_JWT_PAYLOAD)}.signature`;

      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: unsignedToken });
      }).toThrowError("alg");
    });

    test("throw error if alg claim is not supported", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idTokenSigningAlgValuesSupported: ["different"] });
      }).toThrowError("alg");
    });

    test("throw error if token is expired", () => {
      const expiredExp = Math.floor(Date.now() / 1000) - 60;
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, exp: expiredExp } });
      }).toThrowError("exp");
    });

    test("token is used before nbf claim", () => {
      expect(() => {
        validateIdToken({
          ...TEST_VALIDATE_ID_TOKEN_PARAMS,
          idToken: { ...TEST_JWT_PAYLOAD, nbf: Math.floor(Math.floor(Date.now() / 1000) + 60) },
        });
      }).toThrowError("nbf");
    });

    test("throw error if nonce claim missing", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, nonce: undefined } });
      }).toThrowError("nonce");
    });

    test("throw error if nonce is different than expected", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, nonce: "different" } });
      }).toThrowError("match");
    });

    test("throw error if acr claim is not supported", () => {
      expect(() => {
        validateIdToken({ ...TEST_VALIDATE_ID_TOKEN_PARAMS, idToken: { ...TEST_JWT_PAYLOAD, acr: "different" } });
      }).toThrowError("supported");
    });

    test("successful validation with single aud returns a decoded id token and an encoded id token", () => {
      const result = validateIdToken(TEST_VALIDATE_ID_TOKEN_PARAMS);

      expect(typeof result.idToken).toBe("string");
      expect(result.decodedJwt.sub).toBeTruthy();
    });

    test("successful validation with multiple aud returns a decoded id token and an encoded id token", () => {
      const result = validateIdToken({
        ...TEST_VALIDATE_ID_TOKEN_PARAMS,
        idToken: { ...TEST_JWT_PAYLOAD, aud: [TEST_CLIENT_ID, "different"] },
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

    test("verifies JWT userinfo with the configured JWKS endpoint", async () => {
      const jwksStub = Object.assign(async () => ({}) as unknown, {
        coolingDown: false,
        fresh: false,
        reloading: false,
        reload: async () => undefined,
        jwks: () => undefined,
      }) as ReturnType<typeof jose.createRemoteJWKSet>;
      const createRemoteJWKSetSpy = spyOn(jose, "createRemoteJWKSet").mockImplementationOnce(() => jwksStub);
      const jwtVerifySpy = spyOn(jose, "jwtVerify").mockImplementationOnce(
        // @ts-expect-error not full return type
        async (userInfoToken, _jwkSet, _options) => {
          return { payload: jose.decodeJwt(userInfoToken as string), protectedHeader: { alg: "RS256" } };
        },
      );

      const result = await validateUserInfoToken({
        ...TEST_VALIDATE_USER_INFO_PARAMS,
        userInfoToken: TEST_ENCODED_TOKEN,
      });

      expect(createRemoteJWKSetSpy).toHaveBeenCalledWith(new URL(TEST_VALIDATE_USER_INFO_PARAMS.jwksEndpoint));
      expect(jwtVerifySpy).toHaveBeenCalledWith(TEST_ENCODED_TOKEN, jwksStub, {
        issuer: TEST_VALIDATE_USER_INFO_PARAMS.issuer,
        audience: TEST_VALIDATE_USER_INFO_PARAMS.clientId,
      });
      expect(result?.sub).toBeTruthy();
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
