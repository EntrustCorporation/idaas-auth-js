# Quickstart

Get up and running with IDaaS Auth JS in minutes by installing the SDK, wiring a minimal `IdaasClient`, and driving a hosted OIDC login flow.

## Prerequisites

- Node.js 22+.
- An Entrust IDaaS tenant with:
  - A Generic SPA Application.
  - A Redirect URI configured in the Generic SPA Application if you use the redirect flow.

## 1. Install the SDK

```bash
npm install @entrustcorp/idaas-auth-js
# optional for face authentication
npm install onfido-sdk-ui
```

## 2. Create an IdaasClient

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com", // OIDC issuer from your tenant
  clientId: "my-app-client-id",
  globalScope: "openid profile email",     // defaults provided; override as needed
  globalAudience: "https://api.example.com",
  storageType: "localstorage",                    // "memory" | "localstorage"
  globalUseRefreshToken: true,             // request refresh tokens by default
});
```

The client exposes three facades:

- `idaas.oidc` – hosted OIDC flows (popup/redirect/login/logout).
- `idaas.rba` – self-hosted risk-based authentication.
- `idaas.auth` – convenience authentication methods (password, passkey, OTP, etc.).

## 3. Trigger a hosted login flow

### Popup flow

```typescript
try {
  await idaas.oidc.login({
    popup: true,
    scope: "openid profile email",
    audience: "https://api.example.com",
  });
} catch (error) {
  // Handle popup blockers, network errors, or IDaaS API errors
  console.error("Login failed", error);
}
```

### Redirect flow

```typescript
// Begin the flow
await idaas.oidc.login({
  popup: false,
  redirectUri: "https://app.example.com/callback",
});

// Later, in your callback route
if (location.pathname === "/callback") {
  await idaas.oidc.handleRedirect();
}
```

## 4. Use the tokens

```typescript
const accessToken = await idaas.getAccessToken();
const idTokenClaims = idaas.getIdTokenClaims();

// Example: call your API
await fetch("https://api.example.com/me", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

## 5. Optional: Self-hosted challenge flows

```typescript
const challenge = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "OTP",
});

await idaas.rba.submitChallenge({ response: "123456" });
```

## 6. Sign the user out

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout",
});
```

## Next steps

- Dive deeper into [Core Concepts](core-concepts.md) to understand configuration and storage.
- Explore the [OIDC Guide](guides/oidc.md) and [Risk-Based Authentication Guide](guides/rba.md) for advanced flows.
- Browse the [API Reference](reference/idaas-client.md) for complete method signatures.