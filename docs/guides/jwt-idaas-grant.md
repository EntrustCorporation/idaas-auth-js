# JWT IDaaS Grant Type

The `jwt_idaas` grant type is a **custom OAuth 2.0 grant type** specific to Entrust Identity as a Service (IDaaS). It enables applications to exchange an authenticated IDaaS session token (JWT) for standard OIDC tokens (ID token, access token, and optionally refresh token).

> **Note:** This is a proprietary grant type, not defined in any OAuth 2.0 RFC. It is supported exclusively by IDaaS and should not be confused with the standard JWT Bearer Grant Type ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)).

## Overview

The `jwt_idaas` grant type is used internally by the SDK when performing **in-app authentication** (self-hosted UI) through the IDaaS Authentication API. This flow allows your application to present authentication challenges directly within your UI, rather than redirecting users to a hosted login page.

### Flow Comparison

| Flow Type       | Grant Type           | User Experience                       | Use Case                           |
| --------------- | -------------------- | ------------------------------------- | ---------------------------------- |
| **Hosted OIDC** | `authorization_code` | User redirects to IDaaS login page    | Standard web apps, SSO             |
| **In-App Auth** | `jwt_idaas`          | Authentication happens in your app UI | Custom UX, native-like experiences |

## Visual Flow Overview

```mermaid
sequenceDiagram
    participant App as Your Application
    participant SDK as IDaaS SDK
    participant AuthAPI as IDaaS Auth API
    participant TokenEP as IDaaS Token Endpoint

    Note over App,TokenEP: Step 1: Initialize JWT Authorization Flow
    App->>SDK: auth.password(userId, password)
    SDK->>SDK: Generate PKCE verifier + challenge
    SDK->>AuthAPI: POST /authorizejwt<br/>(client_id, scope, code_challenge)
    AuthAPI-->>SDK: authRequestKey, applicationId

    Note over App,TokenEP: Step 2: Request Authentication Challenge
    SDK->>AuthAPI: POST /authenticate/challenge/{method}<br/>(userId, authRequestKey, applicationId)
    AuthAPI->>AuthAPI: Evaluate risk<br/>Check Resource Rules
    AuthAPI-->>SDK: Challenge details<br/>(token, gridChallenge/kbaChallenge/fidoChallenge/etc.)

    Note over App,TokenEP: Step 3: Submit Challenge Response
    SDK->>AuthAPI: POST /authenticate/{method}<br/>(userId, password/OTP/response, authRequestKey)<br/>Authorization: Bearer {token}
    AuthAPI->>AuthAPI: Validate credentials<br/>Verify response
    AuthAPI-->>SDK: authenticationCompleted: true<br/>token: session JWT

    Note over App,TokenEP: Step 4: Exchange JWT for OIDC Tokens
    SDK->>TokenEP: POST /token<br/>(grant_type=jwt_idaas, jwt, code, code_verifier)
    TokenEP->>TokenEP: Validate JWT signature<br/>Verify PKCE<br/>Check authRequestKey
    TokenEP-->>SDK: access_token, id_token, refresh_token
    SDK-->>App: Authentication complete<br/>Tokens stored
```

## How It Works

The `jwt_idaas` grant type flow involves four key steps:

### 1. Initialize JWT Authorization Request

When you call an in-app authentication method, the SDK first calls the `/authorizejwt` endpoint (instead of the standard `/authorize` endpoint) to initiate a JWT-based authorization flow:

```typescript
// Generated internally by the SDK
POST https://your-tenant.trustedauth.com/authorizejwt
Content-Type: application/x-www-form-urlencoded

client_id=your-client-id
&scope=openid+profile+email
&code_challenge=base64url-encoded-sha256-hash
&code_challenge_method=S256
&nonce=random-nonce
&state=random-state
```

**Response:**

```json
{
  "authRequestKey": "QoOuQ3JyccbHqVJxUwHInxSPdn37nSJTgOMn6UE3Yi9c=",
  "applicationId": "dba4e3c6-f1f3-4d23-9088-fb452064c73f"
}
```

These values (`authRequestKey` and `applicationId`) are used to track the authentication session throughout the flow.

### 2. Request Authentication Challenge

The SDK first requests an authentication challenge from the Authentication API:

```typescript
// Request challenge for PASSWORD authentication
POST https://your-tenant.trustedauth.com/api/v1/authenticate/challenge/PASSWORD
Content-Type: application/json

{
  "userId": "user@example.com",
  "authRequestKey": "QoOuQ3JyccbHqVJxUwHInxSPdn37nSJTgOMn6UE3Yi9c=",
  "applicationId": "dba4e3c6-f1f3-4d23-9088-fb452064c73f"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "time": 1520967582294
}
```

