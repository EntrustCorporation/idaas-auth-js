# IDaaS Auth JS

## Overview

IDaaS Auth JS is the official JavaScript/TypeScript SDK for Entrust Identity-as-a-Service. It wraps hosted OIDC flows, risk-based authentication (RBA) challenges, and “convenience” methods (password, OTP, passkey, soft token, etc.) in a client.

### Key features

- Standards-based OIDC authorization-code + PKCE with popup or redirect flows.
- Risk-Based Authentication transaction management with challenge/submit/poll/cancel lifecycle.
- Convenience authentication methods for passkeys (WebAuthn), password, OTP, soft token, magic link, face, smart credential, grid, KBA, and temporary access codes.

# Create a Free Trial Account

Entrust Identity as a Service (IDaaS) is a cloud-based identity and access management (IAM) solution with multi-factor authentication (MFA), credential-based passwordless access, and single sign-on (SSO).

Get started with a [free trial](https://in.entrust.com/IDaaS/) account today.

## Configure Your IDaaS Application

1. After logging in as an administrator, navigate to the applications page.
2. Click the plus sign in the top left to create a new application.
3. Scroll down and select `Generic SPA Application`.
4. On the `Setup` page, check the `Authorization Code` grant type. This SDK supports only the authorization code flow with PKCE.
5. If you intend to use refresh tokens, check the `Refresh Token (OIDC)` grant type. Failing to do so will cause errors if you attempt to use refresh tokens.
6. Add all URIs that you may redirect to after a successful login or logout. Failing to do so will cause errors if you attempt to redirect to a different URI.
7. Make any other changes necessary for your application, then submit your changes.

**Make note of your application's `Client ID` and `Issuer URL` (typically `https://{yourIdaasDomain}.region.trustedauth.com/api/oidc`). These will be required to configure the SDK.**

## Content Security Policy (CSP)

The IDaaS Auth SDK will send API requests to your IDaaS tenant. You will need to ensure the Content Security Policy of your web application is updated to include your IDaaS tenant hostname as an allowed connection source. For more information regarding CSP, see the MDN [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) documentation.

The following must be set in your Content Security Policy for the SDK to work. Replace entrust.us.trustedauth.com with your IDaaS tenant hostname.

`connect-src entrust.us.trustedauth.com`

---

## Installation

```bash
npm install @entrustcorp/idaas-auth-js
```

Optional dependency for face biometrics:

```bash
npm install onfido-sdk-ui
```

---

## Quickstart

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://example.us.trustedauth.com/api/oidc",
  clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  storageType: "localstorage"
});

// Popup flow (auto stores tokens)
await idaas.oidc.login({ popup: true });

// Use tokens
const accessToken = await idaas.getAccessToken();
```

See the [Quickstart guide](docs/quickstart.md) for configuration options, redirect flows, error handling, and self-hosted examples.

---

## Documentation

### Guides

- [Overview](docs/index.md)
- [Quickstart](docs/quickstart.md)
- [Choosing an Authentication Approach](docs/guides/choosing-an-approach.md)
- [OIDC Guide](docs/guides/oidc.md)
- [RBA Guide](docs/guides/rba.md)
- [Convenience Auth Guide](docs/guides/auth.md)
- [JWT IDaaS Grant Type](docs/guides/jwt-idaas-grant.md)
- [Self-Hosted UI Examples](docs/self-hosted.md)
- [Troubleshooting](docs/troubleshooting.md)

### API Reference

- [Complete API Documentation](docs/api/README.md) - Auto-generated from TypeScript source code
  - [IdaasClient](docs/api/IdaasClient/classes/IdaasClient.md) - Main client class
  - [OidcClient](docs/api/OidcClient/classes/OidcClient.md) - Hosted authentication methods
  - [RbaClient](docs/api/RbaClient/classes/RbaClient.md) - Risk-based authentication methods
  - [AuthClient](docs/api/AuthClient/classes/AuthClient.md) - Convenience authentication methods
- [Manual Reference](docs/reference/idaas-client.md) - Hand-crafted reference guide

---

## License

See [LICENSE](LICENSE) for details.
