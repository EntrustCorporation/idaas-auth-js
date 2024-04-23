import type { Configuration } from "oidc-provider";
import Provider from "oidc-provider";
import { CLIENT_ID, DEV_SERVER, ISSUER } from "./constants";

const providerConfig: Configuration = {
  clients: [
    {
      client_id: CLIENT_ID,
      redirect_uris: [DEV_SERVER],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      post_logout_redirect_uris: [DEV_SERVER],
    },
  ],
  clientBasedCORS(_ctx, _origin, _client) {
    return true;
  },
  features: {
    jwtUserinfo: {
      enabled: true,
    },
    claimsParameter: {
      enabled: true,
    },
    webMessageResponseMode: {
      enabled: true,
    },
  },
  rotateRefreshToken: true,
  ttl: {
    AccessToken: 300,
    AuthorizationCode: 60,
    BackchannelAuthenticationRequest: 300,
    ClientCredentials: 300,
    DeviceCode: 300,
    Grant: 300,
    IdToken: 300,
    Interaction: 300,
    RefreshToken: 60 * 60, // 1 hour
    Session: 300,
  },
};

const createApp = () => {
  const provider = new Provider(ISSUER, providerConfig);

  provider.listen(3000, () => {
    console.info(`OIDC provider listening on port 3000, check ${ISSUER}/.well-known/openid-configuration`);
  });
};

createApp();
