# AWS API Gateway Integration (Built-In JWT Authorizer)

This guide explains how to protect AWS API Gateway endpoints using AWS's built-in JWT authorizer with Entrust IDaaS-issued access tokens.

This is the recommended approach for HTTP APIs when you want route-level scope enforcement without running a custom Lambda authorizer.

## What this guide covers

- Configure AWS HTTP API JWT authorizer with IDaaS issuer and audience.
- Require OAuth scopes per route (for example, `protected:read` and `protected:write`).
- Request matching tokens from the browser SPA using this SDK.
- Understand common responses when token audience or scopes do not match.

## Architecture

1. Your SPA signs users in with `IdaasClient.oidc.login(...)`.
2. The SPA requests an access token with the API audience and scopes.
3. The SPA calls API Gateway with `Authorization: Bearer <access_token>`.
4. API Gateway JWT authorizer validates issuer, audience, and token lifetime.
5. API Gateway checks `authorizationScopes` on protected routes.
6. API Gateway invokes your integration only when checks pass.

## Prerequisites

- Entrust IDaaS tenant and OIDC client application for your SPA.
- A resource server audience for your API (example: `https://api.example.com`).
- Resource server scopes defined in IDaaS (example: `protected:read`, `protected:write`).
- AWS API Gateway HTTP API (v2).

## 1. Configure your IDaaS token shape

For AWS built-in JWT authorizers, make sure your access token has:

- `iss`: your tenant issuer URL (for example, `https://tenant.region.trustedauth.com/api/oidc`).
- `aud`: your API audience (for example, `https://api.example.com`).
- `scope` claim containing space-separated scopes.

In the SDK, request tokens with matching audience and scopes:

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient(
  {
    issuerUrl: "https://tenant.region.trustedauth.com/api/oidc",
    clientId: "your-spa-client-id",
    storageType: "localstorage"
  },
  {
    audience: "https://api.example.com",
    scope: "openid profile email protected:read"
  }
);

await idaas.oidc.login({ popup: true });
const accessToken = await idaas.getAccessToken();
```

## 2. Configure API Gateway HTTP API JWT authorizer (CDK)

Use `HttpJwtAuthorizer` with your IDaaS issuer and audience:

```typescript
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

const api = new apigwv2.HttpApi(this, "api", {
  apiName: "my-api"
});

const jwtAuthorizer = new HttpJwtAuthorizer(
  "jwtAuthorizer",
  "https://tenant.region.trustedauth.com/api/oidc",
  {
    jwtAudience: ["https://api.example.com"],
    authorizerName: "jwtAuthorizer"
  }
);

api.addRoutes({
  path: "/api/protected/read",
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration("readIntegration", readFn),
  authorizer: jwtAuthorizer,
  authorizationScopes: ["protected:read"]
});

api.addRoutes({
  path: "/api/protected/write",
  methods: [HttpMethod.POST],
  integration: new HttpLambdaIntegration("writeIntegration", writeFn),
  authorizer: jwtAuthorizer,
  authorizationScopes: ["protected:write"]
});
```

### Route behavior

- If token signature, issuer, audience, or expiry is invalid: request is rejected before your Lambda runs.
- If token is valid but missing required scope: request is rejected with `403`.
- If route has no `authorizationScopes`, any valid token for the configured issuer/audience can access that route.

## 3. Call the API from your SPA

```typescript
const token = await idaas.getAccessToken({
  audience: "https://api.example.com",
  scope: "openid profile email protected:read"
});

const response = await fetch("https://api.example.com/api/protected/read", {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

if (!response.ok) {
  console.error("API request failed", response.status);
}
```

## 4. Handle missing scope errors in the SPA

When a route requires scopes your token does not have, API Gateway returns `403 Forbidden`.

Typical causes:

- Token was requested without the route's required scope.
- Token audience is correct, but the scope set is too narrow.

Recommended handling:

1. Request a token that includes the required scope.
2. Retry the API call with the new token.
3. If your app has separate read/write operations, request the minimum scope needed per operation.

Example:

- Read route requires `protected:read`
- Write route requires `protected:write`

On insufficient scope errors, API Gateway returns a `WWW-Authenticate` Bearer challenge with `insufficient_scope`.
Handle that response with `IdaasClient.parseResponse(response)`, then request and retry with a token that matches the challenged scope as described in the [Step-Up Authentication Guide](./step-up.md).

## Common pitfalls

- **Wrong issuer value**: use your OIDC issuer (typically ending in `/api/oidc`), not just the tenant origin.
- **Wrong audience**: API Gateway `jwtAudience` must match the token `aud` claim.
- **Missing scopes in token request**: route checks fail with `403` even though token is otherwise valid.
- **Using REST API JWT authorizer expectations**: built-in JWT authorizer is for HTTP API v2; REST API uses different auth patterns.

## Troubleshooting checklist

1. Decode an access token and confirm `iss`, `aud`, and `scope` values.
2. Confirm API Gateway authorizer issuer and audience exactly match token claims.
3. Confirm each protected route has expected `authorizationScopes`.
4. Confirm the SPA requests the same audience and scopes used by the route.
5. Verify `Authorization` header format is `Bearer <token>`.

## Related guides

- [OIDC Guide](./oidc.md)
- [Step-Up Authentication Guide](./step-up.md) (for `WWW-Authenticate` `insufficient_scope` challenge handling)
- [Security Best Practices](./security-best-practices.md)
