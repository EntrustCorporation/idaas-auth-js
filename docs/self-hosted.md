# Self-Hosted UI Examples

## Passkey

```typescript
const transaction = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "PASSKEY",
});

await idaas.rba.submitChallenge({
  transactionId: transaction.transactionId,
  response: await collectPasskeyResponse(),
});
```

## OTP

```typescript
const transaction = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "OTP",
});

await idaas.rba.submitChallenge({
  transactionId: transaction.transactionId,
  response: otpInput.value,
});
```

## Face

```typescript
await idaas.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "FACE",
  mutualChallengeEnabled: true,
});
```

## Additional options

- `maxAge`: controls token age.
- `audience`: override default audience.
- `transactionDetails`: send metadata to IDaaS.