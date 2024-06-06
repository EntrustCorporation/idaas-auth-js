/**
 * Format string as an https url and remove any trailing /
 * @param initialUrl url string to format
 */
export const formatUrl = (initialUrl: string): string => {
  // remove trailing /
  const finalUrl = initialUrl.endsWith("/") ? initialUrl.slice(0, -1) : initialUrl;
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
