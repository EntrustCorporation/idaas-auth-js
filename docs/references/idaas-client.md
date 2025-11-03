# API Reference: IdaasClient

## Constructor

```typescript
new IdaasClient({
  issuerUrl,
  clientId,
  globalAudience,
  globalScope,
  globalUseRefreshToken,
  storageType,
});
```

## Properties

- `oidc`: [`OidcClient`](../guides/oidc.md)
- `rba`: [`RbaClient`](../guides/rba.md)
- `auth`: [`AuthClient`](../guides/auth.md)

## Methods

### isAuthenticated()

Returns `true` if valid tokens are stored.

### getAccessToken(options?)

Fetches cached or refreshed access token.

### getIdTokenClaims()

Returns decoded ID token claims or `null`.