[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / DPoPOptions

# Interface: DPoPOptions

DPoP (Demonstration of Proof-of-Possession) options.

## Properties

### alg

> **alg**: `"ES256"` \| `"ES384"` \| `"ES512"` \| `"PS256"` \| `"PS384"` \| `"PS512"` \| `"RS256"` \| `"RS384"` \| `"RS512"`

Signing algorithm used for DPoP proof JWTs.

---

### includeJkt?

> `optional` **includeJkt?**: `boolean`

When `true`, includes `dpop_jkt` in authorization requests.

#### Default

```ts
false;
```
