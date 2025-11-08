[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / AuthenticationSubmissionParams

# Interface: AuthenticationSubmissionParams

The configurable options when submitting a response to an authentication challenge.

## Properties

### kbaChallengeAnswers?

> `optional` **kbaChallengeAnswers**: `string`[]

The user's answers to the KBA challenge questions.
Answers must be in the order of the questions returned when requesting the challenge.

---

### passkeyResponse?

> `optional` **passkeyResponse**: `PublicKeyCredential`

The credential returned from navigator.credentials.get(credentialRequestOptions).

---

### response?

> `optional` **response**: `string`

The user's response to the authentication challenge.
