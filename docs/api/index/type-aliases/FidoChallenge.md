[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / FidoChallenge

# Type Alias: FidoChallenge

> **FidoChallenge** = `object`

If the authentication challenge is of type FIDO, the FIDOChallenge will contain the FIDO challenge parameters that must be passed to the FIDO token to complete authentication.

## Properties

### allowCredentials?

> `optional` **allowCredentials**: `string`[]

The list of IDs of the FIDO tokens registered for the user. Each value is base-64 encoded.

---

### challenge

> **challenge**: `string`

A random challenge. It is a base-64 encoded value.

---

### ~~timeout~~

> **timeout**: `number`

The number of seconds that the client will wait for the FIDO token to respond. This field is deprecated, use 'timeoutMillis' instead.

#### Deprecated

---

### timeoutMillis

> **timeoutMillis**: `number`

The number of milliseconds that the client will wait for the FIDO token to respond.
