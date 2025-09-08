import type { PublicKeyCredentialDescriptorJSON } from "../models";

/**
 * Format string as an https url and remove any trailing slash
 *
 * Exception: if the URL explicitly begins with http://localhost:<port>
 *
 * @param initialUrl url string to format
 */
export const formatUrl = (initialUrl: string): string => {
  // make sure there's a protocol
  const input = initialUrl.includes("://") ? initialUrl : `https://${initialUrl}`;

  // parse the URL. Will throw if URL is invalid
  const url = new URL(input);

  // Validate the protocol to ensure it's HTTPS or HTTP for localhost
  if (url.protocol !== "https:") {
    if (url.hostname !== "localhost" || url.protocol !== "http:") {
      url.protocol = "https:";
    }
  }

  // Remove the trailing slash
  const finalUrl = url.toString();

  return finalUrl.endsWith("/") ? finalUrl.slice(0, -1) : finalUrl;
};

/**
 * Calculate the expiry time of a token
 * @param expiresIn the time in milliseconds until expiry
 * @param authTime the time in seconds since epoch at which the user authenticated to receive a token
 */
export const calculateEpochExpiry = (expiresIn: string, authTime = Math.floor(Date.now() / 1000).toString()) => {
  return Number.parseInt(expiresIn) + Number.parseInt(authTime);
};

/**
 * Sanitizes the passed URI clearing searchParams
 * @param redirectUri the uri to sanitize
 */
export const sanitizeUri = (redirectUri: string): string => {
  const sanitizedUrl = new URL(redirectUri);
  sanitizedUrl.search = "";

  return sanitizedUrl.toString();
};

export const base64URLStringToBuffer = (base64URLString: string): ArrayBuffer => {
  // Convert from Base64URL to Base64
  const base64 = base64URLString.replace(/-/g, "+").replace(/_/g, "/");
  /**
   * Pad with '=' until it's a multiple of four
   * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
   * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
   * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
   * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
   */
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, "=");

  // Convert to a binary string
  const binary = atob(padded);

  // Convert binary string to buffer
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return buffer;
};

export const bufferToBase64URLString = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let str = "";

  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }

  const base64String = btoa(str);

  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

export const toPublicKeyCredentialDescriptor = (
  descriptor: PublicKeyCredentialDescriptorJSON,
): PublicKeyCredentialDescriptor => {
  const { id } = descriptor;

  return {
    ...descriptor,
    id: base64URLStringToBuffer(id),
    transports: descriptor.transports as AuthenticatorTransport[],
  };
};
