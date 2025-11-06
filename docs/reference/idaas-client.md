# API Reference: IdaasClient

The `IdaasClient` class is the primary entry point to the IDaaS Auth JS SDK. It exposes hosted OpenID Connect flows (`oidc`), risk-based authentication (`rba`), convenience helpers (`auth`), and token utilities.

---

## Constructor

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const idaas = new IdaasClient(options);
```

### `IdaasClientOptions`

| Property                | Type                           | Description                                                   | Default                  |
| ----------------------- | ------------------------------ | ------------------------------------------------------------- | ------------------------ |
| `issuerUrl`             | `string`                       | Entrust IDaaS issuer URL (`https://example.trustedauth.com`). | —                        |
| `clientId`              | `string`                       | Registered application/client identifier.                     | —                        |
| `globalScope`           | `string?`                      | Space-delimited scopes used when per-call scope is omitted.   | `"openid profile email"` |
| `globalAudience`        | `string?`                      | Default API audience. Omitted when `undefined`.               | `undefined`              |
| `globalUseRefreshToken` | `boolean?`                     | Request refresh tokens by default.                            | `false`                  |
| `storageType`           | `"memory?" \| "localstorage?"` | Token persistence strategy.                                   | `"memory"`               |

---

## Properties

### `oidc: OidcClient`

Hosted OpenID Connect helper providing:

- `login(options?: OidcLoginOptions & TokenOptions)`
- `handleRedirect()`
- `logout(LogoutOptions?)`

See the [OIDC Guide](../guides/oidc.md) for usage.

### `rba: RbaClient`

Risk-Based Authentication helper exposing:

- `requestChallenge(authenticationParams?, tokenOptions?)`
- `submitChallenge(submitParams)`
- `logout()`
- `poll()`
- `cancel()`

> **Note:** Supply the user’s identifier (`userId`) in `AuthenticationRequestParams` unless the authenticator explicitly allows anonymous flows.

See the [RBA Guide](../guides/rba.md) for details.

### `auth: AuthClient`

Convenience helpers including `authenticatePassword`, `authenticateOtp`, `authenticatePasskey`, `authenticateSoftToken`, `authenticateFaceBiometric`, and more.

- `authenticatePassword(userId, password)`
- `authenticateSoftToken(userId, SoftTokenOptions?)`
- `authenticateGrid(userId)`
- `authenticatePasskey(userId?)`
- `authenticateKba(userId)`
- `authenticateTempAccessCode(userId, tempAccessCode)`
- `authenticateOtp(userId, OtpOptions?)`
- `authenticateSmartCredential(userId, SmartCredentialOptions?)`
- `authenticateFaceBiometric(userId, FaceBiometricOptions?)`
- `authenticateMagicLink(userId)`
- `submit(AuthenticationSubmissionParams?)`
- `logout()`
- `poll()`
- `cancel()`

> **Note:** Almost every convenience helper expects `userId` as the first argument; passkey flows may omit it when using discoverable credentials.

See the [Convenience Auth Guide](../guides/auth.md).

---

## Methods

### `isAuthenticated(): boolean`

Returns `true` when a ID token exists.

### `getAccessToken(options?: GetAccessTokenOptions): Promise<string | null>`

Retrieves a cached access token. If the token is expired and a refresh token is available (subject to tenant configuration), the SDK performs a refresh.

- Returns `null` when no matching session exists.
- Throws if the refresh/token exchange fails.

### `getIdTokenClaims(): UserClaims | null`

Returns decoded ID token claims or `null`.

### `getUserInfo(accessToken?: string): Promise<UserClaims | null>`

Returns the user claims from the OpenId Provider using the userinfo endpoint or `null`.

---

## Supporting types

### `TokenOptions`

Used by OIDC/RBA helpers for per-request overrides.

