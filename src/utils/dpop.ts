import { calculateJwkThumbprint, exportJWK, importJWK, type JWK, SignJWT } from "jose";

export type DPoPAlg = "ES256" | "ES384" | "ES512" | "PS256" | "PS384" | "PS512" | "RS256" | "RS384" | "RS512";

export interface DPoPKeyMaterial {
  privateKey: CryptoKey;
  publicJwk: JWK;
  jkt: string;
}

export interface SerializedDPoPKeyMaterial {
  alg: DPoPAlg;
  privateJwk: JWK;
  publicJwk: JWK;
  jkt: string;
}

const DPOP_PROOF_LIFETIME_SECONDS = 60;

export const generateDpopKeyMaterial = async (alg: DPoPAlg): Promise<DPoPKeyMaterial> => {
  const keyPair = await generateKeyPair(alg);
  const publicJwk = await exportJWK(keyPair.publicKey);
  const jkt = await calculateJwkThumbprint(publicJwk, "sha256");

  return {
    privateKey: keyPair.privateKey,
    publicJwk,
    jkt,
  };
};

export const generateDpopProofJwt = async ({
  alg,
  privateKey,
  publicJwk,
  htm,
  htu,
  accessToken,
}: {
  alg: DPoPAlg;
  privateKey: CryptoKey;
  publicJwk: JWK;
  htm: string;
  htu: string;
  accessToken?: string;
}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, string | number> = {
    htm: htm.toUpperCase(),
    htu,
    iat: now,
    exp: now + DPOP_PROOF_LIFETIME_SECONDS,
    jti: getJti(),
  };

  if (accessToken) {
    claims.ath = await getAth(accessToken);
  }

  return await new SignJWT(claims)
    .setProtectedHeader({
      alg,
      typ: "dpop+jwt",
      jwk: publicJwk,
    })
    .sign(privateKey);
};

export const serializeDpopKeyMaterial = async ({
  alg,
  privateKey,
  publicJwk,
  jkt,
}: DPoPKeyMaterial & { alg: DPoPAlg }): Promise<SerializedDPoPKeyMaterial> => {
  const privateJwk = await exportJWK(privateKey);

  return {
    alg,
    privateJwk,
    publicJwk,
    jkt,
  };
};

export const importDpopKeyMaterial = async ({
  alg,
  privateJwk,
  publicJwk,
  jkt,
}: SerializedDPoPKeyMaterial): Promise<DPoPKeyMaterial> => {
  const importedPrivateKey = (await importJWK(privateJwk, alg)) as CryptoKey;

  return {
    privateKey: importedPrivateKey,
    publicJwk,
    jkt,
  };
};

const generateKeyPair = async (alg: DPoPAlg): Promise<CryptoKeyPair> => {
  if (alg === "ES256" || alg === "ES384" || alg === "ES512") {
    const namedCurve = alg === "ES256" ? "P-256" : alg === "ES384" ? "P-384" : "P-521";

    return await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve,
      },
      true,
      ["sign", "verify"],
    );
  }

  if (alg === "PS256" || alg === "PS384" || alg === "PS512") {
    const hash = alg === "PS256" ? "SHA-256" : alg === "PS384" ? "SHA-384" : "SHA-512";

    return await window.crypto.subtle.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash,
      },
      true,
      ["sign", "verify"],
    );
  }

  const hash = alg === "RS256" ? "SHA-256" : alg === "RS384" ? "SHA-384" : "SHA-512";

  return await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash,
    },
    true,
    ["sign", "verify"],
  );
};

const getJti = (): string => {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getAth = async (accessToken: string): Promise<string> => {
  const encoder = new TextEncoder();
  const hash = await window.crypto.subtle.digest("SHA-256", encoder.encode(accessToken));
  const hashBytes = new Uint8Array(hash);
  const binary = String.fromCharCode(...hashBytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
