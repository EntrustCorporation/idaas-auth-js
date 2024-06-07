import { type JWTPayload, createRemoteJWKSet, decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";
import type { UserClaims } from "../models";

export interface ValidateIdTokenParams {
  idToken?: string | JWTPayload;
  issuer: string;
  clientId: string;
  nonce: string;
  idTokenSigningAlgValuesSupported: string[];
  acrValuesSupported?: string[];
}

export interface ValidateUserInfoTokenParams {
  userInfoToken: string;
  issuer: string;
  clientId: string;
  jwksEndpoint: string;
}

/**
 * Validate the signed ID token received from the /token endpoint in accordance with the OIDC specification.
 *
 * Note: Since this client only supports the Authorization Code flow, we are able to skip JWT signature validation
 * and instead rely on TLS, as described in 3.1.3.7 #6 of the OIDC core specification.
 * See more at: https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
 */
export const validateIdToken = ({
  idToken,
  issuer,
  clientId,
  nonce,
  idTokenSigningAlgValuesSupported,
  acrValuesSupported,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: High number of simple checks
}: ValidateIdTokenParams) => {
  if (!idToken) {
    throw new Error("No ID token supplied");
  }

  // Store the stringified token for simpler type-ing later on
  let stringifiedToken: string;
  let decodedJwt: JWTPayload;
  let alg: string | undefined;

  try {
    if (typeof idToken !== "string") {
      // If the token is not a jwt string, use it directly as an unsigned object
      stringifiedToken = JSON.stringify(idToken);
      decodedJwt = idToken;
      alg = "none";
    } else {
      // Otherwise, we have a signed jwt string to decode
      stringifiedToken = idToken;
      decodedJwt = decodeJwt(idToken);
      alg = decodeProtectedHeader(idToken).alg;
    }
  } catch {
    throw new Error("ID token format is neither a valid JSON object nor a signed JWT");
  }

  if (!decodedJwt.sub) {
    throw new Error("Subject (sub) claim is missing from ID token");
  }

  if (!decodedJwt.iat) {
    throw new Error("Issued At (iat) claim is missing from ID token");
  }

  if (!decodedJwt.iss) {
    throw new Error("Issuer (iss) claim is missing from ID token");
  }

  if (!decodedJwt.aud) {
    throw new Error("Audience (aud) claim is missing from ID token");
  }

  if (!decodedJwt.exp) {
    throw new Error("Expiration Time (exp) claim is missing from the ID token");
  }

  if (decodedJwt.iss !== issuer) {
    throw new Error(`Issuer (iss) claim ${decodedJwt.iss} in the ID token does not match expected ${issuer}`);
  }

  // Validate that the audience/azp is/includes the clientId
  if (typeof decodedJwt.aud === "string" && decodedJwt.aud !== clientId) {
    throw new Error(`Audience (aud) claim ${decodedJwt.aud} in the ID token does not match expected ${clientId}`);
  }

  if (Array.isArray(decodedJwt.aud)) {
    if (!decodedJwt.aud.includes(clientId)) {
      throw new Error(
        `Audience (aud) claim array ${decodedJwt.aud} in the ID token does not include expected ${clientId}`,
      );
    }

    if (decodedJwt.aud.length > 1) {
      const azp = decodedJwt.azp as string | undefined;
      if (!azp) {
        throw new Error(
          "Authorized Party (azp) claim is missing from ID token and must be present when there are multiple audiences",
        );
      }

      if (azp !== clientId) {
        throw new Error(`Authorized Party (azp) claim ${azp} in the ID token does not match expected ${clientId}`);
      }
    }
  }

  // Validate alg against default RS256
  if (!alg) {
    throw new Error("Algorithm (alg) claim is missing from ID token");
  }

  if (!idTokenSigningAlgValuesSupported.includes(alg)) {
    throw new Error(
      `Algorithm (alg) claim ${alg} in the ID token ${alg} is not one of the supported ${idTokenSigningAlgValuesSupported}`,
    );
  }

  // Default 15s leeway to account for clock skew issues with nbf and exp claims
  const leeway = 15;

  // Validate the token is valid at the current time
  const now = new Date();
  const expDate = new Date((decodedJwt.exp + leeway) * 1000);

  if (now > expDate) {
    throw new Error(`Expiration Time (exp) claim ${decodedJwt.exp} indicates that this token is now expired at ${now}`);
  }

  if (decodedJwt.nbf) {
    const nbfDate = new Date((decodedJwt.nbf - leeway) * 1000);
    if (now < nbfDate) {
      throw new Error(
        `Not Before (nbf) claim ${decodedJwt.nbf} indicates that this token is not to be used yet at ${now}`,
      );
    }
  }

  // Validate the nonce claim is the one sent during Authorization request
  const nonceClaim = decodedJwt.nonce as string | undefined;
  if (!nonceClaim) {
    throw new Error("Nonce (nonce) claim is missing from ID token");
  }

  if (nonceClaim !== nonce) {
    throw new Error(`Nonce (nonce) claim ${nonceClaim} in the ID token does not match expected ${nonce}`);
  }

  const acrClaim = decodedJwt.acr as string | undefined;
  if (acrClaim && !acrValuesSupported?.includes(acrClaim)) {
    throw new Error(
      `Authentication Context Class Reference (acr) claim ${acrClaim} is not one of the supported ${acrValuesSupported}`,
    );
  }

  return { idToken: stringifiedToken, decodedJwt };
};

/**
 * Validate the signed token received from the /userinfo endpoint by checking its signature against the JWKS at the OpenId Provider.
 *
 * See more at: https://openid.net/specs/openid-connect-core-1_0-errata2.html#UserInfo
 */
export const validateUserInfoToken = async ({
  userInfoToken,
  issuer,
  clientId,
  jwksEndpoint,
}: ValidateUserInfoTokenParams): Promise<UserClaims | null> => {
  // Do this to check that the token is actually a jwt, without having to call the JWKS endpoint
  try {
    decodeJwt(userInfoToken);
  } catch {
    return null;
  }

  /*
  Since the token is a jwt, validate it using the OP's JWKS endpoint. This will validate that:
  - The signature on the jwt is valid
  - The issuer and the audience are present
  - The audience is/includes the RP's client ID
  - The issuer is the OP's issuer URL
   */
  const jwks = createRemoteJWKSet(new URL(jwksEndpoint));

  const verifiedJwt = await jwtVerify(userInfoToken, jwks, {
    audience: clientId,
    issuer,
  });

  return verifiedJwt.payload as UserClaims;
};