| Property          | Type        | Description                                                              | Default                 |
| ----------------- | ----------- | ------------------------------------------------------------------------ | ----------------------- |
| `audience`        | `string?`   | API audience for access tokens.                                          | `globalAudience`        |
| `scope`           | `string?`   | Space-delimited scopes.                                                  | `globalScope`           |
| `useRefreshToken` | `boolean?`  | Request a refresh token.                                                 | `globalUseRefreshToken` |
| `maxAge`          | `number?`   | Require reauthentication if the session is older than this many seconds. | Not sent                |
| `acrValues`       | `string[]?` | Requested ACR values.                                                    | Not sent                |

### `OidcLoginOptions`

| Property      | Type       | Description                                      |
| ------------- | ---------- | ------------------------------------------------ |
| `popup`       | `boolean?` | Use hosted popup (`true`) or redirect (`false`). |
| `redirectUri` | `string?`  | Callback URI for redirect/popup flows.           |

### `LogoutOptions`

| Property      | Type      | Description                                    |
| ------------- | --------- | ---------------------------------------------- |
| `redirectUri` | `string?` | Post-logout redirect URI (must be registered). |

### `FallbackAuthorizationOptions`

Used when `getAccessToken` cannot find a session and you want the SDK to start a fresh authorization automatically.

| Property          | Type        | Description                                                                                                                        |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `acrValues`       | `string[]?` | Requested ACR values.                                                                                                              |
| `redirectUri`     | `string?`   | Target redirect URI for the fallback flow.                                                                                         |
| `useRefreshToken` | `boolean?`  | Determines whether the token obtained from this login request can use refresh tokens. This defaults to the `globalUseRefreshToken` |
| `popup`           | `boolean?`  | Determines the method of login that will be used to authenticate the user.                                                         |

### `GetAccessTokenOptions`

| Property                       | Type                            | Description                                   |
| ------------------------------ | ------------------------------- | --------------------------------------------- |
| `audience`                     | `string?`                       | Required audience of the cached token.        |
| `scope`                        | `string?`                       | Required scopes (space-delimited).            |
| `acrValues`                    | `string[]?`                     | Requested ACR values.                         |
| `fallbackAuthorizationOptions` | `FallbackAuthorizationOptions?` | Start a new authorization if no token exists. |

### `SmartCredentialOptions`

| Property                | Type      | Description                              |
| ----------------------- | --------- | ---------------------------------------- |
| `summary`               | `string?` | Text displayed in Smart Credential push. |
| `pushMessageIdentifier` | `string?` | Identifier for custom push templates.    |

### `SoftTokenOptions`

| Property          | Type       | Description                                                                                      |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `mutualChallenge` | `boolean?` | Determines if the user must answer a mutual challenge for the TOKENPUSH authenticator.           |
| `push`            | `boolean?` | Determines if push authentication (true) or standard token authentication (false) should be used |

### `SoftTokenPushOptions`

| Property          | Type       | Description                                                                            |
| ----------------- | ---------- | -------------------------------------------------------------------------------------- |
| `mutualChallenge` | `boolean?` | Determines if the user must answer a mutual challenge for the TOKENPUSH authenticator. |

### `FaceBiometricOptions`

| Property          | Type       | Description                                                                       |
| ----------------- | ---------- | --------------------------------------------------------------------------------- |
| `mutualChallenge` | `boolean?` | Determines if the user must answer a mutual challenge for the FACE authenticator. |

### `OtpOptions`

| Property               | Type                                                     | Description                                                                                  |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `otpDeliveryType`      | `"SMS" \| "EMAIL" \| "VOICE" \| "WECHAT" \| "WHATSAPP"?` | The delivery type for the OTP challenge.                                                     |
| `otpDeliveryAttribute` | `string?`                                                | The name of the delivery attribute to use for the OTP challenge, such as a "business-email". |

### `TransactionDetail`

| Property | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| `detail` | `string?` | The transaction detail name.  |
| `value`  | `string?` | The transaction detail value. |

### `IdaasAuthenticationMethod`

