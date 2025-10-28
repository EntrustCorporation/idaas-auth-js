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
