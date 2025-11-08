[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [AuthClient](../README.md) / AuthClient

# Class: AuthClient

Convenience authentication client for fixed authentication methods.

This client provides simplified methods for specific authentication types (password, OTP, passkey, etc.)
when you want to bypass risk-based evaluation and use a specific authentication method directly.

**Use cases:**

- Login pages with traditional username/password forms
- Passwordless authentication flows with a specific method (e.g., passkey-only)
- Applications that don't require dynamic authentication based on context

**When to use this vs RbaClient:**

- Use `AuthClient` when you know which authentication method you want to use
- Use `RbaClient` when you want the identity provider to dynamically select authentication
  methods based on risk and Resource Rules

Under the hood, these methods use `RbaClient` with `strict: true` and a specified
`preferredAuthenticationMethod` to force a specific authentication method.

## See

- [Convenience Auth Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md)
- [Choosing an Approach](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/choosing-an-approach.md)

## Constructors

### Constructor

> **new AuthClient**(`rbaClient`): `AuthClient`

#### Parameters

##### rbaClient

[`RbaClient`](../../RbaClient/classes/RbaClient.md)

#### Returns

`AuthClient`

## Methods

### cancel()

> **cancel**(): `Promise`\<`void`\>

Cancels an ongoing authentication challenge.
Terminates the current authentication transaction and cleans up any pending state.

#### Returns

`Promise`\<`void`\>

---

### faceBiometric()

> **faceBiometric**(`userId`, `mutualChallenge`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticate using Face.
Requests a FACE challenge, then initializes the Onfido Web SDK and polls for completion on onComplete.

Requirements:

- Optional peer dependency: Install 'onfido-sdk-ui' to use this method:
  npm install onfido-sdk-ui
  (It is declared as an optional peer dependency; projects not using face auth can omit it.)
- DOM container: Ensure a <div id="onfido-mount"></div> exists in the DOM before calling. The SDK mounts its UI there.

Flow:

1. requestChallenge(FACE) returns faceChallenge with sdkToken and workflowRunId.
2. Onfido.init is called with those values and containerId 'onfido-mount'.
3. On onComplete the method polls for final authentication status and resolves with the AuthenticationResponse.

#### Parameters

##### userId

`string`

The user ID to authenticate.

##### mutualChallenge

[`FaceBiometricOptions`](../../index/interfaces/FaceBiometricOptions.md) = `{}`

Determines if the user must answer a mutual challenge for and FACE authenticator.

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.

#### Throws

If faceChallenge is missing, Onfido initialization fails, or polling fails.

---

### grid()

> **grid**(`userId`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Starts a GRID challenge.
Response includes gridChallenge.challenge: [{ row: 0, column: 1 }, ...] (one entry per required cell).
Prompt the user for the contents of the cell at each coordinate (in order) to build the code, then call the submit method with their code (e.g idaasClient.auth.submit({ response: 'A6N3D5' })).

#### Parameters

##### userId

`string`

The user ID to authenticate.

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the gridChallenge to display to the user.

---

### kba()

> **kba**(`userId`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Starts a KBA (knowledge-based) challenge.
Response includes kbaChallenge.userQuestions: [{ question: string }, ...].
Gather answers and call submit({ kbaChallengeAnswers: ['answer1', 'answer2', ...]}).
Order of answers must match order of questions received.

#### Parameters

##### userId

`string`

The user ID to authenticate.

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the KBA challenge questions to display to the user.

---

### logout()

> **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### magicLink()

> **magicLink**(`userId`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticate using Magic Link.
Requests a MAGICLINK challenge, then immediately starts polling for completion.

#### Parameters

##### userId

`string`

The user ID to authenticate.

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.

---

### otp()

> **otp**(`userId`, `options`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Requests an One-Time Password (OTP) to be sent to the user.

This method initiates OTP authentication by requesting a time-based code to be delivered
to the user via their configured delivery method (SMS, email, or voice call).

After calling this method, prompt the user to enter the OTP they received, then call
`idaasClient.auth.submit({ response: '123456' })` to complete authentication.

**Delivery options:**

- **SMS**: Code sent via text message (default for most configurations)
- **EMAIL**: Code sent via email
- **VOICE**: Code delivered via automated phone call

You can optionally specify a delivery type and/or attribute to override the user's default.

**When to use:**

- Two-factor authentication (2FA) scenarios
- Passwordless authentication with OTP
- Account verification flows

#### Parameters

##### userId

`string`

The user's unique identifier

##### options

[`OtpOptions`](../../index/interfaces/OtpOptions.md) = `{}`

OTP delivery configuration (type and attribute)

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response containing the challenge (requires submission)

#### See

[Convenience Auth Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md)

---

### passkey()

> **passkey**(`userId?`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md) \| `undefined`\>

Authenticates a user with a passkey (WebAuthn/FIDO2).

Supports two modes:

- **With userId**: Uses FIDO authentication (user must have registered a passkey)
- **Without userId**: Uses usernameless/discoverable credential (PASSKEY)

This method handles the complete passkey flow:

1. Requests an appropriate challenge (FIDO or PASSKEY)
2. Invokes the browser's passkey UI (`navigator.credentials.get()`)
3. Submits the WebAuthn credential automatically
4. Stores tokens upon successful authentication

**Browser support:**
Requires a browser with WebAuthn support. The method checks for support automatically
and throws an error if passkeys are not available.

**When to use:**

- Passwordless authentication flows
- Security key authentication
- Biometric authentication (Face ID, Touch ID, Windows Hello)

#### Parameters

##### userId?

`string`

Optional user identifier (omit for usernameless authentication)

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md) \| `undefined`\>

Authentication response with `authenticationCompleted: true` on success

#### Throws

If browser doesn't support passkeys

#### Throws

If user cancels the passkey ceremony

#### Throws

If no credential is returned

#### See

[Convenience Auth Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md)

---

### password()

> **password**(`userId`, `password`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticates a user with username and password.

This method bypasses risk-based evaluation and directly requests password authentication.
It's ideal for traditional login forms where you want a consistent password-based experience.

The method automatically:

1. Requests a PASSWORD challenge from the identity provider
2. Submits the provided password
3. Stores tokens upon successful authentication

**When to use:**

- Traditional login pages with username/password fields
- Applications that require password authentication for specific workflows
- Testing and development scenarios

#### Parameters

##### userId

`string`

The user's unique identifier (email, username, etc.)

##### password

`string`

The user's password

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response with `authenticationCompleted: true` on success

#### See

[Convenience Auth Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md)

---

### poll()

> **poll**(): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Polls the authentication provider to check for completion of an ongoing authentication process.
Useful for authentication flows that may complete asynchronously (e.g., token push authentication).

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.

---

### smartCredential()

> **smartCredential**(`userId`, `options`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticate using Smart Credential Push.
Requests a SMARTCREDENTIALPUSH challenge, then immediately starts polling for completion.

#### Parameters

##### userId

`string`

The user ID to authenticate.

##### options

[`SmartCredentialOptions`](../../index/interfaces/SmartCredentialOptions.md) = `{}`

Smart credential authentication options

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.

---

### softToken()

> **softToken**(`userId`, `options`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticate using Entrust Soft Token.

Modes:

- push === false: Issues a TOKEN challenge (OTP). Caller must later call submitChallenge with the user’s code.
- push === true && mutualChallenge === false: Starts a TOKENPUSH challenge and immediately polls until completion; returns the final AuthenticationResponse.
- push === true && mutualChallenge === true: Starts a TOKENPUSH challenge with mutual challenge enabled; returns the initial response containing the mutual challenge. Caller must then call poll() to await completion.

**Mutual Challenge**: When enabled, the user must verify a challenge code displayed on the authentication device
to protect against push bombing attacks (where attackers spam push notifications hoping the user accidentally approves).
The `mutualChallenge` option is ignored unless `push` is true.

#### Parameters

##### userId

`string`

The user ID to authenticate.

##### options

[`SoftTokenOptions`](../../index/interfaces/SoftTokenOptions.md) = `{}`

Soft token authentication options

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse:

- Final result (success/failure) for plain TOKENPUSH (no mutual challenge).
- Initial challenge response for TOKENPUSH with mutual challenge (requires poll).
- Initial challenge response for TOKEN (requires submitChallenge with OTP).

#### Throws

On request/poll errors.

---

### submit()

> **submit**(`params`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Submits a response to an authentication challenge.
Processes authentication responses and completes the authentication if successful.

#### Parameters

##### params

[`AuthenticationSubmissionParams`](../../index/interfaces/AuthenticationSubmissionParams.md)

Authentication submission parameters

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.

---

### tempAccessCode()

> **tempAccessCode**(`userId`, `tempAccessCode`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authenticate using a temporary access code.
Requests a TEMP_ACCESS_CODE challenge, then immediately submits the provided code.

#### Parameters

##### userId

`string`

The user ID to authenticate.

##### tempAccessCode

`string`

The temporary access code to submit.

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

AuthenticationResponse containing information regarding the authentication request. Includes the authenticationCompleted flag to indicate successful authentication.
