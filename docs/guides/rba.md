# Risk-Based Authentication Guide

## Request a challenge

```typescript
const challenge = await idaas.rba.requestChallenge({
  userId: "user@example.com",
  mutualChallengeEnabled: true,
});
```

## Submit response

```typescript
await idaas.rba.submitChallenge({
  transactionId: challenge.transactionId,
  response: "123456",
});
```

## Polling

```typescript
const result = await idaas.rba.poll({ transactionId: challenge.transactionId });
```

## Cancel

```typescript
await idaas.rba.cancel(challenge.transactionId);
```