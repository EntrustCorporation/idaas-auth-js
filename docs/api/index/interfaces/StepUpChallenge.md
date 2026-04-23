[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / StepUpChallenge

# Interface: StepUpChallenge

Parsed step-up authentication challenge from a WWW-Authenticate header.

Per RFC 9470 (OAuth 2.0 Step-Up Authentication Challenge Protocol), a resource server
returns this challenge when the current access token does not meet the authentication
requirements for the requested resource.

## Properties

### acrValues?

> `optional` **acrValues?**: `string`[]

Authentication context class references required, parsed from `acr_values`.

---

### errorDescription?

> `optional` **errorDescription?**: `string`

Human-readable error description, parsed from `error_description`.

---

### maxAge?

> `optional` **maxAge?**: `number`

Maximum acceptable authentication age in seconds, parsed from `max_age`.

---

### scope?

> `optional` **scope?**: `string`

Required scopes, parsed from `scope`.
