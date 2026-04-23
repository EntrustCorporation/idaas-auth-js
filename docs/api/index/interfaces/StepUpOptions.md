[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / StepUpOptions

# Interface: StepUpOptions

Options for the `stepUp` method, allowing additional authentication request parameters
to be passed through to `requestChallenge` beyond what is parsed from the WWW-Authenticate header.

## Properties

### preferredAuthenticationMethod?

> `optional` **preferredAuthenticationMethod?**: [`IdaasAuthenticationMethod`](../type-aliases/IdaasAuthenticationMethod.md)

The preferred method of authentication for the step-up challenge.

---

### strict?

> `optional` **strict?**: `boolean`

Determines if the preferred authentication method must be used.

---

### transactionDetails?

> `optional` **transactionDetails?**: [`TransactionDetail`](../type-aliases/TransactionDetail.md)[]

The transaction details to include in the step-up challenge request for risk evaluation.
