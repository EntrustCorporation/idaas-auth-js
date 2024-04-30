export interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
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
