[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [IdaasClient](../README.md) / IdaasClient

# Class: IdaasClient

The main client class for interacting with IDaaS authentication services.
Provides methods for OIDC authentication flows and RBA challenge handling.

## Constructors

### Constructor

> **new IdaasClient**(`options`, `tokenOptions?`): `IdaasClient`

Creates a new IdaasClient instance for handling OIDC authentication flows.

#### Parameters

##### options

[`IdaasClientOptions`](../../index/interfaces/IdaasClientOptions.md)

Configuration options for the client including issuer URL, client ID, and storage type

##### tokenOptions?

[`TokenOptions`](../../index/interfaces/TokenOptions.md) = `{}`

Default token options including audience, scope, and refresh token settings

#### Returns

`IdaasClient`

## Accessors

### auth

#### Get Signature

> **get** **auth**(): [`AuthClient`](../../AuthClient/classes/AuthClient.md)

Provides access to self-hosted auth convenience methods.

Use these simplified helpers when you want custom UI but have a fixed authentication method
configured in IDaaS (not using Resource Rules for risk-based decisions).

Available methods:

- `password(userId, password)` - Password authentication
- `softToken(userId, options?)` - Soft token (TOTP or push)
- `grid(userId)` - Grid card authentication
- `passkey(userId?)` - WebAuthn/FIDO2 passkey (omit userId for discoverable credentials)
- `kba(userId)` - Knowledge-based authentication
- `tempAccessCode(userId, code)` - Temporary access code
- `otp(userId, options?)` - One-time password
- `smartCredential(userId, options?)` - Smart credential push
- `faceBiometric(userId, options?)` - Face biometric authentication
- `magicLink(userId)` - Magic link authentication
- `submit(params?)` - Submit challenge response
- `poll()` - Poll for completion
- `cancel()` - Cancel authentication
- `logout()` - End session

**Note:** Almost every convenience helper expects `userId` as the first argument.

##### See

[Convenience Auth Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/auth.md)

##### Returns

[`AuthClient`](../../AuthClient/classes/AuthClient.md)

---

### oidc

#### Get Signature

> **get** **oidc**(): [`OidcClient`](../../OidcClient/classes/OidcClient.md)

Provides access to IDaaS hosted OIDC methods.

Use this when you want Entrust to host the entire login UI. It handles PKCE, redirects, and logout
for a quick hosted authentication experience.

Available methods:

- `login(options?, tokenOptions?)` - Initiate login via redirect or popup
- `logout(options?)` - Log user out with optional redirect
- `handleRedirect()` - Process OAuth callback after redirect

##### See

[OIDC Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md)

##### Returns

[`OidcClient`](../../OidcClient/classes/OidcClient.md)

---

### rba

#### Get Signature

> **get** **rba**(): [`RbaClient`](../../RbaClient/classes/RbaClient.md)

Provides access to self-hosted Risk-Based Authentication (RBA) methods.

Use this when building your own UI and need full control over multi-factor and risk-based challenges.
Requires Resource Rules to be configured in IDaaS for risk evaluation.

Available methods:

- `requestChallenge(params?, tokenOptions?)` - Request authentication challenge with risk evaluation
- `submitChallenge(params)` - Submit user response to challenge
- `poll()` - Poll for asynchronous authentication completion
- `cancel()` - Cancel ongoing authentication
- `logout()` - End user session

**Note:** Supply the user's identifier (`userId`) in `AuthenticationRequestParams` unless the
authenticator explicitly allows anonymous flows (e.g., passkey with discoverable credentials).

##### See

[RBA Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/rba.md)

##### Returns

[`RbaClient`](../../RbaClient/classes/RbaClient.md)

## Methods

### getAccessToken()

> **getAccessToken**(`options?`): `Promise`\<`string` \| `null`\>

Retrieves a cached access token matching the specified criteria.

If the token is expired and a refresh token is available (subject to tenant configuration),
the SDK automatically performs a token refresh.

#### Parameters

##### options?

[`TokenOptions`](../../index/interfaces/TokenOptions.md) = `{}`

Token options to match (audience, scope, acrValues)

#### Returns

`Promise`\<`string` \| `null`\>

Access token string, or `null` when no matching session exists

#### Throws

Error if the refresh/token exchange fails

---

### getIdTokenClaims()

> **getIdTokenClaims**(): [`UserClaims`](../../index/interfaces/UserClaims.md) \| `null`

Retrieves decoded ID token claims containing user information.

The ID token is a JWT that contains standard OIDC claims about the authenticated user
such as `sub` (subject/user ID), `email`, `name`, etc.

#### Returns

[`UserClaims`](../../index/interfaces/UserClaims.md) \| `null`

Decoded ID token claims, or `null` if no ID token exists

---

### getUserInfo()

> **getUserInfo**(`accessToken?`): `Promise`\<[`UserClaims`](../../index/interfaces/UserClaims.md) \| `null`\>

Retrieves user claims from the OpenID Provider using the userinfo endpoint.

This method fetches fresh user information from the identity provider, as opposed to
`getIdTokenClaims()` which returns cached claims from the ID token.

#### Parameters

##### accessToken?

`string`

Optional access token to use. When provided, its scopes determine the claims
returned from the userinfo endpoint. If not provided, the access token with default scopes and
audience will be used if available.

#### Returns

`Promise`\<[`UserClaims`](../../index/interfaces/UserClaims.md) \| `null`\>

User claims from the OpenID Provider, or `null` if unavailable

---

### isAuthenticated()

> **isAuthenticated**(): `boolean`

Checks if the user is currently authenticated by verifying the presence of a valid ID token.

#### Returns

`boolean`

`true` when an ID token exists, `false` otherwise

---

### stepUp()

> **stepUp**(`response`, `options?`): `Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Handles an OAuth 2.0 step-up authentication challenge per RFC 9470.

When a protected resource returns an HTTP response with a `WWW-Authenticate: Bearer`
header containing `error="insufficient_user_authentication"` (RFC 9470) or
`error="insufficient_scope"` (RFC 6750), this method parses the challenge and initiates
the appropriate authentication flow to obtain a new access token that satisfies the
resource's requirements.

The method automatically:

1. Extracts `acr_values`, `max_age`, and `scope` from the `WWW-Authenticate` header
2. Uses the authenticated user's ID (from the stored ID token) to request a challenge
3. If the authenticator supports polling (e.g., push notification, magic link), polls until completion and returns the final result
4. Otherwise, returns the [AuthenticationResponse](../../index/interfaces/AuthenticationResponse.md) so you can present the challenge to the user and call `rba.submitChallenge()` / `rba.poll()`

#### Parameters

##### response

`Response`

The HTTP response from the protected resource containing the `WWW-Authenticate` header

##### options?

[`StepUpOptions`](../../index/interfaces/StepUpOptions.md) = `{}`

Optional parameters to customize the authentication challenge request

#### Returns

`Promise`\<[`AuthenticationResponse`](../../index/interfaces/AuthenticationResponse.md)\>

Authentication response — either the final result (for poll-based flows) or the challenge details (for interactive flows)

#### Throws

If the response has no `WWW-Authenticate` header

#### Throws

If the `WWW-Authenticate` header does not indicate a step-up challenge

#### Throws

If the user is not authenticated (no stored ID token with a `sub` claim)

#### Example

```typescript
const apiResponse = await fetch("https://api.example.com/protected", {
  headers: { Authorization: `Bearer ${accessToken}` }
});

if (apiResponse.status === 401) {
  const result = await client.stepUp(apiResponse);

  if (!result.authenticationCompleted) {
    // Interactive authenticator — present challenge to user, then submit
    await client.rba.submitChallenge({ response: userInput });
  }

  // Retry the original request with the new access token
  const newToken = await client.getAccessToken();
}
```

#### See

- [RFC 9470 — Step-Up Authentication Challenge Protocol](https://datatracker.ietf.org/doc/html/rfc9470)
- [RFC 6750 — Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
