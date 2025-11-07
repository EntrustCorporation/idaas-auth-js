# Convenience Auth Guide

`IdaasClient.auth` exposes higher-level helpers built on top of the Risk-Based Authentication (RBA) engine. These helpers hide most transaction plumbing so you can add password, OTP, passkey, soft token, grid, KBA, temporary access code, magic link, smart credential push, and face flows with minimal code.

Under the hood each helper calls into `IdaasClient.rba` to request, submit, poll, or cancel authentication transactions.

## Available helpers

> **Note:** Unless a helper explicitly states otherwise, the first parameter is the user’s identifier (`userId`). Passkey flows may omit it for discoverable credentials.

| Method                                          | Description                                         | Handles Submission?                                                        | 
| ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| `authenticatePassword(userId, password)`        | Password-only authentication.                       | ✅                                                                         |
| `authenticateOtp(userId, options?)`             | Requests an OTP challenge.                          | ❌ Call `auth.submit({ response })` with the code.                         |
| `authenticateSoftToken(userId, options?)`       | Soft token OTP or push.                             | ⚠️ Push (no mutual challenge) auto-polls; other modes require submit poll. |
| `authenticateGrid(userId)`                      | Grid challenge.                                     | ❌ Collect grid values then `auth.submit({ response })`.                   |
| `authenticatePasskey(userId?)`                  | WebAuthn/FIDO or usernameless passkey.              | ✅                                                                         |
| `authenticateKba(userId)`                       | Knowledge-based questions.                          | ❌ Supply answers in same order as questions array via `auth.submit({ kbaChallengeAnswers })`.      |
| `authenticateTempAccessCode(userId, code)`      | Temporary access code.                              | ✅                                                                         |
| `authenticateMagicLink(userId)`                 | Magic link                                          | ✅                                                                         |
| `authenticateSmartCredential(userId, options?)` | Smart Credential push.                              | ✅                                                                         | 
| `authenticateFaceBiometric(userId, options?)`   | Face biometrics via Onfido.                         | ✅                                                                         |

> If you need full control over the challenge lifecycle, use the lower-level [`IdaasClient.rba`](rba.md) API.

Some helper methods still require extra steps, see the following methods for completing the authentication life-cycle.

| Method                                          | Description                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `submit(params)`                                | Submits OTPs, passkey assertions, KBA answers, etc.                                            |
| `poll()`                                        | Polls the active transaction (mainly for push or face flows when mutual challenge is enabled). |
| `cancel()`                                      | Cancels the active transaction.                                                                |
| `logout()`                                      | Silently logs the user out of the ID Provider and clears tokens.                               |

## Setup

See the [Quickstart guide](../quickstart.md) for detailed client initialization. The basic pattern is:

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient(
  {
    issuerUrl: "https://example.trustedauth.com",
    clientId: "spa-client",
    storageType: "localstorage",
  },
  {
    scope: "openid profile email",
    audience: "https://api.example.com",
    useRefreshToken: true,
  }
);
```

The `auth` helpers inherit token defaults from the second constructor parameter. When neither default nor per-call audience/scope are provided, the SDK omits them and IDaaS applies tenant defaults.

## Password authentication

```typescript
const result = await idaas.auth.authenticatePassword("user@example.com", "PA$$w0rd!");

if (result.authenticationCompleted) {
  const accessToken = await idaas.getAccessToken();
}
```

`authenticatePassword` requests a password challenge and immediately submits the provided password.

## OTP authentication

```typescript
const challenge = await idaas.auth.authenticateOtp("user@example.com", {
  otpDeliveryType: "SMS",
  otpDeliveryAttribute: "work-phone",
});

// prompt user for code, then submit
await idaas.auth.submit({ response: otpCode });
```

> See [`OtpOptions`](../reference/idaas-client.md#otpoptions) in the API reference for available configuration options.

## Soft token (push or OTP)

```typescript
// Push with mutual challenge
const { pushMutualChallenge } = await idaas.auth.authenticateSoftToken("user@example.com", {
  push: true,
  mutualChallenge: true,
});

