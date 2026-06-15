[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / DpopHeadersOptions

# Interface: DpopHeadersOptions

Options for creating DPoP Authorization headers for a protected resource request.

## Properties

### accessToken?

> `optional` **accessToken?**: `string`

Optional access token to use. If omitted, the SDK retrieves one using `tokenOptions`.

---

### method

> **method**: `string`

HTTP method that will be used for the protected resource request.

---

### tokenOptions?

> `optional` **tokenOptions?**: [`TokenOptions`](TokenOptions.md)

Token lookup options used when `accessToken` is omitted.

---

### uri

> **uri**: `string`

Absolute HTTP or HTTPS URI that will be used for the protected resource request.
