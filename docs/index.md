# IDaaS Auth JS Overview

IDaaS Auth JS is a TypeScript-first SDK that streamlines authentication against Entrust Identity as a Service (IDaaS). It unifies hosted OpenID Connect (OIDC) flows, risk-based authentication (RBA) transactions, and convenience auth helpers under one client.

## Why use this SDK?

- **Unified API surface** – manage OIDC, RBA, and convenience auth via a single `IdaasClient`.
- **Type-safe primitives** – all public methods ship with TypeScript definitions and IntelliSense-friendly documentation.
- **Hosted or self-hosted flexibility** – let IDaaS render the entire login UI via OIDC, or craft your own screens using RBA and auth helpers.

## High-level architecture

```
IdaasClient
 ├─ OidcClient  → Hosted login/logout, redirect handling, token exchange.
 ├─ RbaClient   → Self-hosted challenge/request/poll flows.
 └─ AuthClient  → Password, OTP, passkey, soft token, magic link, face helpers.
```

## Core workflow

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com",
  clientId: "spa-client",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  storageType: "localstorage",
});

// Hosted IDaaS popup
await idaas.oidc.login({ popup: true });

// Tokens become available across the app
const accessToken = await idaas.getAccessToken();
const idTokenClaims = idaas.getIdTokenClaims();

// Check authentication status
const isAuthenticated = idaas.isAuthenticated();
```

### When to use which client

Use oidc when you want Entrust to host the whole login: it handles PKCE, redirects, and logout for a quick hosted experience. Choose rba when you are building the UI yourself and need full control over multi-factor, and risk-based challenges. Reach for the auth helpers when you still own the UI but just need streamlined entry points for a specific factor (password, OTP, passkey, face) without wiring every RBA call manually.

| Scenario                                     | Recommended client | Notes                                                          |
| -------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| Hosted login with IDaaS screens              | `oidc`             | Handles PKCE, redirect parsing, logout.                        |
| Build your own UI                            | `rba`              | Request challenges, submit responses, poll asynchronous flows. |
| Quick helpers (password, OTP, passkey, face) | `auth`             | Thin wrappers over `rba` with sensible defaults.               |

## Token handling

- Access/refresh/ID tokens persist through `StorageManager`.
- `globalUseRefreshToken` enables refresh token requests by default.
- `getAccessToken()` refreshes automatically when a refresh token exists.
- Call `logout()` to wipe cached credentials.

## Next steps

- Start building with the [Quickstart](quickstart.md).
- Deep-dive into [Core Concepts](core-concepts.md) for storage and lifecycle details.
- Follow guides for specific flows:
  - [OIDC Guide](guides/oidc.md)
  - [Risk-Based Authentication Guide](guides/rba.md)
  - [Convenience Auth Guide](guides/auth.md)
- Reference generated types in the [API Reference](reference/idaas-client.md).
- Check [Troubleshooting](troubleshooting.md) for common issues.

Need a self-hosted example? Jump to [Self-Hosted UI Examples](self-hosted.md).