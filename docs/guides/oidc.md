# OIDC Guide

This guide walks through using the hosted OpenID Connect (OIDC) experience provided by Entrust IDaaS via the `IdaasClient.oidc` facade.

## Prerequisites

- Your Entrust tenant’s issuer URL (e.g., `https://example.trustedauth.com`).
- A SPA Application client ID with redirect URIs configured created in the IDaaS tenant.
- HTTPS origin in production (OIDC requires secure contexts for PKCE and WebAuthn).

## Initialization

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient(
  {
    issuerUrl: "https://example.trustedauth.com",
    clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    storageType: "localstorage"
  },
  {
    scope: "openid profile email",
    audience: "https://api.example.com",
    useRefreshToken: true
  }
);
```

## Login

### Login Options

See the [OidcLoginOptions reference](../reference/idaas-client.md#oidcloginoptions) for complete details.

### Token Options

See the [TokenOptions reference](../reference/idaas-client.md#tokenoptions) for complete details on all available options and their defaults.

### Popup (recommended for SPAs)

```typescript
await idaas.oidc.login(
  { popup: true },
  {
    scope: "openid profile email",
    audience: "https://api.example.com",
    maxAge: 900
  }
);
```

- Opens Entrust’s hosted UI in a centered popup.
- Exchanges the authorization code transparently and stores tokens.
- Fails if the browser blocks popups—catch errors and prompt users to allow them.

### Redirect

```typescript
await idaas.oidc.login({
  popup: false,
  redirectUri: "https://app.example.com/callback"
});
```

- Navigates the browser to the hosted login page.
- Requires handling the callback at the configured `redirectUri`.

#### Handling the callback

Ensure the page that users are redirected to after signing in on the IDaaS page makes a call to `handleRedirect` to complete the login ceremony.

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
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

- `getAccessToken(options?)` gets the locally stored access token, or issues a refresh-token grant if needed (when refresh tokens are enabled).
- `getIdTokenClaims()` returns decoded claims or `null` if no ID token is stored.
- `isAuthenticated()` returns `true` when valid tokens are cached.

## Logout

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout"
});
```

- Calls the IDaaS end-session endpoint and clears stored credentials.
- `redirectUri` must be registered with the tenant.
- If no `redirectUri` is provided users will be redirected to the issuer URL's sign in page.

## Error handling

Wrap calls in `try/catch` to surface browser or IDaaS errors:

```typescript
try {
  await idaas.oidc.login({ popup: true });
} catch (error) {
  console.error("OIDC login failed", error);
}
```

Common issues:

- **Popup blocked** – use redirect flow or instruct users to allow popups.
- **`invalid_redirect_uri`** – confirm the URI matches the OIDC application configuration.

## Testing tip

- When testing redirect flows locally, be sure to add localhost with the port number in the login redirect URIs of OIDC Application.

## Related docs

- [Quickstart](../quickstart.md)
- [API Reference](../reference/idaas-client.md)
- [Troubleshooting](../troubleshooting.md)
