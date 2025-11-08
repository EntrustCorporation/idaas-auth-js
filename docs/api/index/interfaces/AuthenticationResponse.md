[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / AuthenticationResponse

# Interface: AuthenticationResponse

The response from IDaaS when requesting or submitting an authentication challenge.

## Properties

### authenticationCompleted?

> `optional` **authenticationCompleted**: `boolean`

A flag indicating if authentication has been completed.

---

### faceChallenge?

> `optional` **faceChallenge**: [`FaceChallenge`](../type-aliases/FaceChallenge.md)

Parameters required for completing the `FACE` authentication method.

---

### gridChallenge?

> `optional` **gridChallenge**: [`GridChallenge`](../type-aliases/GridChallenge.md)

Parameters required for completing the `GRID` authentication method.

---

### kbaChallenge?

> `optional` **kbaChallenge**: [`KbaChallenge`](../type-aliases/KbaChallenge.md)

Parameters required for completing the `KBA` authentication method.

---

### method?

> `optional` **method**: [`IdaasAuthenticationMethod`](../type-aliases/IdaasAuthenticationMethod.md)

The method of authentication that will be used.

---

### passkeyChallenge?

> `optional` **passkeyChallenge**: `PublicKeyCredentialRequestOptions`

The PublicKeyCredentialRequestOptions to be passed in the publicKey field to the navigator.credential.get() call.

---

### pollForCompletion?

> `optional` **pollForCompletion**: `boolean`

A flag indicating if `poll` should be called.

---

### pushMutualChallenge?

> `optional` **pushMutualChallenge**: `string`

Push authentication mutual challenge for token or Face Biometric.

---

### secondFactorMethod?

> `optional` **secondFactorMethod**: [`IdaasAuthenticationMethod`](../type-aliases/IdaasAuthenticationMethod.md)

The second factor authenticator that will be used.

---

### tempAccessCodeChallenge?

> `optional` **tempAccessCodeChallenge**: [`TempAccessCodeChallenge`](../type-aliases/TempAccessCodeChallenge.md)

Parameters defining the behaviour of the `TEMP_ACCESS_CODE` authentication method.

---

### token?

> `optional` **token**: `string`

The authorization token (IDaaS JWT).

---

### userId?

> `optional` **userId**: `string`

The user ID of the authenticated user.
