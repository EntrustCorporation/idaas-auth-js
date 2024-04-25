export interface OidcConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  endSessionEndpoint: string;
  jwksUri: string;
}

export const fetchOpenidConfiguration = async (issuerUrl: string): Promise<OidcConfig> => {
  const wellKnownUrl = `${issuerUrl}/.well-known/openid-configuration`;

  try {
    const response = await fetch(wellKnownUrl);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to load OIDC configuration: ${error}`);
  }
};
