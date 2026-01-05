import type { FidoChallenge, FidoResponse } from "../models/openapi-ts";

/**
 * Converts a WebAuthn credential into an IDaaS-compatible FIDO response payload.
 *
 * @param {PublicKeyCredential} credential - The credential received from navigator.credentials.get.
 * @returns {FidoResponse} FIDO response formatted for IDaaS APIs.
 */
export const buildFidoResponse = (credential: PublicKeyCredential): FidoResponse => {
  const credentialJSON = credential.toJSON();
  const { id } = credential;

  if (!("signature" in credentialJSON.response)) {
    throw new Error("Expected assertion response with signature");
  }

  return {
    authenticatorData: credentialJSON.response.authenticatorData,
    clientDataJSON: credentialJSON.response.clientDataJSON,
    credentialId: id,
    signature: credentialJSON.response.signature,
    userHandle: credentialJSON.response.userHandle ?? undefined,
  };
};

/**
 * Builds WebAuthn request options from an IDaaS FIDO challenge.
 *
 * @param {FidoChallenge} fidoChallenge - Challenge details received from IDaaS.
 * @returns {PublicKeyCredentialRequestOptions} Parsed request options for navigator.credentials.get.
 */
export const buildPubKeyRequestOptions = (fidoChallenge: FidoChallenge): PublicKeyCredentialRequestOptions => {
  return PublicKeyCredential.parseRequestOptionsFromJSON({
    challenge: fidoChallenge.challenge,
    allowCredentials: fidoChallenge.allowCredentials?.map((id) => ({
      id,
      type: "public-key",
    })),
  });
};
