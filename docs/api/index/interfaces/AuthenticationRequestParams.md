[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / AuthenticationRequestParams

# Interface: AuthenticationRequestParams

The configurable options when requesting an authentication challenge.

## Properties

### faceBiometricOptions?

> `optional` **faceBiometricOptions**: [`FaceBiometricOptions`](FaceBiometricOptions.md)

Options available during FACE authentication.

---

### otpOptions?

> `optional` **otpOptions**: [`OtpOptions`](OtpOptions.md)

Options available during OTP authentication.

---

### password?

> `optional` **password**: `string`

The user's password to submit for MFA flows.

---

### preferredAuthenticationMethod?

> `optional` **preferredAuthenticationMethod**: [`IdaasAuthenticationMethod`](../type-aliases/IdaasAuthenticationMethod.md)

The preferred method of authentication.

---

### smartCredentialOptions?

> `optional` **smartCredentialOptions**: [`SmartCredentialOptions`](SmartCredentialOptions.md)

Options available during SMARTCREDENTIALPUSH authentication.

---

### softTokenPushOptions?

> `optional` **softTokenPushOptions**: [`SoftTokenPushOptions`](SoftTokenPushOptions.md)

Options available during TOKENPUSH authentication.

---

### strict?

> `optional` **strict**: `boolean`

Determines if the preferred authentication method must be used.

---

### transactionDetails?

> `optional` **transactionDetails**: [`TransactionDetail`](../type-aliases/TransactionDetail.md)[]

The transaction details of the request.

---

### userId?

> `optional` **userId**: `string`

The user ID of the user to request the challenge for.
