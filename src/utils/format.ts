/**
 * Format string as an https url and remove any trailing /
 *
 * Exception: if the URL explicitly begins with http://localhost:<port>
 * @param initialUrl url string to format
 */
export const formatUrl = (initialUrl: string): string => {
  // remove trailing /
  const finalUrl = initialUrl.endsWith("/") ? initialUrl.slice(0, -1) : initialUrl;
  // Return if localhost url
  if (finalUrl.startsWith("http://localhost:")) {
    return finalUrl;
  }
  // prepend https:// if it's not already there
  return finalUrl.startsWith("https://") ? finalUrl : `https://${finalUrl}`;
};

/**
 * Convert an expiry time to seconds since epoch
 * @param expiresIn the time in milliseconds until expiry
 */
export const expiryToEpochSeconds = (expiresIn: string): number => {
  const issuedAt = Math.floor(Date.now() / 1000);
  return Number.parseInt(expiresIn) + issuedAt;
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
