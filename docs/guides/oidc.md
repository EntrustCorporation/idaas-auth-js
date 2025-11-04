# OIDC Guide

This guide walks through using the hosted OpenID Connect (OIDC) experience provided by Entrust IDaaS via the `IdaasClient.oidc` facade.

## Prerequisites

- Your Entrust tenant’s issuer URL (e.g., `https://example.trustedauth.com`).
- A registered application client ID with redirect URIs configured.
- HTTPS origin in production (OIDC requires secure contexts for PKCE and WebAuthn).

## Initialization

```typescript
import { IdaasClient } from "@entrust/idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com",
  clientId: "spa-client",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  storageType: "localstorage",
  globalUseRefreshToken: true,
});
```

`globalScope`, `globalAudience`, and `globalUseRefreshToken` act as defaults when you don’t pass overrides to `login`. 
If not provided scope will default to `"openid profile email"`. 

## Login flows

### Popup (recommended for SPAs)

```typescript
await idaas.oidc.login({
  popup: true,
  scope: "openid profile email",
  audience: "https://api.example.com",
  maxAge: 900,
});
```

- Opens Entrust’s hosted UI in a centered popup.
- Exchanges the authorization code transparently and stores tokens.
- Fails if the browser blocks popups—catch errors and prompt users to allow them.

### Redirect

```typescript
await idaas.oidc.login({
  popup: false,
  redirectUri: "https://app.example.com/callback",
});
```

- Navigates the browser to the hosted login page.
- Requires handling the callback at the configured `redirectUri`.

#### Handling the callback

```typescript
// callback.ts
await idaas.oidc.handleRedirect();
```

`handleRedirect` verifies state/PKCE, exchanges the authorization code, and persists tokens.

## Token usage

```typescript
const accessToken = await idaas.getAccessToken();
const idTokenClaims = idaas.getIdTokenClaims();

await fetch("https://api.example.com/me", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

- `getAccessToken(options?)` issues a refresh-token grant if needed (when refresh tokens are enabled).
- `getIdTokenClaims()` returns decoded claims or `null` if no ID token is stored.
- `isAuthenticated()` returns `true` when valid tokens are cached.

## Logout

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout",
});
```

- Calls the IDaaS end-session endpoint and clears stored credentials.
- `redirectUri` must be registered with the tenant.
- If no `redirectUri` is provided users will be redirected to the issuer URL's sign in page.

## Configuration options

| Option            | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `scope`           | Space-delimited scopes; defaults to `globalScope` or `openid profile email` if no `globalScope` was set. |
| `audience`        | Overrides `globalAudience` for API tokens.                                                               |
| `maxAge`          | Forces reauthentication if the session age exceeds the value (seconds).                                  |
| `acrValues`       | Array or space-delimited string of Authentication Context Class References (ACR) to request.             |
| `useRefreshToken` | Request a refresh token during the authorization-code exchange.                                          |

## Error handling

Wrap calls in `try/catch` to surface browser or IDaaS errors:

```typescript
try {
  await idaas.oidc.login({ popup: true });
} catch (error) {
  if (error instanceof Error) {
    console.error("OIDC login failed:", error.message);
  }
}
```

Common issues:

- **Popup blocked** – use redirect flow or instruct users to allow popups.
- **`invalid_redirect_uri`** – confirm the URI matches the tenant configuration.
- **Network/timeout errors** – inspect `error.cause` for underlying fetch failures.

## Testing tip

- When QA-ing redirect flows locally, use `http://localhost` domains registered in the tenant.

## Related docs

- [Quickstart](../quickstart.md)
- [Core Concepts](../core-concepts.md)
- [API Reference](../reference/idaas-client.md)
- [Troubleshooting](../troubleshooting.md)