# Convenience Auth Guide

`IdaasClient.auth` exposes higher-level helpers built on top of the Risk-Based Authentication (RBA) engine. These helpers hide most transaction plumbing so you can add password, OTP, passkey, soft token, grid, KBA, temporary access code, magic link, smart credential push, and face flows with minimal code.

Under the hood each helper calls into `IdaasClient.rba` to request, submit, poll, or cancel authentication transactions.

## Available helpers

> **Note:** Unless a helper explicitly states otherwise, the first parameter is the user’s identifier (`userId`). Passkey flows may omit it for discoverable credentials.

| Method | Description | Automatically submits? | Needs follow-up? |
| --- | --- | --- | --- |
| `authenticatePassword(userId, password)` | Password-only authentication. | ✅ | No |
| `authenticateOtp(userId, options?)` | Requests an OTP challenge. | ❌ | Call `auth.submit({ response })` with the code. |
| `authenticateSoftToken(userId, options?)` | Soft token OTP or push. | Depends | Push (no mutual challenge) auto-polls; other modes require submit/poll. |
| `authenticateGrid(userId)` | Grid challenge. | ❌ | Collect grid values then `auth.submit({ response })`. |
| `authenticatePasskey(userId?)` | WebAuthn/FIDO or usernameless passkey. | ✅ | No |
| `authenticateKba(userId)` | Knowledge-based questions. | ❌ | Supply ordered answers via `auth.submit({ kbaChallengeAnswers })`. |
| `authenticateTempAccessCode(userId, code)` | Temporary access code. | ✅ | No |
| `authenticateMagiclink(userId)` | Magic link (polls for completion). | ✅ | No (auto-polls) |
| `authenticateSmartCredential(userId, options?)` | Smart Credential push. | ✅ | No (auto-polls) |
| `authenticateFace(userId, options?)` | Face biometrics via Onfido. | ✅ | Auto-polls for web capture; returns early for non-web devices. |
| `submit(params)` | Submits OTPs, passkey assertions, KBA answers, etc. | – | – |
| `poll()` | Polls the active transaction (mainly for push or face flows when mutual challenge is enabled). | – | – |
| `cancel()` | Cancels the active transaction. | – | – |

> If you need full control over the challenge lifecycle, use the lower-level [`IdaasClient.rba`](rba.md) API.

## Setup

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://tenant.example.com",
  clientId: "spa-client",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  globalUseRefreshToken: true,
  storageType: "local",
});
```

The `auth` helpers reuse `IdaasClient` defaults. When neither global nor per-call audience/scope are provided, the SDK omits them and IDaaS applies tenant defaults.

## Password authentication

```typescript
const result = await idaas.auth.authenticatePassword("alice@example.com", "PA$$w0rd!");

if (result.authenticationCompleted) {
  const accessToken = await idaas.getAccessToken();
}
```

`authenticatePassword` requests a password challenge and immediately submits the provided password.

## OTP authentication

```typescript
const challenge = await idaas.auth.authenticateOtp("alice@example.com", {
  otpDeliveryType: "SMS",
  otpDeliveryAttribute: "+15551234567",
});

// prompt user for code, then submit
await idaas.auth.submit({ response: otpCode });
```

### `OtpOptions`

| Property | Description |
| --- | --- |
| `otpDeliveryType` | Channel for the OTP (e.g., `"SMS"`, `"EMAIL"`, `"VOICE", "WECHAT", "WHATSAPP"`). Leave undefined to use policy default. |
| `otpDeliveryAttribute` | Override which phone/email attribute receives the OTP. |

## Soft token (push or OTP)

```typescript
// Push with mutual challenge
const { pushMutualChallenge } = await idaas.auth.authenticateSoftToken("alice@example.com", {
  push: true,
  mutualChallenge: true,
});

