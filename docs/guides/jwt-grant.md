# IDaaS JWT Grant Type

The IDaaS JWT grant type (`jwt_idaas`) is a custom OAuth 2.0 grant type specific to Entrust Identity as a Service. It enables applications to exchange an authenticated IDaaS session token (JWT) for standard OIDC tokens (ID token, access token, and optionally refresh token).

## Overview

The JWT grant type is used internally by the SDK when performing **in-app authentication** through the IDaaS Authentication API (also known as RBA - Risk-Based Authentication). This flow allows your application to present authentication challenges directly within your UI, rather than redirecting users to a hosted login page.

### Flow Comparison

| Flow Type       | Grant Type           | User Experience                       | Use Case                           |
| --------------- | -------------------- | ------------------------------------- | ---------------------------------- |
| **Hosted OIDC** | `authorization_code` | User redirects to IDaaS login page    | Standard web apps, SSO             |
| **In-App Auth** | `jwt_idaas`          | Authentication happens in your app UI | Custom UX, native-like experiences |

## How It Works

The JWT grant type flow involves these key steps:

### 1. Initialize JWT Authorization Request

The SDK calls the `/authorizejwt` endpoint (instead of the standard `/authorize` endpoint) to initiate a JWT-based authorization flow:

```typescript
// Generated internally by the SDK
const authUrl = `${issuerUrl}/authorizejwt`;
const params = {
  client_id: "your-client-id",
  scope: "openid profile email",
  code_challenge: "base64url-encoded-sha256-hash",
  code_challenge_method: "S256"
};
```

This returns an `authRequestKey` and `applicationId` used to track the authentication session.

### 2. Complete Authentication Challenge

The application presents authentication challenges to the user through the Authentication API:

```typescript
// Example: Password authentication
const response = await client.auth.password("user@example.com", "password123");

// Example: OTP authentication
const response = await client.auth.otp("user@example.com", {
  otpDeliveryType: "EMAIL"
});
```

Upon successful authentication, IDaaS issues a **session JWT** that represents the authenticated session.

### 3. Exchange JWT for OIDC Tokens

The SDK exchanges the session JWT for standard OIDC tokens using the `jwt_idaas` grant type:

```typescript
// Token exchange request (handled internally by SDK)
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=jwt_idaas
&client_id=your-client-id
&code=auth-request-key
&code_verifier=random-verifier-string
&jwt=eyJhbGciOiJSUzI1Ni...  // IDaaS session JWT
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1Ni...",
  "id_token": "eyJhbGciOiJSUzI1Ni...",
  "refresh_token": "rt_abc123...", // Optional
  "token_type": "Bearer",
  "expires_in": "3600",
  "scope": "openid profile email"
}
```

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

### Request Parameters

The `jwt_idaas` grant type requires these parameters:

| Parameter       | Description                                      | Required |
| --------------- | ------------------------------------------------ | -------- |
| `grant_type`    | Must be `"jwt_idaas"`                            | Yes      |
| `client_id`     | Your OIDC client identifier                      | Yes      |
| `code`          | The `authRequestKey` from `/authorizejwt`        | Yes      |
| `code_verifier` | PKCE code verifier (random string)               | Yes      |
| `jwt`           | IDaaS session JWT from successful authentication | Yes      |

### TypeScript Interface

```typescript
interface JwtIdaasTokenRequest {
  grant_type: "jwt_idaas";
  code: string;
  code_verifier: string;
  client_id: string;
  jwt: string;
}
```

### PKCE (Proof Key for Code Exchange)

Like the standard authorization code flow, the JWT grant type uses PKCE for security:

1. **Generate code verifier:** 43-128 character random string
2. **Create code challenge:** SHA-256 hash of verifier, base64url encoded
3. **Send challenge** with `/authorizejwt` request
4. **Send verifier** with token exchange request

This prevents authorization code interception attacks.

## Security Considerations

### JWT Validation

The IDaaS token endpoint validates:

- ✅ JWT signature using IDaaS private keys
- ✅ JWT issuer matches expected issuer
- ✅ JWT expiration (`exp` claim)
- ✅ `authRequestKey` matches the JWT's session
- ✅ PKCE code verifier matches the challenge

### Token Lifecycle

```
1. User authenticates → IDaaS session JWT (short-lived, ~5 minutes)
2. Exchange JWT → Access token (configurable, typically 1 hour)
3. Access token expires → Use refresh token (if enabled)
4. Refresh token expires → Re-authenticate
```

### Best Practices

1. **Never expose the session JWT** - It's handled internally by the SDK
2. **Use HTTPS** - All token exchanges must occur over TLS
3. **Enable refresh tokens** for better UX (reduces re-authentication frequency)
4. **Set appropriate token lifetimes** based on your security requirements

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
    storageType: "localstorage"
  },
  {
    scope: "openid profile email",
    useRefreshToken: true,
    audience: "https://api.yourapp.com"
  }
);

// Method 1: Using convenience methods (recommended)
try {
  await client.auth.password("user@example.com", "password123");

  // Tokens are now available
  const claims = client.getIdTokenClaims();
  const accessToken = await client.getAccessToken();

  console.log("Authenticated as:", claims.sub);
  console.log("Access token:", accessToken);
} catch (error) {
  console.error("Authentication failed:", error);
}

// Method 2: Using RBA client directly (more control)
try {
  // Step 1: Request challenge
  const { method, pollForCompletion } = await client.rba.requestChallenge({
    userId: "user@example.com",
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
  console.error("Authentication failed:", error);
}
```

### Multi-Factor Authentication (MFA)

```typescript
// Password + Second Factor (e.g., OTP)
try {
  const { method, secondFactorMethod } = await client.rba.requestChallenge({
    userId: "user@example.com",
    password: "user-password",
    preferredAuthenticationMethod: "PASSWORD_AND_SECONDFACTOR",
    otpOptions: {
      otpDeliveryType: "SMS"
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
  console.error("MFA failed:", error);
}
```

### Passwordless Authentication

```typescript
// Passkey (WebAuthn/FIDO2)
try {
  await client.auth.passkey("user@example.com");

  // Browser prompts for biometric/security key
  // Upon success, tokens are available
  const claims = client.getIdTokenClaims();
  console.log("Passwordless auth as:", claims.sub);
} catch (error) {
  console.error("Passkey authentication failed:", error);
}

// Magic Link
try {
  await client.auth.magicLink("user@example.com");

  // User receives email with magic link
  // After clicking link and completing flow, tokens are available
  const claims = client.getIdTokenClaims();
  console.log("Magic link auth as:", claims.sub);
} catch (error) {
  console.error("Magic link authentication failed:", error);
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
