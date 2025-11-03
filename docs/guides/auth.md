# Convenience Auth Guide

## Password

```typescript
await idaas.auth.authenticatePassword("user@example.com", "secret");
```

## Soft token

```typescript
await idaas.auth.authenticateSoftToken("user@example.com", {
  push: true,
  mutualChallenge: true,
});
```

## Grid

```typescript
await idaas.auth.authenticateGrid("user@example.com");
```