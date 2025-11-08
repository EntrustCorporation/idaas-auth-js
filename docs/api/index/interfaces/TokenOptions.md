[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / TokenOptions

# Interface: TokenOptions

The configurable options for the `login` and `requestChallenge` methods.

## Properties

### acrValues?

> `optional` **acrValues**: `string`[]

Determines the strength/quality of the method used to authenticate the user.

---

### audience?

> `optional` **audience**: `string`

The audience to be used for requesting API access. This defaults to the `globalAudience` set in your `IdaasClientOptions` if not set.
Per OIDC spec, this parameter is optional and will be omitted from the authorization request if not provided.

---

### maxAge?

> `optional` **maxAge**: `number`

Specifies the maximum age of a token in seconds.
When tokens are refreshed using a refresh token, the original authentication time is preserved and this maxAge value continues to apply to that original authentication timestamp, not the refresh time.

---

### scope?

> `optional` **scope**: `string`

The scope to be used on this authentication request.

This defaults to the `globalScope` in your `IdaasClientOptions` if not set. If you are setting extra scopes and require `profile` and `email` to be included then you must include them in the provided scope.

Note: The `openid` scope is always applied regardless of this setting.

---

### useRefreshToken?

> `optional` **useRefreshToken**: `boolean`

Determines whether the token obtained from this login request can use refresh tokens. This defaults to the `useRefreshToken` set in your `IdaasClientOptions` if not set.

Note: Use of refresh tokens must be enabled on your IDaaS client application.
