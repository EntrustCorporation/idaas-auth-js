[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [RbaClient](../README.md) / RbaClient

# Class: RbaClient

Risk-Based Authentication (RBA) client for self-hosted authentication flows.

This client enables you to build custom authentication UI within your application by handling
challenge-response authentication flows. It manages the complete authentication transaction
lifecycle: challenge requests, response submissions, asynchronous polling, and cancellation.

**Important**: RBA authentication requires your application to be configured with **Resource Rules**
in the IDaaS portal. Resource Rules define which authentication methods are required based on
contextual risk factors like IP address, device fingerprint, transaction amount, etc.

Main methods:

- `requestChallenge()`: Initiate authentication and receive a challenge
- `submitChallenge()`: Submit user response to the challenge
- `poll()`: Check for async completion (e.g., push notifications)
- `cancel()`: Cancel an ongoing authentication transaction
- `logout()`: End the session and revoke tokens

## See

- [RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)
- [Choosing an Approach](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/choosing-an-approach.md)

## Constructors

### Constructor

> **new RbaClient**(`context`, `storageManager`): `RbaClient`

#### Parameters

##### context

`IdaasContext`

##### storageManager

`StorageManager`

#### Returns

`RbaClient`

## Methods

### cancel()

> **cancel**(): `Promise`\<`void`\>

Cancels the current authentication transaction.

Use this method to abandon an in-progress authentication flow, for example:

- User clicks "Cancel" button during authentication
- User navigates away from authentication page
- Authentication timeout occurs

This terminates the transaction server-side and cleans up any pending state.
After cancellation, you must call `requestChallenge()` again to start a new authentication flow.

#### Returns

`Promise`\<`void`\>

#### Throws

If no authentication transaction is in progress

#### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)

---

### logout()

> **logout**(): `Promise`\<`void`\>

Logs the user out and terminates their session.

This method:

1. Revokes the session token with the identity provider (server-side logout)
2. Clears all stored tokens (access, ID, and refresh) from local storage
3. Resets the current authentication transaction

After logout, the user must authenticate again via `requestChallenge()`.

**Note**: Unlike OIDC logout, this method does not redirect the browser.
It completes silently and returns a Promise.

#### Returns

`Promise`\<`void`\>

#### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)

---

### poll()

> **poll**(): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Polls for completion of an asynchronous authentication flow.

Some authentication methods complete asynchronously without requiring `submitChallenge()`:

- Push notifications (user approves on mobile device)
- Email magic links (user clicks link in email)
- SMS magic links (user clicks link in SMS)

When `pollForCompletion: true` in the challenge response, call this method repeatedly
(e.g., every 2-3 seconds) to check if the user has completed authentication on their device.

**Polling behavior:**

- Returns `authenticationCompleted: false` while waiting for user action
- Returns `authenticationCompleted: true` when authentication succeeds
- Automatically stores tokens upon successful completion

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response indicating completion status

#### Throws

If no authentication transaction is in progress

#### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)

---

### requestChallenge()

> **requestChallenge**(`options`, `tokenOptions?`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Initiates a risk-based authentication challenge based on configured Resource Rules.

This method starts an authentication transaction by sending contextual information to the
identity provider, which evaluates risk and returns an appropriate authentication challenge
based on your configured Resource Rules.

**Key features:**

- Automatic risk evaluation based on transaction details (IP address, device, transaction amount, etc.)
- Dynamic authentication method selection (password, OTP, push, biometric, etc.)
- Support for step-up authentication scenarios

The response indicates:

- Which authentication method is required
- Whether the method requires user interaction (`pollForCompletion: false`) or is asynchronous (`pollForCompletion: true`)
- Challenge details (e.g., grid coordinates, KBA questions, FIDO options)

#### Parameters

##### options

[`AuthenticationRequestParams`](../../index/interfaces/AuthenticationRequestParams.md) = `{}`

Authentication request parameters including userId and transactionDetails

##### tokenOptions?

[`TokenOptions`](../../index/interfaces/TokenOptions.md)

Token request options (audience, scope, ACR values)

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response containing the challenge and method details

#### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)

---

### submitChallenge()

> **submitChallenge**(`options`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Submits the user's response to an authentication challenge.

After receiving a challenge from `requestChallenge()`, use this method to submit the user's
authentication response (e.g., password, OTP code, grid coordinates, KBA answers).

The response indicates whether:

- Authentication completed successfully (`authenticationCompleted: true`)
- Additional authentication is required (step-up scenario)
- Authentication failed

Upon successful completion, tokens are automatically stored and can be retrieved via
`getAccessToken()` and `getIdTokenClaims()`.

#### Parameters

##### options

[`AuthenticationSubmissionParams`](../../index/interfaces/AuthenticationSubmissionParams.md) = `{}`

Authentication submission parameters with the user's response data

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response indicating completion status or next challenge

#### Throws

If no authentication transaction is in progress

#### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)
