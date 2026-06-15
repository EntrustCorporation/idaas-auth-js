[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / TokenOptions

# Interface: TokenOptions

The configurable options for the `login` and `requestChallenge` methods.

## Properties

### acrValues?

> `optional` **acrValues?**: `string`

Space-delimited ACR values used to determine the strength/quality of the method used to authenticate the user.
Example: `"knowledge possession"`

---

### audience?

> `optional` **audience?**: `string`

The audience to be used for requesting API access. This defaults to the `globalAudience` set in your `IdaasClientOptions` if not set.
Per OIDC spec, this parameter is optional and will be omitted from the authorization request if not provided.

---

### dpop?

> `optional` **dpop?**: [`DPoPOptions`](DPoPOptions.md)

DPoP (Demonstration of Proof-of-Possession) configuration.

Omit this field to disable DPoP.
Provide an object to enable DPoP.

---

### includeOpenidScope?

> `optional` **includeOpenidScope?**: `boolean`

Controls whether the `openid` scope is automatically added to the authorization request.

When `true` (default), the `openid` scope is added and the flow expects an ID token. When `false`, the SDK omits
automatic `openid` appending and does not require an ID token.

#### Default

```ts
true;
```

---

### maxAge?

> `optional` **maxAge?**: `number`

Specifies the maximum age of a token in seconds.
When tokens are refreshed using a refresh token, the original authentication time is preserved and this maxAge value continues to apply to that original authentication timestamp, not the refresh time.

---

### scope?

> `optional` **scope?**: `string`

The scope to be used on this authentication request.

This defaults to the `globalScope` in your `IdaasClientOptions` if not set. If you are setting extra scopes and require `profile` and `email` to be included then you must include them in the provided scope.

Note: By default, the `openid` scope is automatically included so you receive an ID token. Only set `includeOpenidScope` to `false` if you want to omit the `openid` scope and perform OAuth authorization without an ID token.

---

### useRefreshToken?

> `optional` **useRefreshToken?**: `boolean`

Determines whether the token obtained from this login request can use refresh tokens. This defaults to the `useRefreshToken` set in your `IdaasClientOptions` if not set.

Note: Use of refresh tokens must be enabled on your IDaaS client application.
