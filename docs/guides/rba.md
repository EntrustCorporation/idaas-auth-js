# Risk-Based Authentication Guide

Risk-Based Authentication (RBA) lets you keep the login UX in your own application while Entrust IDaaS evaluates risk signals and challenges the user with the appropriate authenticator. Use the `IdaasClient.rba` facade for a fully self-hosted experience.

## Prerequisites

- Entrust IDaaS tenant with OIDC application configured with resource rules appropriate to your business requirements.
- Enable the JWT IDaaS grant type in the OIDC application.
- Knowledge of the authenticators you plan to surface (OTP, passkey, face, soft token, etc.).
- HTTPS origins for WebAuthn-based methods (passkeys, FIDO).

## Authentication lifecycle

```
requestChallenge → render challenge UI → submitChallenge → success/failure
```

OR

```
requestChallenge → poll → success/failure
```

1. **requestChallenge** – Starts an RBA transaction and tells you which authenticator the user must satisfy.
2. **submitChallenge** – Sends the user’s response (OTP code, WebAuthn assertion, etc.).
3. **poll** – For asynchronous methods (push notifications, face capture) keep asking the server for completion status.
4. **cancel** – Abort an in-flight transaction if the user backs out.

All methods share the same `IdaasContext`, so defaults such as `globalScope`, `globalAudience`, and refresh-token preference flow through automatically.

## Requesting a challenge

```typescript
const challenge = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  audience: "https://api.example.com",
  maxAge: 900,
  transactionDetails: [{ detail: "amount", value: "10000" }], // RBA policy determines if this is considered "high-risk" and chooses authenticator accordingly
});
```

Typical response shape:

```typescript
{
  authenticationCompleted: false,
  otpdeliveryType: "EMAIL",
  pollForCompletion: false,
  method: "OTP"
}
```

### Option reference

#### `AuthenticationRequestParams` (first argument)

If no `preferredAuthenticationMethod` is provided, the authenticator to be used is determined by the resource rule policy. if `strict` is set to `true`, enforces the preferredAuthenticationMethod; authentication will fail instead of falling back to other methods. Defaults to 'false.

| Property                        | Description                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `userId`                        | Identifier of the end user. Required for most authenticators.                            |
| `password`                      | Password to submit in combined flows (e.g., password + second factor).                   |
| `preferredAuthenticationMethod` | Hint for the authenticator to use (`"OTP"`, `"PASSKEY"`, `"TOKENPUSH"`, `"FACE"`, etc.). |
| `strict`                        | If `true`, forces the preferred method; IDaaS will fail instead of falling back.         |
| `otpOptions`                    | `{ otpDeliveryType?, otpDeliveryAttribute? }` for OTP delivery control.                  |
| `softTokenPushOptions`          | `{ mutualChallenge? }` toggles mutual-challenge values for soft token push.              |
| `smartCredentialOptions`        | `{ summary?, pushMessageIdentifier? }` for Smart Credential push messaging.              |
| `faceBiometricOptions`          | `{ mutualChallenge? }` enables mutual challenge for face authenticator.                  |
| `transactionDetails`            | Array of contextual details (`TransactionDetail[]`) sent to IDaaS risk engine.           |

#### `TokenOptions` (second argument)

| Property          | Description                                                    | Default                                                       |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `audience`        | API audience for issued access tokens.                         | `globalAudience` (omitted if `undefined`)                     |
| `scope`           | Space-delimited scopes.                                        | `globalScope` (`openid profile email` if globalScope not set) |
| `useRefreshToken` | Request refresh tokens for this transaction.                   | `globalUseRefreshToken` (or `false`)                          |
| `maxAge`          | Session age limit (seconds) before reauthentication is forced. | -1                                                            |
| `acrValues`       | Array of acceptable ACRs to satisfy.                           | Not sent                                                      |

## Rendering the challenge

Use the response payload to decide what UI to show. For example, if `challenge.method === "OTP"` display an input for the code; if it’s `"PASSKEY"` trigger a WebAuthn ceremony.

```typescript
if (challenge.method === "OTP") {
  showOtpInput();
} else if (challenge.method === "PASSKEY") {
  await startPasskeyFlow(challenge);
}
```

## Submitting the response

```typescript
await idaas.rba.submitChallenge({
  response: otpCode, // or mutual challenge data, etc.
});
```

You must use different properties for KBA & Passkey submissions.

- **Passkey:** `passkeyChallenge` Set to `publicKeyCredential` response from `navigator.credentials.get`.
- **KBA:** `kbaChallengeAnswers` Set to an array of answers to KBA questions in order of the questions array.

`submitChallenge` returns an `AuthenticationResponse` containing tokens (when the flow ends immediately) or a status update instructing you to poll.

## Polling asynchronous methods

Some authenticators (push, face) take time to complete server-side. Use `poll` to check status until the transaction resolves or times out.

```typescript
try{
  let result = await idaas.rba.poll();
} catch (err) {
  console.error("Authentication failed:", err);
}
```

`poll` returns the same `AuthenticationResponse` shape. Stop polling when status equals `COMPLETED`, `FAILED`, or `CANCELLED`.

## Cancelling a transaction

```typescript
await idaas.rba.cancel();
```

Call this when you want to cancel the authentication request. Cancelled transactions won’t produce tokens.

## Handling MFA flows

Multi-Factor authentication flows start with a password login. You can submit the password right away with `requestChallenge` or first request a challenge with the userId to ensure the user exists.

```typescript
// With Password
const challenge = await idaas.rba.requestChallenge({userId, password})

// Check challenge.method and handle the authentication method.
```

```typescript
// Without Password
const challenge = await idaas.rba.requestChallenge({ userId })
const submitResponse = await idaas.rba.submit({ response: password })

//check submitResponse.method and handle the authentication method.
```

## Handling common authenticators

### Passkey (WebAuthn)

```typescript
const challenge = await idaas.rba.requestChallenge({
  preferredAuthenticationMethod: "PASSKEY",
});

const assertion = await navigator.credentials.get({
  publicKey: challenge.passkeyChallenge,
});

await idaas.rba.submitChallenge({
  passkeyResponse: assertion,
});
```

### Soft token push

```typescript
await idaas.rba.requestChallenge({
  preferredAuthenticationMethod: "TOKENPUSH",
  softTokenPushOptions: { mutualChallenge: true },
});

await idaas.rba.poll();
```

### Face (Onfido)
> Refer to the [Onfido Web SDK documentation](https://documentation.onfido.com/sdk/web/) for details on how to use.

```typescript
const challenge = await idaas.rba.requestChallenge({
  preferredAuthenticationMethod: "FACE",
  faceBiometricOptions: { mutualChallenge: true },
});

showMutualAuthChallenge(challenge.pushMutualChallenge);

const onfidoSdk = (challenge: AuthenticationResponse) => {
  const instance = Onfido.init({
    token: challenge.faceChallenge?.sdkToken,
    workflowRunId: challenge.faceChallenge?.workflowRunId,
    containerId: "onfido-mount",
    onComplete: async () => {
      let authenticationPollResponse: AuthenticationResponse;
      try {
        authenticationPollResponse = await idaasClient.rba.poll();
        updateSubmitUI(authenticationPollResponse);
      } catch (error) {
        console.error("Error during authentication polling:", error);
      } finally {
        instance.tearDown();
      }
    },
  });
};
```

## See also

- [Convenience Auth Guide](auth.md) – higher-level helpers on top of RBA.
- [Self-Hosted UI Examples](../self-hosted.md) – detailed code snippets for common authenticators.
- [API Reference](../reference/idaas-client.md) – method signatures and types.