For some authentication methods (GRID, KBA, FIDO/Passkey), the response includes challenge details (e.g., `gridChallenge`, `kbaChallenge`, `fidoChallenge`) that must be presented to the user.

**Note:** Some convenience methods like `password()` automatically proceed to Step 3 if the user's password is already provided.

### 3. Submit Challenge Response

The SDK then submits the user's authentication response:

```typescript
// Example: Password authentication
POST https://your-tenant.trustedauth.com/api/v1/authenticate/PASSWORD
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "userId": "user@example.com",
  "response": "password123",
  "authRequestKey": "QoOuQ3JyccbHqVJxUwHInxSPdn37nSJTgOMn6UE3Yi9c=",
  "applicationId": "dba4e3c6-f1f3-4d23-9088-fb452064c73f"
}
```

**Response:**

```json
{
  "authenticationCompleted": true,
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "time": 1520967582294
}
```

Upon successful authentication, IDaaS issues a **session JWT** (short-lived, typically 5 minutes) that represents the authenticated session. This JWT is what gets exchanged for OIDC tokens in the next step.

**Push-based methods** (TOKENPUSH, SMARTCREDENTIALPUSH, FACE) don't require explicit submission. Instead, the SDK polls for completion after the user approves the push notification or completes biometric authentication on their device.

### 4. Exchange JWT for OIDC Tokens

Finally, the SDK exchanges the session JWT for standard OIDC tokens using the `jwt_idaas` grant type:

```http
POST https://your-tenant.trustedauth.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=jwt_idaas
&client_id=your-client-id
&code=QoOuQ3JyccbHqVJxUwHInxSPdn37nSJTgOMn6UE3Yi9c=
&code_verifier=random-pkce-verifier-string
&jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rt_abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email"
}
```

The tokens are then stored by the SDK and made available to your application through methods like `getAccessToken()` and `getIdTokenClaims()`.

## When Is This Used?

The JWT grant type is automatically used when you call any of these SDK methods:

### Via RbaClient

```typescript
// Direct RBA flow
const response = await client.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "PASSWORD"
});

await client.rba.submitChallenge({
  response: "user-password"
});

await client.rba.poll(); // Exchanges JWT for OIDC tokens
```

### Via AuthClient (Convenience Methods)

```typescript
// Password authentication
await client.auth.password("user@example.com", "password123");

// OTP authentication
await client.auth.otp("user@example.com", { otpDeliveryType: "SMS" });

// Passkey authentication
await client.auth.passkey("user@example.com");

// Soft token with push
await client.auth.softToken("user@example.com", { push: true });

// Any other convenience method...
```

All these methods internally perform the JWT grant flow to obtain OIDC tokens.

## Technical Details

### Token Request Parameters

The `jwt_idaas` grant type requires these parameters when calling the token endpoint:

| Parameter       | Description                                         | Required | Example                                   |
| --------------- | --------------------------------------------------- | -------- | ----------------------------------------- |
| `grant_type`    | Must be `"jwt_idaas"` (literal string)              | Yes      | `jwt_idaas`                               |
| `client_id`     | Your OAuth 2.0 client identifier                    | Yes      | `dba4e3c6-f1f3-4d23-9088-fb452064c73f`    |
| `code`          | The `authRequestKey` returned from `/authorizejwt`  | Yes      | `QoOuQ3JyccbHqVJxUwHInxSPdn37nSJT...`     |
| `code_verifier` | PKCE code verifier (43-128 character random string) | Yes      | `random-pkce-verifier-string`             |
| `jwt`           | IDaaS session JWT from successful authentication    | Yes      | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` |

### TypeScript Interface

```typescript
interface JwtIdaasTokenRequest {
  grant_type: "jwt_idaas";
  code: string; // authRequestKey from /authorizejwt
  code_verifier: string; // PKCE verifier
  client_id: string; // OAuth client ID
  jwt: string; // Session JWT from authentication
}
```

### PKCE (Proof Key for Code Exchange)

Like the standard authorization code flow, the JWT grant type uses PKCE for security:

1. **Generate code verifier:**
   - Generate 32 cryptographically secure random bytes using `window.crypto.getRandomValues()`
   - Base64url encode the bytes (resulting in a 43-character string)
   - This meets RFC 7636 requirements (43-128 characters, unreserved characters only)

2. **Create code challenge:**
   - Compute SHA-256 hash of the code verifier
   - Base64url encode the hash
   - Method: `S256` (SHA-256)

3. **Send challenge** with `/authorizejwt` request (includes `code_challenge` and `code_challenge_method=S256`)

4. **Send verifier** with token exchange request (the original random string, base64url encoded)

This prevents authorization code interception attacks by ensuring only the client that initiated the flow can exchange the authorization code for tokens.

## Security Considerations

> **🔒 See Also:** [Security Best Practices Guide](./security-best-practices.md) for comprehensive security guidance including token storage, credential handling, and authentication method security.

This section covers security aspects specific to the `jwt_idaas` grant type flow.

### JWT Validation

The IDaaS token endpoint validates the session JWT before issuing OIDC tokens:

- ✅ JWT signature using IDaaS private keys (RSA)
- ✅ JWT issuer matches expected issuer
- ✅ JWT expiration (`exp` claim - typically ~5 minutes)
- ✅ `authRequestKey` matches the JWT's session
- ✅ PKCE code verifier matches the original challenge

### Session JWT Security

The session JWT is a **short-lived bearer token** (~5 minutes) issued after successful authentication:

**Why it's critical:**

- Can be exchanged for long-lived access/refresh tokens within the 5-minute window
- If stolen, attacker gains full account access
- PKCE binding limits damage (requires original `code_verifier`)

**SDK Protection:**

- Session JWT handled internally, never exposed to your application code
- Automatically passed to token endpoint for exchange
- Cannot be reused after successful token exchange

### Authorization Code (`authRequestKey`) Security

The `authRequestKey` functions as an authorization code with these properties:

- **Single-use**: Invalidated after token exchange
- **Short-lived**: Expires with session JWT (~5 minutes)
- **PKCE-bound**: Requires matching `code_verifier`
- **Client-bound**: Cannot be used by different `client_id`

**Threat Prevention:**

- **Code interception** → PKCE prevents exchange without verifier
- **Code replay** → Single-use validation prevents reuse
- **Code substitution** → Binding to session prevents tampering

### Token Lifecycle Security

```
1. Authentication → Session JWT (5 min)
   Risk: If stolen, 5-minute window to exchange for tokens
   Mitigation: Short lifetime, PKCE binding

