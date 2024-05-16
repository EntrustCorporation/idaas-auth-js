import { decodeJwt, decodeProtectedHeader } from "jose";

interface ValidateIdTokenParams {
  idToken: string;
  issuer: string;
  clientId: string;
  nonce: string;
  idTokenSigningAlgValuesSupported: string[];
  acrValuesSupported?: string[];
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
}: ValidateIdTokenParams) => {
  const decodedJwt = decodeJwt(idToken);
  const { alg } = decodeProtectedHeader(idToken);

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

  return decodedJwt;
};
