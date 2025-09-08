# Examples of Authenticating via Self Hosted UI

## PASSKEY

Only way to get PASSKEY challenge is not passing userId. <br>
Not passing userId overrides any `preferredAuthentication` or `strict` parameter.

```typescript
// This will be PASSKEY method 
await idaasClient.requestChallenge({
  preferredAuthenticationMethod: "OTP",
  strict: true,
});
```

```typescript
await idaasClient.requestChallenge();
const { authenticationCompleted } = await idaasClient.submitChallenge(); // true
```

## FIDO

Requires `requestChallenge` call.


```typescript
await idaasClient.requestChallenge({
  preferredAuthenticationMethod: "FIDO",
  userId: "<USER_ID>",
});

const { authenticationCompleted } = await idaasClient.submitChallenge(); // true

```

## PASSWORD

Can use `authenticatePassword` or normal `requestChallenge` and `submitChallenge`.

```typescript
const { authenticationCompleted } = await idaasClient.authenticatePassword({
  options: {
    userId: "<USER_ID>",
  },
  password: "<USER_PASSWORD>",
}); // true
```

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "PASSWORD",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_PASSWORD>",
}); // true
```

## KBA

Answers must be in the same order that the questions were received in.

ie received [Q1, Q2, Q3], must provide [A1, A2, A3], NOT [A3, A1, A2] or any other order

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "KBA",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  kbaChallengeAnswers: ["USER", "KBA", "ANSWERS"]
}); // true
```

## TEMP_ACCESS_CODE

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "TEMP_ACCESS_CODE",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_TEMP_ACCESS_CODE>",
}); // true
```

## OTP

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "OTP",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_OTP>",
}); // true
```

## GRID

The answer to the grid challenge is the values of the challenge squares appended to each other in the order they were received.

Example: <br>
You received the following `gridChallenge` from your `requestChallenge`
```typescript
gridChallenge = {
  challenge: [
    {
      column: 0,
      row: 0,
    }, // square A1
    {
      column: 1,
      row: 1,
    }, // square B2
    {
      column: 2,
      row: 2,
    } // square C3
  ],
  // other members not important
}
```
square A1 contains `12`, square B2 contains `LK`, square C3 contains `01`, your grid response is `12LK01`

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "GRID",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_GRID_RESPONSE>",
}); // true
```

## TOKEN

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "TOKEN",
});

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_TOKEN_RESPONSE>",
}); // true
```

## TOKENPUSH

The `mutualChallengeEnabled` flag determines if the user has to complete a mutualChallenge.

```typescript

// no mutual challenge
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "TOKENPUSH",
});

// mutual challenge
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "TOKENPUSH",
  mutualChallengeEnabled: true,
});

const { authenticationCompleted } = await idaasClient.pollAuth(); // true

// Can cancel this authentication
await idaasClient.cancelAuth();
```

## SMARTCREDENTIALPUSH

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "TOKENPUSH",
});


const { authenticationCompleted } = await idaasClient.pollAuth(); // true

// Can cancel this authentication
await idaasClient.cancelAuth();
```
## PASSWORD_AND_SECONDFACTOR

Can not use `authenticatPassword` for the password authentication part. <br>
`pollForCompletion` will update to represent the active authenticator, ie it will be false for `PASSWORD`, then true for the second factor authenticator if necessary. <br>
User will know second factor authenticator after submitting password.<br>
No way to control second factor authenticator.  It will be first option in array that IDaaS provides, the top option in the resource rules.<br>

```typescript
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "PASSWORD_AND_SECONDFACTOR",
});

const { pollForCompletion } = await idaasClient.submitChallenge({
  response: "<USER_PASSWORD>",
});

if (pollForCompletion) {
  const { authenticationCompleted } = await idaasClient.pollAuth(); // true
}

const { authenticationCompleted } = await idaasClient.submitChallenge({
  response: "<USER_SECOND_RESPONSE>",
}); // true
```

## FACE

Not integrated with Onfido SDK yet, user has to use Onfido SDK to use the faceChallenge returned for WEB FACE authentication.
MOBILE FACE authentication via the IDaaS app is supported.

Can enable mutualChallenge.

```typescript
// no mutual challenge
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "FACE",
});

// mutual challenge
await idaasClient.requestChallenge({
  userId: "<USER_ID>",
  preferredAuthenticationMethod: "FACE",
  mutualChallengeEnabled: true,
});

const { authenticationCompleted } = await idaasClient.pollAuth(); // true
```

# Additional parameters

All parameters to influence token claims will be passed in the `requestChallenge` call.

## scope?: string
```typescript
await idaasClient.requestChallenge({
  scope: "openid profile email",
});
```

The user can specify scopes for the token to have. <br>
The `openid` scope will always be used. <br>
If no scope is passed to `requestChallenge`, the `globalScope` will be used. See `initializeAuthenticationTransaction` in `IdaasClient.ts`. <br>

This value is used in `generateJwtAuthorizeUrl`.

## useRefreshToken?: boolean

```typescript
await idaasClient.requestChallenge({
  useRefreshToken: true,
});
```

The user can specify if the access token received from authenticating can be refreshed using refresh tokens.  <br>
The `refresh_token` grant type must be enabled. <br>
Appends the `offline_access` scope if set to true. <br>
If not set in `requestChallenge`, the `globalUseRefreshToken` value will be used. See `initializeAuthenticationTransaction` in `IdaasClient.ts`. <br>

This value is used in `generateJwtAuthorizeUrl`.

## preferredAuthenticationMethod?: IdaasAuthenticationMethod

```typescript
await idaasClient.requestChallenge({
  preferredAuthenticationMethod: "OTP",
});
```

The user can specify the authentication method they wish to use. <br>
If the method is available for the user, it will be used.

This value is used in `determineAuthenticationMethod`.

## strict?: boolean

Requires `preferredAuthenticationMethod` to be defined.

```typescript
await idaasClient.requestChallenge({
  preferredAuthenticationMethod: "OTP",
  strict: true,
});
```

The user can force the authentication method to be the `preferredAuthenticationMethod`. <br>
If the method is not available for the user, IDaaS will throw an error. 

This value is used in `determineAuthenticationMethod`.

## mutualChallengeEnabled?: boolean

```typescript
await idaasClient.requestChallenge({
  mutualChallengeEnabled: true,
});
```

The user can control if the answer to the `pushMutualChallenge` should be returned to them from the IDaaS API for `TOKENPUSH` and `FACE` authentication.<br>

This value is used in `constructUserChallengeParams`.

## audience?: string

```typescript
await idaasClient.requestChallenge({
  audience: "https://ca.dev.entrustsecure-dev.com",
});
```

The user can set the audience of the token. <br>
If not provided in `requestChallenge`, the `globalAudience` will be used. See `initializeAuthenticationTransaction` in `IdaasClient.ts`. <br>

This value is used in `generateJwtAuthorizeUrl`.

## maxAge?: number
```typescript
await idaasClient.requestChallenge({
  maxAge: 30,
});
```

The user can provide a maxAge for the access token. <br>
If not provided, no maxAge parameter will be used. <br>

This value is used in `generateJwtAuthorizeUrl`.

## transactionDetails?: TransactionDetail[]

The user can provide transaction details to pass to the IDaaS Auth API.

```typescript
await idaasClient.requestChallenge({
  transactionDetails: [
    {
      detail: "action",
      value: "profile",
    },
  ],
});
```

This value is used in all requests to the IDaaS Auth API.

