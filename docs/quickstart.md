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
# optional for face biometric authentication
npm install onfido-sdk-ui
```

## 2. Create an IdaasClient

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient(
  {
    issuerUrl: "https://example.trustedauth.com", // OIDC issuer from your tenant
    clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // Your application's client ID
    storageType: "localstorage" // "memory" | "localstorage"
  },
  {
    scope: "openid profile email", // defaults provided; override as needed
    audience: "https://api.example.com", // The resource you want the access token to grant access to
    useRefreshToken: true // request refresh tokens by default
  }
);
```

The client exposes three facades:

- `idaas.oidc` – hosted UI OIDC flows (popup/redirect/login/logout).
- `idaas.rba` – self-hosted UI risk-based authentication.
- `idaas.auth` – convenience authentication methods (password, passkey, OTP, etc.).

### Cross-Origin Resource Sharing (CORS)

CORS is a browser security feature that restricts web applications from making cross-origin HTTP requests via scripts. When your web application, hosted on one origin, attempts to access Entrust IDaaS APIs on a different origin, the browser will block these requests unless the server explicitly permits them. Since the `idaas.rba` and `idaas.auth` facades make direct authentication API calls, you must configure CORS allowlisting in your Entrust IDaaS tenant to authorize requests from your application's origin.

## 3. Trigger a hosted login flow

### Popup flow

```typescript
try {
  await idaas.oidc.login({ popup: true });
} catch (error) {
  console.error("Login failed", error);
}
```

To override token defaults per-call, pass a second parameter:

```typescript
await idaas.oidc.login(
  { popup: true },
  {
    scope: "openid profile email offline_access",
    audience: "https://different-api.example.com"
  }
);
```

### Redirect flow

```typescript
// Begin the flow
await idaas.oidc.login({
  popup: false,
  redirectUri: "https://app.example.com/callback"
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
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

## 5. Sign the user out

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout"
});
```

## Next steps

- Explore the [OIDC Guide](guides/oidc.md) for more information on the OIDC methods.
- Visit the [Risk-Based Authentication Guide](guides/rba.md) for advanced flows.
- See the [Convenience](guides/auth.md) one off authentication methods.
- Browse the [API Reference](api/README.md) for complete method signatures.
