# Quickstart

Follow these steps to authenticate a user with IDaaS Auth JS.

## 1. Install

```bash
npm install idaas-auth-js
```

## 2. Configure the client

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://tenant.example.com",
  clientId: "my-app-client-id",
  globalScope: "openid profile email",
});
```

## 3. Log in via popup

```typescript
await idaas.oidc.login({ popup: true });
const accessToken = await idaas.getAccessToken();
```

Need redirect flows? See the [OIDC guide](guides/oidc.md).