2. JWT Exchange → Access Token (1 hour)
   Risk: Bearer token, full API access
   Mitigation: Short lifetime, minimal scopes, audience validation

3. Token Refresh → New Access Token
   Risk: Refresh token is long-lived
   Mitigation: Automatic rotation, secure storage, revocation on logout

4. Token Expiry → Re-authenticate
   Security checkpoint: Forces user verification
```

### Best Practices

1. **Never log tokens**: Session JWT, access tokens, refresh tokens
2. **Use memory storage** for high-security apps (or localStorage with CSP)
3. **Enable refresh token rotation**: SDK handles automatically
4. **Implement proper logout**: Revokes refresh tokens server-side
5. **Use minimal scopes**: Request only what your application needs
6. **Specify audience**: Bind tokens to your specific API

For detailed security guidance, see the [Security Best Practices Guide](./security-best-practices.md).

## Differences from Standard OAuth 2.0 JWT Bearer Grant

The IDaaS `jwt_idaas` grant type is **not** the same as the standard OAuth 2.0 JWT Bearer Grant Type ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)):

| Feature           | `jwt_idaas` (IDaaS)                            | `urn:ietf:params:oauth:grant-type:jwt-bearer` (RFC 7523) |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------- |
| **Purpose**       | Exchange authenticated session for OIDC tokens | Assert identity using signed JWT from trusted issuer     |
| **JWT Issuer**    | IDaaS itself                                   | Third-party identity provider                            |
| **PKCE Required** | Yes                                            | No                                                       |
| **Use Case**      | In-app authentication flows                    | Service-to-service authentication, federation            |
| **Standardized**  | No (IDaaS-specific)                            | Yes (RFC 7523)                                           |

## Code Examples

### Complete In-App Authentication Flow

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const client = new IdaasClient(
  {
    issuerUrl: "https://your-tenant.trustedauth.com",
    clientId: "your-client-id",
    // 🔒 SECURITY: Use 'memory' for high-security apps to prevent XSS token theft
    // Use 'localstorage' only if you need persistence and have strong XSS protections (CSP)
    storageType: "memory" // or "localstorage"
  },
  {
    scope: "openid profile email",
    // 🔒 SECURITY: Enable refresh tokens for better UX, but consider security tradeoffs
    // Refresh tokens are long-lived and increase risk if stolen
    useRefreshToken: true,
    // 🔒 SECURITY: Specify audience to prevent token misuse across services
    audience: "https://api.yourapp.com"
  }
);

// Method 1: Using convenience methods (recommended)
try {
  const userId = getUserIdFromInput();
  const password = getUserPasswordFromInput();

  await client.auth.password(userId, password);

  // Tokens are now available
  const claims = client.getIdTokenClaims();
  const accessToken = await client.getAccessToken();

  console.log("Authenticated as:", claims.sub);
} catch (error) {
  // 🔒 SECURITY: Don't expose sensitive error details to users
  console.error("Authentication failed"); // Generic message for user
  // Log detailed errors server-side for debugging
  logToSecureAuditSystem(error);
}

// Method 2: Using RBA client directly (more control)
try {
  // Step 1: Request challenge
  const userId = getUserIdFromInput();

  const { method, pollForCompletion } = await client.rba.requestChallenge({
    userId,
    preferredAuthenticationMethod: "OTP",
    otpOptions: {
      otpDeliveryType: "EMAIL"
    }
  });

  console.log("Authentication method:", method);

  // Step 2: User enters OTP code
  const otpCode = await promptUserForOTP(); // Your UI logic

  // Step 3: Submit OTP
  await client.rba.submitChallenge({
    response: otpCode
  });

  // Step 4: Poll for completion (exchanges JWT for tokens)
  if (pollForCompletion) {
    await client.rba.poll();
  }

  // Tokens are now available
  const claims = client.getIdTokenClaims();
  console.log("Authenticated as:", claims.sub);
} catch (error) {
  // 🔒 SECURITY: Don't expose sensitive error details to users
  console.error("Authentication failed"); // Generic message for user
  // Log detailed errors server-side for debugging
  logToSecureAuditSystem(error);
}
```

