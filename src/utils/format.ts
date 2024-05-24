export const formatUrl = (initialUrl: string): string => {
  // remove trailing /
  const finalUrl = initialUrl.endsWith("/") ? initialUrl.slice(0, -1) : initialUrl;
  // prepend https:// if it's not already there
  return finalUrl.startsWith("https://") ? finalUrl : `https://${finalUrl}`;
};
