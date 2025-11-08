[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / SoftTokenOptions

# Interface: SoftTokenOptions

The configurable options when requesting a TOKEN/TOKENPUSH authentication challenge.

## Extends

- [`SoftTokenPushOptions`](SoftTokenPushOptions.md)

## Properties

### mutualChallenge?

> `optional` **mutualChallenge**: `boolean`

Determines if the user must answer a mutual challenge for the TOKENPUSH authenticator.

#### Inherited from

[`SoftTokenPushOptions`](SoftTokenPushOptions.md).[`mutualChallenge`](SoftTokenPushOptions.md#mutualchallenge)

---

### push?

> `optional` **push**: `boolean`

Determines if push authentication (true) or standard token authentication (false) should be used. Default false.
