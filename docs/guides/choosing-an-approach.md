# Choosing an Authentication Approach

When integrating the IDaaS Auth JS SDK, you have three main approaches to implement authentication: **OIDC** (hosted), **RBA** (risk-based with self-hosted UI), and **Convenience Auth** (simplified self-hosted). This guide helps you understand when to use each approach based on your requirements.

## Quick Decision Matrix

| Question                          | OIDC   | RBA    | Convenience Auth |
| --------------------------------- | ------ | ------ | ---------------- |
| Do you want IDaaS to host the UI? | ✅ Yes | ❌ No  | ❌ No            |
| Need custom UI/branding?          | ❌ No  | ✅ Yes | ✅ Yes           |
| Using Risk-based Resource Rules?  | ✅ Yes | ✅ Yes | ❌ No            |
| Fixed authentication method?      | Maybe  | ❌ No  | ✅ Yes           |
| Need full transaction control?    | ❌ No  | ✅ Yes | ⚠️ Limited       |
| Want simplified implementation?   | ✅ Yes | ❌ No  | ✅ Yes           |

---

## Approach 1: OIDC (Hosted Authentication)

### What is it?

The OIDC approach uses IDaaS's hosted login pages for authentication. Users are redirected (or shown a popup) to IDaaS-managed UI where they authenticate. After successful authentication, they're returned to your application with tokens.

### When to use OIDC

✅ **Use OIDC when:**

- You want to get authentication working quickly without building UI
- You're comfortable with IDaaS-managed login pages and branding
- You want IDaaS to handle the user experience for authentication
- You're implementing Single Sign-On (SSO) across multiple applications
- You don't need to customize every aspect of the authentication flow
- You want to leverage IDaaS's full authentication policy engine through the hosted UI

❌ **Don't use OIDC when:**

- You require complete control over the authentication UI/UX
- Your application needs to stay within a single page (no redirects/popups)
- You need to display transaction context during authentication
- Your branding requirements can't be met by IDaaS's customization options

### Example Code

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const client = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com/api/oidc",
  clientId: "your-client-id",
  storageType: "localstorage"
});

// Popup-based login
await client.oidc.login({
  popup: true,
  redirectUri: "https://yourapp.com/callback"
});

// Or redirect-based login
await client.oidc.login({
  popup: false,
  redirectUri: "https://yourapp.com/callback"
});

// In your callback page
await client.oidc.handleRedirect();

