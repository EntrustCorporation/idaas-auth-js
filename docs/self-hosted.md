# Self-Hosted Authentication Examples

This document provides complete examples for building your own login UI using the `IdaasClient.rba` and `IdaasClient.auth` facades. These examples demonstrate the request-submit-poll lifecycle for popular authenticator types.

## Prerequisites

- Review the [Quickstart guide](quickstart.md) for SDK installation and basic client initialization
- Understand the [Risk-Based Authentication Guide](guides/rba.md) for the underlying transaction flow
- See the [Convenience Auth Guide](guides/auth.md) for simplified helper methods

---

## OTP (SMS/Email/TOTP)

```typescript
async function startOtp(userId: string) {
  try {
    const challenge = await idaas.auth.otp(userId, {
      otpDeliveryType: "SMS",
      otpDeliveryAttribute: "work-phone",
    });

    // Prompt user for the code they received
    const code = (document.getElementById("otp-input") as HTMLInputElement).value;

    await idaas.auth.submit({ response: code });

    console.log("OTP authentication complete!");
  } catch (error) {
    console.error("OTP authentication failed", error);
  }
}
```

---

## Passkey (WebAuthn)

```typescript
async function startPasskey(userId?: string) {
  try {
    const result = await idaas.auth.passkey(userId);

    if (result?.authenticationCompleted) {
      console.log("Passkey authentication complete!");
    }
  } catch (error) {
    console.error("Passkey authentication failed", error);
  }
}
```

- Omit `userId` for discoverable credentials.
- Requires HTTPS and WebAuthn support.

---

## Soft token push with mutual challenge

```typescript
async function startSoftTokenPush(userId: string) {
  try {
    const initial = await idaas.auth.softToken(userId, {
      push: true,
      mutualChallenge: true,
    });

    if (initial.pushMutualChallenge) {
      console.log("Challenge:", initial.pushMutualChallenge);
    }

    const final = await idaas.auth.poll();

    if (final.authenticationCompleted) {
      console.log("Soft token push approved!");
    } else {
      console.log("Soft token push did not complete.");
    }
    
  } catch (error) {
    console.error("Soft token push failed", error);
  }
}
```

---

## Grid authentication

```typescript
async function startGrid(userId: string) {
  try {
    const challenge = await idaas.auth.grid(userId);

    // Display challenge.gridChallenge.challenge (e.g., [{ row: "A", column: 3 }, ...])
    const answers = collectGridAnswersFromForm(); // your UI collects answers in order

    const final = await idaas.auth.submit({ response: answers });

    if(final.authenticationCompleted){
      console.log("Grid challenge satisfied!");
    }
  } catch (error) {
    console.error("Grid authentication failed", error);
  }
}
```

---

## Knowledge-based authentication (KBA)

```typescript
async function startKba(userId: string) {
  try {
    const challenge = await idaas.auth.kba(userId);

    // Show challenge.kbaChallenge.userQuestions to the user
    const answers = collectKbaAnswersFromForm(); // e.g., ["Fluffy", "Lincoln Elementary"]

    const final = await idaas.auth.submit({ kbaChallengeAnswers: answers });
    if(final.authenticationCompleted){
      console.log("KBA passed!");
    }
  } catch (error) {
    console.error("KBA authentication failed", error);
  }
}
```

---

## Temporary access code

```typescript
async function startTempAccessCode(userId: string) {
  try {
    const code = (document.getElementById("temp-code") as HTMLInputElement).value;

    const final = await idaas.auth.tempAccessCode(userId, code);

    if(final.authenticationCompleted){
      console.log("Temporary access code accepted!");
    }
  } catch (error) {
    console.error("Temporary access code failed", error);
  }
}
```

---

## Magic link

```typescript
async function startMagicLink(userId: string) {
  try {
    const initial = await idaas.auth.magicLink(userId);

    if(initial.authenticationCompleted){
      console.log("Magic link redeemed!");
    }

  } catch (error) {
    console.error("Magic link failed", error);
  }
}
```

---

## Smart Credential push

```typescript
async function startSmartCredential(userId: string) {
  try {
    const initial = await idaas.auth.smartCredential(userId, {
      summary: "Approve login to Example App",
      pushMessageIdentifier: "example-app-login",
    });

    if(initial.authenticationCompleted){
      console.log("Smart Credential approved!");
    }

  } catch (error) {
    console.error("Smart Credential push failed", error);
  }
}
```

---

## Face biometrics (Onfido)

```typescript
import Onfido from "onfido-sdk-ui";
// ensure <div id="onfido-mount"></div> exists
async function startFace(userId: string) {
  try {
    const initial = await idaas.auth.faceBiometric(userId, {
      mutualChallenge: true,
    });

    if(initial.authenticationCompleted){
      console.log("Face verification succeeded!");
    }
  } catch (error) {
    console.error("Face authentication failed", error);
  }
}
```

> Install the optional dependency: `npm install onfido-sdk-ui`. Refer to the [Onfido Web SDK documentation](https://documentation.onfido.com/sdk/web/) for UI and capture details.

---

## Next steps

- Dive into the [Risk-Based Authentication Guide](guides/rba.md) for lower-level control.
- Consult the [API Reference](reference/idaas-client.md) for method signatures.
- Check [Troubleshooting](troubleshooting.md) for common issues.