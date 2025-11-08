[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / OidcLoginOptions

# Interface: OidcLoginOptions

The configurable options specific to the OIDC `login` method.

## Properties

### popup?

> `optional` **popup**: `boolean`

Determines the method of login that will be used to authenticate the user.
The default setting is `false`.

---

### redirectUri?

> `optional` **redirectUri**: `string`

The URI to be redirected to after a successful login. The default value is the current page.
This URI must be included in the `Login Redirect URI(s)` field in your IDaaS client application settings.
