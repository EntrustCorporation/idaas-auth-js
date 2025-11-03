# OIDC Guide

## Login flow

```typescript
await idaas.oidc.login({
  popup: true,
  scope: "openid profile email",
});
```

### Redirect flow

```typescript
if (isRedirectCallback(window.location.href)) {
  await idaas.oidc.handleRedirect();
}
```

## Logout

```typescript
await idaas.oidc.logout({
  redirectUri: "https://app.example.com/post-logout",
});
```

### Token access

```typescript
const token = await idaas.getAccessToken();
const user = idaas.getIdTokenClaims();
```