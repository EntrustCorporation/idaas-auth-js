[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / IdaasClientOptions

# Interface: IdaasClientOptions

The configurable options of the IdaasClient.

## Properties

### allowedIdTokenSigningAlgorithms?

> `optional` **allowedIdTokenSigningAlgorithms?**: `string`[]

The allowed algorithms for validating ID token signatures.

Defaults to: `PS256 PS384 PS512 RS256 RS384 RS512 EC256 ES384 ES512`.

Provide this to restrict validation to a specific subset.

---

### clientId

> **clientId**: `string`

The Client ID found on your IDaaS Application settings page.

---

### issuerUrl

> **issuerUrl**: `string`

The issuer to be used for validation of JWTs and for fetching API endpoints, typically `https://{yourIdaasDomain}.region.trustedauth.com/api/oidc`.

---

### storageType?

> `optional` **storageType?**: `"memory"` \| `"localstorage"`

The storage mechanism to use for ID and access tokens.

#### Default

```ts
"memory";
```
