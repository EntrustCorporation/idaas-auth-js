import { beforeEach, describe, expect, it } from "bun:test";
import { decodeJwt, decodeProtectedHeader, type JWK } from "jose";
import { type DPoPAlg, generateDpopKeyMaterial, generateDpopProofJwt } from "../../../src/utils/dpop";

describe("DPoP Key Material and Proof Generation", () => {
  const supportedAlgs: DPoPAlg[] = ["ES256", "PS256", "RS256"];

  describe("generateDpopKeyMaterial", () => {
    supportedAlgs.forEach((alg) => {
      describe(`Algorithm: ${alg}`, () => {
        let keyMaterial: Awaited<ReturnType<typeof generateDpopKeyMaterial>>;

        beforeEach(async () => {
          keyMaterial = await generateDpopKeyMaterial(alg);
        });

        it("generates a valid DPoP key material object", async () => {
          expect(keyMaterial).toBeDefined();
          expect(keyMaterial.privateKey).toBeDefined();
          expect(keyMaterial.publicJwk).toBeDefined();
          expect(keyMaterial.jkt).toBeDefined();
        });

        it("returns a CryptoKey for privateKey", () => {
          expect(keyMaterial.privateKey).toBeInstanceOf(CryptoKey);
          expect(keyMaterial.privateKey.type).toBe("private");
          expect(keyMaterial.privateKey.extractable).toBe(true);
        });

        it("returns a valid JWK for publicJwk", () => {
          const jwk = keyMaterial.publicJwk as JWK;
          expect(jwk.kty).toBeDefined();
          expect(jwk.crv || jwk.n).toBeDefined(); // EC has crv, RSA has n
        });

        it("generates a base64url-encoded JWK thumbprint (jkt)", () => {
          const jkt = keyMaterial.jkt;
          // JWK thumbprints are base64url without padding
          expect(jkt).toMatch(/^[A-Za-z0-9_-]+$/);
          // Typical SHA-256 thumbprint is 43 characters in base64url
          expect(jkt.length).toBeGreaterThan(0);
        });

        it("generates a different jkt for newly generated key material", async () => {
          // Note: We can't directly test consistency since we can't re-import the same CryptoKey,
          // but we can verify the jkt is valid
          const jkt2 = await generateDpopKeyMaterial(alg);
          expect(jkt2.jkt).not.toBe(keyMaterial.jkt); // Different keys have different jkts
          expect(jkt2.jkt).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it("has correct algorithm settings for EC keys (ES256/ES384/ES512)", async () => {
          if (!alg.startsWith("ES")) return;

          const jwk = keyMaterial.publicJwk as JWK;
          expect(jwk.kty).toBe("EC");
          expect(jwk.crv).toBeDefined();

          const expectedCurve = alg === "ES256" ? "P-256" : alg === "ES384" ? "P-384" : "P-521";
          expect(jwk.crv).toBe(expectedCurve);
          expect(jwk.x).toBeDefined();
          expect(jwk.y).toBeDefined();
        });

        it("has correct algorithm settings for RSA keys (RS256/PS256)", async () => {
          if (!alg.startsWith("R") && !alg.startsWith("P")) return;

          const jwk = keyMaterial.publicJwk as JWK;
          expect(jwk.kty).toBe("RSA");
          expect(jwk.n).toBeDefined();
          expect(jwk.e).toBeDefined();
        });
      });
    });

    it("generates unique key material on each call", async () => {
      const material1 = await generateDpopKeyMaterial("ES256");
      const material2 = await generateDpopKeyMaterial("ES256");

      expect(material1.jkt).not.toBe(material2.jkt);
    });
  });

  describe("generateDpopProofJwt", () => {
    let keyMaterial: Awaited<ReturnType<typeof generateDpopKeyMaterial>>;

    beforeEach(async () => {
      keyMaterial = await generateDpopKeyMaterial("ES256");
    });

    it("generates a valid JWT string", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      expect(typeof proof).toBe("string");
      expect(proof.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("creates a JWT with correct protected header", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "GET",
        htu: "https://example.com/userinfo",
      });

      const header = decodeProtectedHeader(proof);
      expect(header.alg).toBe("ES256");
      expect(header.typ).toBe("dpop+jwt");
      expect(header.jwk).toBeDefined();
    });

    it("includes required DPoP claims: htm, htu, iat, exp, jti", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const claims = decodeJwt(proof);
      expect(claims.htm).toBe("POST");
      expect(claims.htu).toBe("https://example.com/token");
      expect(claims.iat).toBeDefined();
      expect(claims.exp).toBeDefined();
      expect(claims.jti).toBeDefined();
    });

    it("normalizes htm to uppercase", async () => {
      const proofLower = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "post",
        htu: "https://example.com/token",
      });

      const claimsLower = decodeJwt(proofLower);
      expect(claimsLower.htm).toBe("POST");

      const proofUpper = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const claimsUpper = decodeJwt(proofUpper);
      expect(claimsUpper.htm).toBe("POST");
    });

    it("sets exp to iat + 60 seconds", async () => {
      const beforeProof = Math.floor(Date.now() / 1000);

      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const afterProof = Math.floor(Date.now() / 1000);
      const claims = decodeJwt(proof);

      // iat should be between beforeProof and afterProof
      expect((claims.iat as number) >= beforeProof).toBe(true);
      expect((claims.iat as number) <= afterProof).toBe(true);

      // exp should be iat + 60
      expect(claims.exp).toBe((claims.iat as number) + 60);
    });

    it("includes ath claim when accessToken is provided", async () => {
      const accessToken = "test_access_token_12345";

      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
        accessToken,
      });

      const claims = decodeJwt(proof);
      expect(claims.ath).toBeDefined();
      expect(typeof claims.ath).toBe("string");
      // ath is base64url encoded
      expect(claims.ath as string).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("does not include ath claim when accessToken is not provided", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const claims = decodeJwt(proof);
      expect(claims.ath).toBeUndefined();
    });

    it("generates unique jti for each proof (replay protection)", async () => {
      const proof1 = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const proof2 = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const claims1 = decodeJwt(proof1);
      const claims2 = decodeJwt(proof2);

      expect(claims1.jti).not.toBe(claims2.jti);
    });

    it("preserves the exact htu value (no normalization)", async () => {
      const htu = "https://example.com:8080/api/v1/token?param=value";

      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu,
      });

      const claims = decodeJwt(proof);
      expect(claims.htu).toBe(htu);
    });

    it("works with different algorithms", async () => {
      const algsToTest: DPoPAlg[] = ["ES256", "PS256", "RS256"];

      for (const alg of algsToTest) {
        const material = await generateDpopKeyMaterial(alg);

        const proof = await generateDpopProofJwt({
          alg,
          privateKey: material.privateKey,
          publicJwk: material.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
        });

        expect(proof).toBeDefined();
        expect(proof.split(".").length).toBe(3);

        const header = decodeProtectedHeader(proof);
        expect(header.alg).toBe(alg);
      }
    });

    it("includes the correct public JWK in the protected header", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      const header = decodeProtectedHeader(proof);
      expect(header.jwk).toEqual(keyMaterial.publicJwk);
    });

    it("produces cryptographically valid JWT (can be decoded without error)", async () => {
      const proof = await generateDpopProofJwt({
        alg: "ES256",
        privateKey: keyMaterial.privateKey,
        publicJwk: keyMaterial.publicJwk,
        htm: "POST",
        htu: "https://example.com/token",
      });

      // These should not throw
      expect(() => decodeProtectedHeader(proof)).not.toThrow();
      expect(() => decodeJwt(proof)).not.toThrow();
    });

    describe("ath (access token hash) generation", () => {
      it("generates consistent ath for the same access token", async () => {
        const accessToken = "my_access_token";

        const proof1 = await generateDpopProofJwt({
          alg: "ES256",
          privateKey: keyMaterial.privateKey,
          publicJwk: keyMaterial.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
          accessToken,
        });

        const proof2 = await generateDpopProofJwt({
          alg: "ES256",
          privateKey: keyMaterial.privateKey,
          publicJwk: keyMaterial.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
          accessToken,
        });

        const claims1 = decodeJwt(proof1);
        const claims2 = decodeJwt(proof2);

        // Both should have ath
        expect(claims1.ath).toBeDefined();
        expect(claims2.ath).toBeDefined();

        // ath values should be identical for the same token
        expect(claims1.ath).toBe(claims2.ath);
      });

      it("generates different ath for different access tokens", async () => {
        const proof1 = await generateDpopProofJwt({
          alg: "ES256",
          privateKey: keyMaterial.privateKey,
          publicJwk: keyMaterial.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
          accessToken: "token_one",
        });

        const proof2 = await generateDpopProofJwt({
          alg: "ES256",
          privateKey: keyMaterial.privateKey,
          publicJwk: keyMaterial.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
          accessToken: "token_two",
        });

        const claims1 = decodeJwt(proof1);
        const claims2 = decodeJwt(proof2);

        expect(claims1.ath).not.toBe(claims2.ath);
      });

      it("ath is base64url encoded without padding", async () => {
        const proof = await generateDpopProofJwt({
          alg: "ES256",
          privateKey: keyMaterial.privateKey,
          publicJwk: keyMaterial.publicJwk,
          htm: "POST",
          htu: "https://example.com/token",
          accessToken: "test_token",
        });

        const claims = decodeJwt(proof);
        const ath = claims.ath as string;

        // Should be base64url
        expect(ath).toMatch(/^[A-Za-z0-9_-]+$/);
        // Should not have padding
        expect(ath).not.toMatch(/=/);
      });
    });
  });
});
