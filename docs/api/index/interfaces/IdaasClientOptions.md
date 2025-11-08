[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / IdaasClientOptions

# Interface: IdaasClientOptions

The configurable options of the IdaasClient.

## Properties

### clientId

> **clientId**: `string`

The Client ID found on your IDaaS Application settings page.

---

### issuerUrl

> **issuerUrl**: `string`

The issuer to be used for validation of JWTs and for fetching API endpoints, typically `https://{yourIdaasDomain}.region.trustedauth.com/api/oidc`.

---

### storageType?

> `optional` **storageType**: `"memory"` \| `"localstorage"`

The storage mechanism to use for ID and access tokens.

#### Default

```ts
"memory";
```