// Show mutual challenge text, then poll
const final = await idaas.auth.poll();
```

```typescript
// Plain push (auto-polls internally)
const final = await idaas.auth.authenticateSoftToken("user@example.com", {
  push: true,
});
```

```typescript
// OTP (manual entry)
const challenge = await idaas.auth.authenticateSoftToken("user@example.com");
await idaas.auth.submit({ response: softTokenCode });
```

> See [`SoftTokenOptions`](../reference/idaas-client.md#softtokenoptions) in the API reference for available configuration options.

## Passkey (WebAuthn)

```typescript
const result = await idaas.auth.authenticatePasskey();
// or authenticatePasskey("user@example.com") for FIDO with known username
```

- Throws if the browser lacks WebAuthn support.
- Automatically handles `navigator.credentials.get` and submits the assertion.

## Grid authentication

```typescript
const challenge = await idaas.auth.authenticateGrid("user@example.com");

// challenge.gridChallenge.challenge → [{ row, column }, ...]
const userResponse = collectGridValues(challenge.gridChallenge);
await idaas.auth.submit({ response: userResponse });
```

## Knowledge-based authentication (KBA)

```typescript
const challenge = await idaas.auth.authenticateKba("user@example.com");

// challenge.kbaChallenge.userQuestions → [{ question }, ...]
const answers = await promptForAnswers(challenge.kbaChallenge);
await idaas.auth.submit({ kbaChallengeAnswers: answers });
```

Answers array must match the order of the questions array.

## Temporary access code

```typescript
const result = await idaas.auth.authenticateTempAccessCode("user@example.com", "ABC123");
```

`authenticateTempAccessCode` requests a temporary access code challenge and immediately submits the provided code.

## Magic link

```typescript
const result = await idaas.auth.authenticateMagicLink("user@example.com");
```

The authenticateMagicLink immediately polls for completion.

## Smart Credential push

```typescript
const result = await idaas.auth.authenticateSmartCredential("user@example.com", {
  summary: "Approve login to Example App",
  pushMessageIdentifier: "example-app-login",
});
// Automatically polls until the push is approved or rejected.
```

> See [`SmartCredentialOptions`](../reference/idaas-client.md#smartcredentialoptions) in the API reference for available configuration options.

## Face (Onfido)

```typescript
const result = await idaas.auth.authenticateFaceBiometric("user@example.com", {
  mutualChallenge: true,
});
// Display the mutual challenge stored in result.pushMutualChallenge
```

> See [`FaceBiometricOptions`](../reference/idaas-client.md#facebiometricoptions) in the API reference for available configuration options.

Requirements:

- Install the optional peer dependency: `npm install onfido-sdk-ui`.
- Ensure a `<div id="onfido-mount"></div>` exists before calling.
- For web captures, the helper mounts the Onfido UI, waits for completion, then polls for the final result.
- For non-web captures, it returns the response—call `idaas.auth.poll()`.

> Consult the [Onfido Web SDK documentation](https://documentation.onfido.com/sdk/web/) for UI configuration and best practices.

## Manual submit/poll/cancel

After any helper that returns `authenticationCompleted: false`:

```typescript
// Submit codes or answers
await idaas.auth.submit({
  response: otpCode,
  // or passkeyResponse, kbaChallengeAnswers, etc.
});

// Poll push/face if mutual auth enabled.
await idaas.auth.poll();

// Cancel the active transaction
await idaas.auth.cancel();
```

## Error handling

Enclose each helper in `try/catch`:

```typescript
try {
  await idaas.auth.authenticatePasskey();
} catch (error) {
  console.error("Passkey auth failed", error);
  displayError(extractMessage(error));
}
```

## Next steps

- For complete control over multi-step flows, see the [Risk-Based Authentication Guide](rba.md).
- Check [Self-Hosted UI Examples](../self-hosted.md) for end-to-end implementations.
- Review the [API Reference](../reference/idaas-client.md) for interfaces and return types.
- Troubleshoot using the [Troubleshooting guide](../troubleshooting.md).