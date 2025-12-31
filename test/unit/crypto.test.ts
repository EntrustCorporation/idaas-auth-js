import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Buffer } from "node:buffer";
import { base64UrlStringEncode, createRandomString, generateChallengeVerifierPair } from "../../src/utils/crypto";

describe("crypto.ts", () => {
  const originalCrypto = window.crypto;
  const originalBtoa = globalThis.btoa;

  beforeEach(() => {
    if (!globalThis.btoa) {
      globalThis.btoa = (value: string) => Buffer.from(value, "binary").toString("base64");
    }
  });

  afterEach(() => {
    Object.defineProperty(window, "crypto", { value: originalCrypto, configurable: true });
    if (originalBtoa) {
      globalThis.btoa = originalBtoa;
    } else {
      // @ts-expect-error delete only used in tests
      delete globalThis.btoa;
    }
  });

  it("creates a 32-byte random string", () => {
    const getRandomValues = mock((array: Uint8Array) => {
      array.fill(7);
      return array;
    });

    Object.defineProperty(window, "crypto", { value: { getRandomValues }, configurable: true });

    const result = createRandomString();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(32);
  });

  it("encodes base64 URL-safe without padding", () => {
    const input = String.fromCharCode(251, 255); // "+/8=" before URL-safe conversion
    const result = base64UrlStringEncode(input);

    expect(result).toBe("-_8");
  });

  it("generates a verifier and challenge pair", async () => {
    const getRandomValues = mock((array: Uint8Array) => {
      array.fill(1);
      return array;
    });
    const digest = mock(async () => new Uint8Array([1, 2, 3, 4]).buffer);

    Object.defineProperty(window, "crypto", { value: { getRandomValues, subtle: { digest } }, configurable: true });

    const { codeVerifier, codeChallenge } = await generateChallengeVerifierPair();

    const expectedVerifier = base64UrlStringEncode(String.fromCharCode(...new Uint8Array(32).fill(1)));
    const expectedChallenge = base64UrlStringEncode(String.fromCharCode(1, 2, 3, 4));

    expect(codeVerifier).toBe(expectedVerifier);
    expect(codeChallenge).toBe(expectedChallenge);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(digest).toHaveBeenCalledTimes(1);
  });
});
