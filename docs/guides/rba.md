# Risk-Based Authentication Guide

Risk-Based Authentication (RBA) lets you keep the login UX in your own application while Entrust IDaaS evaluates risk signals and challenges the user with the appropriate authenticator. Use the `IdaasClient.rba` facade for a fully self-hosted experience.

## Prerequisites

- Entrust IDaaS tenant with RBA enabled for your application.
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
  userId: "alice@example.com",
  preferredAuthenticationMethod: "OTP",
  mutualChallengeEnabled: true,
  audience: "https://api.example.com",
  maxAge: 900,
  transactionDetails: {
    amount: "10000",
  },
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

| Property                        | Description                                                                              | Default              |
| ------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- |
| `userId`                        | Identifier of the end user. Required for most authenticators.                            | `undefined`          |
| `password`                      | Password to submit in combined flows (e.g., password + second factor).                   | `undefined`          |
| `preferredAuthenticationMethod` | Hint for the authenticator to use (`"OTP"`, `"PASSKEY"`, `"TOKENPUSH"`, `"FACE"`, etc.). | Determined by policy |
| `strict`                        | If `true`, forces the preferred method; IDaaS will fail instead of falling back.         | `false`              |
| `otpOptions`                    | `{ otpDeliveryType?, otpDeliveryAttribute? }` for OTP delivery control.                  | `undefined`          |
| `softTokenPushOptions`          | `{ mutualChallenge? }` toggles mutual-challenge values for soft token push.              | `undefined`          |
| `smartCredentialOptions`        | `{ summary?, pushMessageIdentifier? }` for Smart Credential push messaging.              | `undefined`          |
| `faceBiometricOptions`          | `{ mutualChallenge? }` enables mutual challenge for face authenticator.                  | `undefined`          |
| `transactionDetails`            | Array of contextual details (`TransactionDetail[]`) sent to IDaaS risk engine.           | `undefined`          |

#### `TokenOptions` (second argument)

| Property          | Description                                                    | Default                                                       |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `audience`        | API audience for issued access tokens.                         | `globalAudience` (omitted if `undefined`)                     |
| `scope`           | Space-delimited scopes.                                        | `globalScope` (`openid profile email` if globalScope not set) |
| `useRefreshToken` | Request refresh tokens for this transaction.                   | `globalUseRefreshToken` (or `false`)                          |
| `maxAge`          | Session age limit (seconds) before reauthentication is forced. | Not sent                                                      |
| `acrValues`       | Array of acceptable ACRs to satisfy.                           | Not sent                                                      |

## Rendering the challenge

Use the response payload to decide what UI to show. For example, if `challenge.challengeType === "OTP"` display an input for the code; if it’s `"PASSKEY"` trigger a WebAuthn ceremony.

```typescript
if (challenge.challengeType === "OTP") {
  showOtpInput();
} else if (challenge.challengeType === "PASSKEY") {
  await startPasskeyFlow(challenge);
}
```

## Submitting the response

```typescript
await idaas.rba.submitChallenge({
  response: otpInput.value, // or WebAuthn assertion, mutual challenge data, etc.
});
```

You can pass additional fields depending on the authenticator:

- **Passkey:** include `publicKeyCredential` response from `navigator.credentials.get`.
- **Face / Onfido:** include capture/session IDs returned by the SDK.
- **Soft token:** supply OTP value or acknowledge a push.

`submitChallenge` returns an `AuthenticationResponse` containing tokens (when the flow ends immediately) or a status update instructing you to poll.

## Polling asynchronous methods

Some authenticators (push, face) take time to complete server-side. Use `poll` to check status until the transaction resolves or times out.

```typescript
let result = await idaas.rba.poll();

if (result.status === "COMPLETED") {
  const token = await idaas.getAccessToken();
} else if (result.status === "FAILED") {
  showError(result.failureReason);
}
```

`poll` returns the same `AuthenticationResponse` shape. Stop polling when status equals `COMPLETED`, `FAILED`, or `CANCELLED`.

## Cancelling a transaction

```typescript
await idaas.rba.cancel();
```

Call this when the user exits the flow or you switch authenticators midstream. Cancelled transactions won’t produce tokens.

## Handling common authenticators

### OTP (SMS / Email / TOTP)

1. `requestChallenge({ preferredAuthenticationMethod: "OTP" })`
2. Prompt for the numeric code.
3. `submitChallenge({ response: code })`

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
  mutualChallengeEnabled: true,
  pushEnabled: true,
});

await idaas.rba.poll();
```

### Face (Onfido)
> Refer to the [Onfido Web SDK documentation](https://documentation.onfido.com/sdk/web/) for details on how to use their SDK.

```typescript
const challenge = await idaas.rba.requestChallenge({
  preferredAuthenticationMethod: "FACE",
  mutualChallengeEnabled: true,
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