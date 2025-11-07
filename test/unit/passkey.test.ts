import { beforeEach, describe, expect, it, mock } from "bun:test";
import { buildFidoResponse } from "../../src/utils/passkey";

describe("passkey.ts", () => {
  describe("buildFidoResponse", () => {
    let mockCredential: PublicKeyCredential;

    beforeEach(() => {
      // Mock a PublicKeyCredential with all required fields
      mockCredential = {
        id: "credential-id-123",
        type: "public-key",
        rawId: new ArrayBuffer(16),
        response: {} as AuthenticatorAssertionResponse,
        authenticatorAttachment: "platform",
        toJSON: mock(() => ({
          id: "credential-id-123",
          type: "public-key",
          rawId: "base64-raw-id",
          response: {
            authenticatorData: "base64-authenticator-data",
            clientDataJSON: "base64-client-data-json",
            signature: "base64-signature",
            userHandle: "base64-user-handle",
          },
        })),
        getClientExtensionResults: mock(() => ({})),
      } as unknown as PublicKeyCredential;
    });

    it("should correctly transform PublicKeyCredential to FidoResponse", () => {
      const result = buildFidoResponse(mockCredential);

      expect(result).toEqual({
        authenticatorData: "base64-authenticator-data",
        clientDataJSON: "base64-client-data-json",
        credentialId: "credential-id-123",
        signature: "base64-signature",
        userHandle: "base64-user-handle",
      });
    });

    it("should use the credential.id as credentialId", () => {
      const result = buildFidoResponse(mockCredential);

      expect(result.credentialId).toBe("credential-id-123");
    });

    it("should call toJSON() on the credential", () => {
      buildFidoResponse(mockCredential);

      expect(mockCredential.toJSON).toHaveBeenCalledTimes(1);
    });

    it("should handle credential with null userHandle", () => {
      mockCredential.toJSON = mock(() => ({
        id: "credential-id-123",
        type: "public-key",
        rawId: "base64-raw-id",
        response: {
          authenticatorData: "base64-authenticator-data",
          clientDataJSON: "base64-client-data-json",
          signature: "base64-signature",
          userHandle: null,
        },
      }));

      const result = buildFidoResponse(mockCredential);

      expect(result.userHandle).toBeNull();
    });
  });
});