`"PASSWORD" | "KBA" | "TEMP_ACCESS_CODE" | "OTP" | "GRID" | "TOKEN" | "TOKENPUSH" | "FIDO" | "SMARTCREDENTIALPUSH" | "PASSWORD_AND_SECONDFACTOR" | "MAGICLINK" | "PASSKEY" | "FACE" | "EXTERNAL"`

### `AuthenticationRequestParams`

| Property                        | Type                         | Description                                                     |
| --------------------------------| ---------------------------- | --------------------------------------------------------------- |
| `userId`                        | `string?`                    | The user ID of the user to request the challenge for.           |
| `password`                      | `string?`                    | The user's password to submit for MFA flows.                    |
| `preferredAuthenticationMethod` | `IdaasAuthenticationMethod?` |  The preferred method of authentication.                        |
| `strict`                        | `boolean?`                   | Determines if the preferred authentication method must be used. |
| `otpOptions`                    | `OtpOptions?`                | Options available during OTP authentication.                    |
| `softTokenPushOptions`          | `SoftTokenPushOptions?`      | Options available during TOKENPUSH authentication.              |
| `smartCredentialOptions`        | `SmartCredentialOptions?`    | Options available during SMARTCREDENTIALPUSH authentication.    |
| `faceBiometricOptions`          | `FaceBiometricOptions?`      | Options available during FACE authentication.                   |
| `transactionDetails`            | `TransactionDetail[]?`       | The transaction details of the request.                         |

### `AuthenticationResponse`

| Property                  | Type                                 | Description                                                                                                       |
| ------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `token`                   | `string?`                            | The Authenticated/unauthenticated authorization token.                                                            |
| `authenticationCompleted` | `boolean?`                           | A flag indicating if authentication has been completed.                                                           |
| `secondFactorMethod`      | `IdaasAuthenticationMethod?`         | The second factor authenticator that will be used.                                                                |
| `method`                  | `IdaasAuthenticationMethod?`         | The method of authentication that will be used.                                                                   |
| `pollForCompletion`       | `boolean?`                           | A flag indicating if `poll` should be called.                                                                     |
| `userId`                  | `string?`                            | The user ID of the authenticated user/user to authenticate.                                                       |
| `gridChallenge`           | `GridChallenge?`                     | Parameters required for completing the `GRID` authentication method.                                              |
| `kbaChallenge`            | `KbaChallenge?`                      | Parameters required for completing the `KBA` authentication method.                                               |
| `faceChallenge`           | `FaceChallenge?`                     | Parameters required for completing the `FACE` authentication method.                                              |
| `tempAccessCodeChallenge` | `TempAccessCodeChallenge?`           | Parameters defining the behaviour of the `TEMP_ACCESS_CODE` authentication method.                                |
| `pushMutualChallenge`     | `string?`                            | Push authentication mutual challenge for token or Face Biometric.                                                 |
| `passkeyChallenge`        | `PublicKeyCredentialRequestOptions?` | The PublicKeyCredentialRequestOptions to be passed in the publicKey field to the navigator.credential.get() call. |

### `AuthenticationSubmissionParams`

| Property              | Type                  | Description                                                                                                                             |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `response`            | `string?`              | The user's response to the authentication challenge.                                                                                    |
| `kbaChallengeAnswers` | `string[]?`            | The user's answers to the KBA challenge questions. Answers must be in the order of the questions returned when requesting the challenge.|
| `passkeyResponse`     | `PublicKeyCredential?` | The second factor authenticator that will be used.                                                                                      |

---

## Related documentation

- [Overview](../index.md)
- [Quickstart](../quickstart.md)
- [OIDC Guide](../guides/oidc.md)
- [Risk-Based Authentication Guide](../guides/rba.md)
- [Convenience Auth Guide](../guides/auth.md)
- [Self-Hosted UI Examples](../self-hosted.md)
- [Troubleshooting](../troubleshooting.md)