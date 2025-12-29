import type { FidoChallenge, FidoResponse } from "../models/openapi-ts";

/**
 * Converts a WebAuthn credential into an IDaaS-compatible FIDO response payload.
 *
 * @param {PublicKeyCredential} credential - The credential received from navigator.credentials.get.
 * @returns {FidoResponse} FIDO response formatted for IDaaS APIs.
 */
export const buildFidoResponse = (credential: PublicKeyCredential): FidoResponse => {
  const credentialJSON = credential.toJSON() as AuthenticationResponseJSON;
  const { id } = credential;
  const response = credentialJSON.response;

  return {
    authenticatorData: response.authenticatorData,
    clientDataJSON: response.clientDataJSON,
    credentialId: id,
    signature: response.signature,
    userHandle: response.userHandle,
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