// Use tokens
const claims = client.getIdTokenClaims();
const accessToken = await client.getAccessToken();
```

### Key Characteristics

- **User Experience:** Users see IDaaS-hosted login pages
- **Customization:** Limited to IDaaS branding options
- **Implementation Effort:** Low - just a few lines of code
- **Use Case:** Standard authentication, SSO, minimal customization needs

---

## Approach 2: RBA (Risk-Based Authentication)

### What is it?

The RBA approach leverages IDaaS's **Resource Rules** to perform risk evaluation and dynamically determine which authentication methods are appropriate based on context (user, device, location, transaction details, etc.). Your application builds the UI but IDaaS decides which authenticators to present based on risk assessment.

### Understanding Resource Rules

Resource Rules are configured in IDaaS to evaluate risk and determine authentication requirements. They consider factors like:

- **User attributes** (role, department, risk profile)
- **Device context** (trusted device, new device, location)
- **Transaction details** (amount, type, sensitivity)
- **Environmental factors** (IP address, time of day, geolocation)
- **Historical behavior** (typical login patterns, velocity)

Based on this evaluation, IDaaS responds with the authentication methods that can be used, which may include:

- Single-factor authentication for low-risk scenarios
- Multi-factor authentication for medium-risk scenarios
- Specific strong authenticators for high-risk scenarios
- Blocking authentication for unacceptable risk

### When to use RBA

✅ **Use RBA when:**

- You have **Resource Rules configured in IDaaS** for risk evaluation
- You need **dynamic risk-based authentication** that adapts to context
- You want **custom UI** but still leverage IDaaS's risk engine
- Your application needs to **display transaction context** during authentication
- You need **step-up authentication** based on the operation being performed
- You want to collect and send **transaction details** for risk assessment
- You need **full control** over the authentication flow and challenge presentation

❌ **Don't use RBA when:**

- You don't have Resource Rules configured (use Convenience Auth instead)
- You want a fixed authentication method that never changes
- You prefer hosted UI (use OIDC instead)
- You don't need risk evaluation capabilities

### Example Code

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const client = new IdaasClient(
  {
    issuerUrl: "https://example.trustedauth.com/api/oidc",
    clientId: "your-client-id",
    storageType: "localstorage"
  },
  {
    scope: "openid profile email",
    useRefreshToken: true
  }
);

// Request authentication with risk context
const response = await client.rba.requestChallenge({
  userId: "user@example.com",
  preferredAuthenticationMethod: "PASSWORD",
  transactionDetails: [
    {
      detail: "IP_ADDRESS",
      value: "192.168.1.100",
      usage: ["RBA", "TVS"]
    },
    {
      detail: "TRANSACTION_AMOUNT",
      value: "5000.00",
      usage: ["TVS"]
    },
    {
      detail: "DEVICE_ID",
      value: "device-fingerprint-12345",
      usage: ["RBA"]
    }
  ]
});

// IDaaS evaluates risk and returns the method to use
console.log("Authentication method:", response.method);
console.log("Requires second factor:", response.secondFactorMethod);

// Submit user's response
if (response.method === "PASSWORD") {
  await client.rba.submitChallenge({
    response: userPassword
  });
}

// If async method (e.g., push notification)
if (response.pollForCompletion) {
  await client.rba.poll();
}

// Tokens are now available
const claims = client.getIdTokenClaims();
```

### Transaction Details for RBA

Transaction details are key to risk assessment. Common details include:

| Detail Type          | Example Value   | Usage     | Purpose                |
| -------------------- | --------------- | --------- | ---------------------- |
| `TRANSACTION_AMOUNT` | `5000.00`       | `["TVS"]` | Transaction value risk |
| `TRANSACTION_TYPE`   | `WIRE_TRANSFER` | `["TVS"]` | Operation sensitivity  |

**Usage values:**

- `RBA` - Used for risk-based authentication decision-making
- `TVS` - Displayed in Transaction Verification Screen (if applicable)

### Key Characteristics

- **User Experience:** Custom UI in your application
- **Authentication Logic:** Dynamic, determined by IDaaS Resource Rules
- **Implementation Effort:** Medium - requires UI development and transaction context
- **Use Case:** Risk-aware applications, transaction approval, step-up authentication

---

## Approach 3: Convenience Auth (Fixed Authentication Methods)

### What is it?

The Convenience Auth approach provides simplified helper methods for specific authentication types. This is best when you **use Resource Rules with a fixed authentication method** in IDaaS (e.g., always require password + OTP, always use passkey, etc.).

### When to use Convenience Auth

✅ **Use Convenience Auth when:**

- You've configured a **fixed authentication method** in your IDaaS Resource Rules
- You want **custom UI** without the complexity of the full RBA flow
- Your authentication requirements are **predictable and don't vary by context**
- You want **simplified code** with method-specific helpers
- You don't need to send transaction details for risk evaluation

❌ **Don't use Convenience Auth when:**

- You have Resource Rules and need dynamic risk-based authentication (use RBA instead)
- You want hosted UI (use OIDC instead)
- You need full control over transaction lifecycle (use RBA instead)

### Example Code

```typescript
import { IdaasClient } from "@entrustcorp/idaas-auth-js";

const client = new IdaasClient({
  issuerUrl: "https://example.trustedauth.com/api/oidc",
  clientId: "your-client-id",
  storageType: "localstorage"
});

// Password authentication (fixed method)
await client.auth.password("user@example.com", "password123");

// OTP authentication (fixed method)
await client.auth.otp("user@example.com", {
  otpDeliveryType: "EMAIL"
});
await client.auth.submit({ response: userOtpCode });

// Passkey authentication (fixed method)
await client.auth.passkey("user@example.com");

// Soft token with push (fixed method)
await client.auth.softToken("user@example.com", {
  push: true,
  mutualChallenge: true
});
await client.auth.poll();

// Magic link (fixed method)
await client.auth.magicLink("user@example.com");

// Tokens are now available
const claims = client.getIdTokenClaims();
```

