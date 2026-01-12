import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { FidoChallenge } from "../../src/models/openapi-ts";
import { buildFidoResponse, buildPubKeyRequestOptions } from "../../src/utils/passkey";

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
          clientExtensionResults: {},
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

    it("should throw when assertion signature is missing", () => {
      mockCredential.toJSON = mock(
        () =>
          ({
            id: "credential-id-123",
            type: "public-key",
            rawId: "base64-raw-id",
            clientExtensionResults: {},
            response: {
              authenticatorData: "base64-authenticator-data",
              clientDataJSON: "base64-client-data-json",
            },
          }) as unknown as AuthenticationResponseJSON,
      );

      expect(() => buildFidoResponse(mockCredential)).toThrow("Expected assertion response with signature");
    });

    it("should handle credential with null userHandle", () => {
      mockCredential.toJSON = mock(() => ({
        id: "credential-id-123",
        type: "public-key",
        rawId: "base64-raw-id",
        clientExtensionResults: {},
        response: {
          authenticatorData: "base64-authenticator-data",
          clientDataJSON: "base64-client-data-json",
          signature: "base64-signature",
          userHandle: undefined,
        },
      }));

      const result = buildFidoResponse(mockCredential);

      expect(result.userHandle).toBeUndefined();
    });
  });

  describe("buildPubKeyRequestOptions", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "PublicKeyCredential");

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "PublicKeyCredential", originalDescriptor);
      } else {
        // @ts-expect-error delete only used in tests
        delete globalThis.PublicKeyCredential;
      }
    });

    it("maps allowCredentials for request options", () => {
      const parsedOptions = {
        challenge: new Uint8Array([1]),
      } as PublicKeyCredentialRequestOptions;
      const parseRequestOptionsFromJSON = mock(() => parsedOptions);

      Object.defineProperty(globalThis, "PublicKeyCredential", {
        value: { parseRequestOptionsFromJSON },
        writable: true,
        configurable: true,
      });

      const challenge: FidoChallenge = {
        challenge: "test-challenge",
        allowCredentials: ["cred-1", "cred-2"],
        timeout: 0,
        timeoutMillis: 0,
      };

      const result = buildPubKeyRequestOptions(challenge);

      expect(parseRequestOptionsFromJSON).toHaveBeenCalledTimes(1);
      expect(parseRequestOptionsFromJSON).toHaveBeenCalledWith({
        challenge: "test-challenge",
        allowCredentials: [
          { id: "cred-1", type: "public-key" },
          { id: "cred-2", type: "public-key" },
        ],
      });
      expect(result).toBe(parsedOptions);
    });

    it("passes through when allowCredentials is missing", () => {
      const parsedOptions = {
        challenge: new Uint8Array([1]),
      } as PublicKeyCredentialRequestOptions;
      const parseRequestOptionsFromJSON = mock(() => parsedOptions);

      Object.defineProperty(globalThis, "PublicKeyCredential", {
        value: { parseRequestOptionsFromJSON },
        writable: true,
        configurable: true,
      });

      const challenge: FidoChallenge = {
        challenge: "test-challenge",
        timeout: 0,
        timeoutMillis: 0,
      };

      const result = buildPubKeyRequestOptions(challenge);

      expect(parseRequestOptionsFromJSON).toHaveBeenCalledWith({
        challenge: "test-challenge",
        allowCredentials: undefined,
      });
      expect(result).toBe(parsedOptions);
    });
  });
});