// show mutual challenge text, then poll
const final = await idaas.auth.poll();
```

```typescript
// Plain push (auto-polls internally)
const final = await idaas.auth.authenticateSoftToken("alice@example.com", {
  push: true,
});
```

```typescript
// OTP (manual entry)
const challenge = await idaas.auth.authenticateSoftToken("alice@example.com");
await idaas.auth.submit({ response: softTokenCode });
```

### `SoftTokenOptions`

| Property | Description | Effect |
| --- | --- | --- |
| `push` | Trigger push approval instead of OTP entry. | `true` starts a `TOKENPUSH` challenge. |
| `mutualChallenge` | Display mutual challenge strings in push response. | Only applied when `push` is `true`. |

## Passkey (WebAuthn)

```typescript
const result = await idaas.auth.authenticatePasskey();
// or authenticatePasskey("alice@example.com") for FIDO with known username
```

- Throws if the browser lacks WebAuthn support.
- Automatically handles `navigator.credentials.get` and submits the assertion.

## Grid authentication

```typescript
const challenge = await idaas.auth.authenticateGrid("alice@example.com");

// challenge.gridChallenge.challenge → [{ row, column }, ...]
const userResponse = collectGridValues(challenge.gridChallenge);
await idaas.auth.submit({ response: userResponse });
```

## Knowledge-based authentication (KBA)

```typescript
const challenge = await idaas.auth.authenticateKba("alice@example.com");

// challenge.kbaChallenge.userQuestions → [{ question }, ...]
const answers = await promptForAnswers(challenge.kbaChallenge);
await idaas.auth.submit({ kbaChallengeAnswers: answers });
```

Answers array must match the order of the questions array.

## Temporary access code

```typescript
await idaas.auth.authenticateTempAccessCode("alice@example.com", "ABC123");
```

Requests a temporary code challenge and submits the code in one go.

## Magic link

```typescript
await idaas.auth.authenticateMagiclink("alice@example.com");

const final = await idaas.auth.poll();

```

The helper immediately polls.

## Smart Credential push

```typescript
const result = await idaas.auth.authenticateSmartCredential("alice@example.com", {
  summary: "Approve login to Example App",
  pushMessageIdentifier: "example-app-login",
});
// Automatically polls until the push is approved or rejected.
```

### `SmartCredentialOptions`

| Property | Description |
| --- | --- |
| `summary` | Text shown in the push notification. |
| `pushMessageIdentifier` | Identifier for customized push templates. |

## Face (Onfido)

```typescript
const result = await idaas.auth.authenticateFace("alice@example.com", {
  mutualChallenge: true,
});
```

Requirements:

- Install the optional peer dependency: `npm install onfido-sdk-ui`.
- Ensure a `<div id="onfido-mount"></div>` exists before calling.
- For web captures, the helper mounts the Onfido UI, waits for completion, then polls for the final result.
- For non-web captures, it returns the response—call `idaas.auth.poll()`.

> Consult the [Onfido Web SDK documentation](https://documentation.onfido.com/sdk/web/) for UI configuration and best practices.

### `FaceBiometricOptions`

| Property | Description |
| --- | --- |
| `mutualChallenge` | Request mutual challenge values for anti-phishing prompts. |

## Manual submit/poll/cancel

After any helper that returns `authenticationCompleted: false`:

```typescript
// Submit codes or answers
await idaas.auth.submit({
  response: otpCode,
  // or passkeyResponse, kbaChallengeAnswers, etc.
});

// Poll push/face progress
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

Common issues:

- Unsupported browser APIs (passkey requires WebAuthn).
- Missing optional dependency (`onfido-sdk-ui`) for face authentication.

## Next steps

- For complete control over multi-step flows, see the [Risk-Based Authentication Guide](rba.md).
- Check [Self-Hosted UI Examples](../self-hosted.md) for end-to-end implementations.
- Review the [API Reference](../reference/idaas-client.md) for interfaces and return types.
- Troubleshoot using the [Troubleshooting guide](../troubleshooting.md).