# IDaaS Auth JS Documentation

Welcome to the IDaaS Auth JavaScript SDK documentation.

## What you'll find

- [Quickstart](quickstart.md) for installing and authenticating.
- [Core Concepts](core-concepts.md) explaining tokens, storage, and configuration.
- Guides for [OIDC](guides/oidc.md), [RBA](guides/rba.md), and [Convenience Auth](guides/auth.md).
- [API Reference](reference/idaas-client.md) detailing public classes and methods.
- [Troubleshooting](troubleshooting.md) tips and known issues.

## Installation

```bash
npm install idaas-auth-js
```

## At a glance

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://tenant.example.com",
  clientId: "my-app",
});

await idaas.oidc.login({ popup: true });
```