### Available Convenience Methods

- `client.auth.password(userId, password)` - Password authentication
- `client.auth.otp(userId, options)` - One-time password
- `client.auth.passkey(userId?)` - WebAuthn/FIDO2 passkey
- `client.auth.softToken(userId, options)` - Soft token (TOTP or push)
- `client.auth.grid(userId)` - Grid card authentication
- `client.auth.kba(userId)` - Knowledge-based authentication
- `client.auth.tempAccessCode(userId, code)` - Temporary access code
- `client.auth.magicLink(userId)` - Magic link authentication
- `client.auth.smartCredential(userId, options)` - Smart credential push
- `client.auth.faceBiometric(userId, options)` - Face biometric authentication

### Key Characteristics

- **User Experience:** Custom UI in your application
- **Authentication Logic:** Fixed, predetermined by IDaaS application configuration
- **Implementation Effort:** Low to medium - simpler than RBA but requires UI
- **Use Case:** Simple applications, fixed authentication policies, no risk evaluation

---

## Real-World Scenarios

### Scenario 1: E-commerce Website

**Requirements:**

- Quick implementation
- Standard login experience
- SSO with marketing site
- Don't need custom branding

**Recommended Approach:** **OIDC**

Users are redirected to IDaaS for login, then back to your site. Simple and fast to implement.

---

### Scenario 2: Banking Application

**Requirements:**

- Custom branded UI
- Risk-based authentication (location, device, transaction amount)
- Show transaction details during authentication
- Step-up auth for wire transfers
- Resource Rules configured to evaluate risk

**Recommended Approach:** **RBA**

Full control over UI, leverage Resource Rules for risk assessment, send transaction context, receive dynamic authentication requirements.

---

### Scenario 3: Internal Corporate Portal

**Requirements:**

- Custom UI matching corporate design
- All employees use password + Entrust soft token push
- Authentication method never changes
- No risk evaluation needed

**Recommended Approach:** **Convenience Auth**

Fixed authentication flow with simplified implementation. Use `client.auth.password()` followed by `client.auth.softToken()`.

---

### Scenario 4: Consumer Mobile App (PWA)

**Requirements:**

- Passwordless authentication
- Always use passkey (WebAuthn)
- Custom mobile-optimized UI
- No risk evaluation

**Recommended Approach:** **Convenience Auth**

Use `client.auth.passkey()` for simple, fixed passwordless authentication with full UI control.

---

### Scenario 5: Healthcare Portal

**Requirements:**

- Risk-based authentication (location, device trust, patient data access)
- Custom UI for HIPAA compliance branding
- Different auth requirements based on user role and accessed data
- Transaction details displayed to users
- Resource Rules configured for healthcare compliance

**Recommended Approach:** **RBA**

Dynamic authentication based on risk, transaction context visible to users, full control over compliance-required UI elements.

---

## Summary

Choose your approach based on three key questions:

1. **Do you need custom UI?**
   - No → **OIDC**
   - Yes → Continue to question 2

2. **Do you have Resource Rules configured for risk evaluation?**
   - Yes → **RBA**
   - No → Continue to question 3

3. **Is your authentication method fixed or dynamic?**
   - Fixed → **Convenience Auth**
   - Dynamic → Configure Resource Rules and use **RBA**

---

## Additional Resources

- [OIDC Guide](./oidc.md) - Complete guide to hosted authentication
- [RBA Guide](./rba.md) - Risk-based authentication deep dive
- [Convenience Auth Guide](./auth.md) - Simplified authentication methods
- [Self-Hosted UI Examples](../self-hosted.md) - Code examples for each authentication type
- [JWT IDaaS Grant Type](./jwt-idaas-grant.md) - Understanding the token exchange flow
- [API Reference](../api/README.md) - Complete SDK documentation
