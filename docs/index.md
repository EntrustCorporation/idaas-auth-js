# IDaaS Auth JS Overview

IDaaS Auth JS is a TypeScript-first SDK that streamlines authentication against Entrust Identity-as-a-Service (IDaaS). It unifies hosted OpenID Connect (OIDC) flows, risk-based authentication (RBA) transactions, and convenience auth helpers under one client.

## Why use this SDK?

- **Unified API surface** – manage OIDC, RBA, and convenience auth via a single `IdaasClient`.
- **Type-safe primitives** – all public methods ship with TypeScript definitions and IntelliSense-friendly documentation.
- **Self-hosted or hosted UI** – mix popup/redirect OIDC screens with self-hosted RBA UI in the same app.

## High-level architecture

```
IdaasClient
 ├─ OidcClient  → Hosted login/logout, redirect handling, token exchange
 ├─ RbaClient   → Self-hosted challenge/request/poll flows
 └─ AuthClient  → Password, OTP, passkey, soft token, magic link, face helpers
     ▲
     │  uses
IdaasContext → shared issuer/client configuration + cached OIDC metadata
```

## Core workflow

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://tenant.example.com",
  clientId: "spa-client",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  storageType: "local",
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

| Scenario | Recommended client | Notes |
| --- | --- | --- |
| Hosted login with IDaaS screens | `oidc` | Handles PKCE, redirect parsing, logout. |
| Build your own challenge UI | `rba` | Request challenges, submit responses, poll asynchronous flows. |
| Quick helpers (password, OTP, passkey, face) | `auth` | Thin wrappers over `rba` with sensible defaults. |

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