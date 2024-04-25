interface OidcConfig {
  issuer: string;
  clientId: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scope: string;
  responseType: string;
}

interface TokenResponse {
  idToken: string;
  accessToken: string;
  expiresIn: string;
  tokenType: string;
  refreshToken?: string;
}

export class IdaasClient {
  private config: OidcConfig | null = null;
  constructor(
    private issuerUrl: string,
    private clientId: string,
  ) {}

  async loadConfiguration() {
    const wellKnownUrl = `${this.issuerUrl}/.well-known/openid-configuration`;

    try {
      const response = await fetch(wellKnownUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
      }
      this.config = await response.json();
    } catch (error) {
      throw new Error(`Failed to load OIDC configuration: ${error}`);
    }
  }

  async authorization(redirectUri: string, scope: string, responseType: string): Promise<void> {}

  async token(authorizationCode: string): Promise<TokenResponse | undefined> {
    return undefined;
  }
}
