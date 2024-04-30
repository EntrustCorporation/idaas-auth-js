export const createRandomString = () => {
  const randomNumbers = window.crypto.getRandomValues(new Uint8Array(32));

  return String.fromCharCode(...randomNumbers);
};

export const base64UrlStringEncode = (str: string) => {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const base64UrlOctetEncode = (array: Uint8Array) => {
  return base64UrlStringEncode(String.fromCharCode(...array));
};

export const generateChallengeVerifierPair = async () => {
  const randomString = createRandomString();
  const codeVerifier = base64UrlStringEncode(randomString);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
};

const createCodeChallenge = async (codeVerifier: string) => {
  const hash = await sha256(codeVerifier);
  return base64UrlOctetEncode(hash);
};

export const sha256 = async (string: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
};