### Multi-Factor Authentication (MFA)

```typescript
// Password + Second Factor (e.g., OTP)
try {
  // 🔒 SECURITY: MFA significantly improves security by requiring multiple authentication factors
  const userId = getUserIdFromInput();
  const password = getUserPasswordFromInput();

  const { method, secondFactorMethod } = await client.rba.requestChallenge({
    userId,
    password,
    preferredAuthenticationMethod: "PASSWORD_AND_SECONDFACTOR",
    otpOptions: {
      otpDeliveryType: "SMS" // Consider authenticator apps over SMS for better security
    }
  });

  console.log("Primary method:", method); // "PASSWORD"
  console.log("Second factor:", secondFactorMethod); // "OTP"

  // User enters OTP code
  const otpCode = await promptUserForOTP();

  // Submit second factor
  await client.rba.submitChallenge({
    response: otpCode
  });

  await client.rba.poll();

  // MFA complete - tokens available
  const claims = client.getIdTokenClaims();
  console.log("MFA authenticated as:", claims.sub);
} catch (error) {
  // 🔒 SECURITY: Don't expose sensitive error details to users
  console.error("Authentication failed"); // Generic message for user
  // Log detailed errors server-side for debugging
  logToSecureAuditSystem(error);
}
```

### Passwordless Authentication

```typescript
// Passkey (WebAuthn/FIDO2)
try {
  // 🔒 SECURITY: Passkeys provide phishing-resistant authentication
  // Most secure option - uses device biometrics or security keys
  const userId = getUserIdFromInput();
  await client.auth.passkey(userId);

  // Browser prompts for biometric/security key
  // Upon success, tokens are available
  const claims = client.getIdTokenClaims();
  console.log("Passwordless auth as:", claims.sub);
} catch (error) {
  console.error("Passkey authentication failed");
}

// Magic Link
try {
  // 🔒 SECURITY: Magic links are convenient but have security considerations:
  // - Email delivery may be insecure (SMTP)
  // - Links in email can be intercepted or forwarded
  // - Consider short expiration times (5-15 minutes)
  const userId = getUserIdFromInput();
  await client.auth.magicLink(userId);

  // User receives email with magic link
  // After clicking link and completing flow, tokens are available
  const claims = client.getIdTokenClaims();
  console.log("Magic link auth as:", claims.sub);
} catch (error) {
  console.error("Magic link authentication failed");
}
```

## Troubleshooting

### "failed to fetch id token and access token from IDaaS"

**Cause:** The JWT exchange failed, possibly due to:

- Expired session JWT
- Invalid PKCE verifier
- Mismatched `authRequestKey`

**Solution:**

- Ensure authentication completes within the session timeout (typically 5 minutes)
- Don't modify SDK internals (PKCE is handled automatically)
- Check IDaaS server logs for detailed error messages

### "IDaaS token not stored"

**Cause:** Attempting to exchange tokens before authentication completes.

**Solution:**

- Ensure you call `submitChallenge()` and/or `poll()` after requesting the challenge
- Verify authentication actually succeeded (check response status)

### "Jwt parameters not initialized"

**Cause:** Calling token exchange before calling `requestChallenge()`.

**Solution:**

- Always call `requestChallenge()` first to initialize the JWT flow
- Follow the proper sequence: request → submit → poll

## Related Documentation

- [RBA Guide](./rba.md) - Complete RBA authentication guide
- [Convenience Auth Guide](./auth.md) - Using AuthClient methods
- [OIDC Guide](./oidc.md) - Standard hosted authentication flow
- [API Reference](../api/README.md) - Complete API documentation

## Additional Resources

- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) - OAuth 2.0 framework
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) - PKCE specification
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) - OIDC specification
