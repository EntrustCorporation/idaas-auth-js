# IDaaS Auth JS

## Overview

IDaaS Auth JS is the official JavaScript/TypeScript SDK for Entrust Identity-as-a-Service. It wraps hosted OIDC flows, risk-based authentication (RBA) challenges, and “convenience” methods (password, OTP, passkey, soft token, etc.) in a client.

### Key features

- Standards-based OIDC authorization-code + PKCE with popup or redirect flows.
- Risk-Based Authentication transaction management with challenge/submit/poll/cancel lifecycle.
- Convenience authentication methods for passkeys (WebAuthn), password, OTP, soft token, magic link, face, smart credential, grid, KBA, and temporary access codes.

---

## Installation

```bash
npm install idaas-auth-js
```

Optional dependency for face biometrics:

```bash
npm install onfido-sdk-ui
```

---

## Quickstart

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com",
  clientId: "my-app-client-id",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  storageType: "localstorage",
});

// Popup flow (auto stores tokens)
await idaas.oidc.login({ popup: true });

// Use tokens
const accessToken = await idaas.getAccessToken();
const user = idaas.getIdTokenClaims();
```

---

## Core concepts

### IdaasClient

- Central entry point exposing three facades:
  - `oidc` – hosted OpenID Connect login/logout/redirect handlers.
  - `rba` – self-hosted risk-based authentication transactions.
  - `auth` – “convenience” methods for authenticating (password, OTP, passkey, etc.).
- Created with issuer URL, client ID, and optional global defaults (`scope`, `audience`, `useRefreshToken`, storage type).

### Authentication lifecycle

1. Request or trigger a challenge (`oidc.login`, `rba.requestChallenge`, `auth.authenticateX`).
2. Submit credentials or poll for completion (`submit`, `poll`).
3. Tokens saved on success; `getAccessToken` returns matching tokens or refreshes them.

---

## Usage guides

### OIDC login

```typescript
// Popup
await idaas.oidc.login({
  popup: true,
  scope: "openid profile email",
  audience: "https://api.example.com",
});

// Redirect
await idaas.oidc.login({
  popup: false,
  redirectUri: "https://app.example.com/callback",
});
```

Handle redirects:

```typescript
// In your redirect/callback route
await idaas.oidc.handleRedirect();
```

Logout:

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout",
});
```

### Risk-Based Authentication (self-hosted)

```typescript
// Start challenge
const challenge = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "OTP",
});

// Submit response
await idaas.rba.submitChallenge({ response: "123456" });

// Poll for push-style challenges
const finalResult = await idaas.rba.poll();
```

### Convenience auth helpers

```typescript
// Password
await idaas.auth.authenticatePassword("user@example.com", "secret");

// Passkey (WebAuthn discoverable credentials)
await idaas.auth.authenticatePasskey();

// Soft token push with mutual challenge
await idaas.auth.authenticateSoftToken("user@example.com", {
  push: true,
  mutualChallenge: true,
});

// Magic link
await idaas.auth.authenticateMagiclink("user@example.com");
```

### Self-hosted UI snippet (face)

```typescript
await idaas.auth.authenticateFace("user@example.com", {
  mutualChallenge: true,
});
// Requires <div id="onfido-mount"></div> and onfido-sdk-ui installed.
```

---

## Documentation

Detailed Markdown guides live under [`/docs`](./docs):

- [Overview](docs/index.md)
- [Quickstart](docs/quickstart.md)
- [Core Concepts](docs/core-concepts.md)
- [OIDC Guide](docs/guides/oidc.md)
- [Risk-Based Authentication Guide](docs/guides/rba.md)
- [Convenience Auth Guide](docs/guides/auth.md)
- [Self-Hosted UI Examples](docs/self-hosted.md)
- [API Reference](docs/reference/idaas-client.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Popup blocked | Switch to redirect flow or allow popups for your domain. |
| `Requested token not found` | Ensure `getAccessToken` scopes/audience match or supply `fallbackAuthorizationOptions`. |
| `onfido-sdk-ui` import error | Install optional peer dependency before using `authenticateFace`. |
| Passkey errors | Confirm browser supports WebAuthn (`browserSupportsPasskey()` guard). |

---

## License

See [LICENSE](LICENSE) for details.