# Core Concepts

Understand how the IDaaS Auth JS SDK is structured, how it manages configuration and tokens, and how to combine its clients for hosted and self-hosted experiences.

## IdaasClient

`IdaasClient` is the single entry point exported by the SDK.

```typescript
import { IdaasClient } from "idaas-auth-js";

const idaas = new IdaasClient({
  issuerUrl: "https://tenant.example.com",
  clientId: "spa-client",
  globalScope: "openid profile email",
  globalAudience: "https://api.example.com",
  storageType: "localstorage",
  globalUseRefreshToken: true,
});
```

### Facades

- **`idaas.oidc`** – Hosted OpenID Connect flows (login, logout, redirect handling).
- **`idaas.rba`** – Risk-Based Authentication transactions for self-hosted UIs.
- **`idaas.auth`** – Convenience wrappers (password, passkey, OTP, face, etc.) built on `rba`.

## Token storage

`StorageManager` orchestrates persistence. Choose the storage strategy when constructing the client:

| Mode                 | Backing store         | Use case                       |
| -------------------- | --------------------- | ------------------------------ |
| `"memory"` (default) | In-memory map         | SSR or ephemeral sessions.     |
| `"localstorage"`     | `window.localstorage` | Long-lived multi-tab sessions. |

Tokens are saved with an expiry timestamp. On every read, the manager removes expired entries. If `globalUseRefreshToken` is enabled (and the tenant issues refresh tokens), `getAccessToken()` will automatically exchange an expired access token for a new one.

### Clearing credentials

- `idaas.oidc.logout()` removes stored tokens and optionally redirects to a desired URL.
- `idaas.rba.cancel()` stops an active RBA transaction but does not clear tokens.

## Authentication lifecycle

1. **Initialize** `IdaasClient` with issuer/client metadata.
2. **Start a flow**:
   - Hosted: `idaas.oidc.login({ popup | redirect })`
   - RBA: `idaas.rba.requestChallenge({ ...options })`
   - Convenience: `idaas.auth.authenticatePassword(...)`, etc.
3. **Complete the flow**:
   - Hosted redirect: `idaas.oidc.handleRedirect()`
   - RBA: `idaas.rba.submitChallenge()` or `idaas.rba.poll()`
4. **Consume tokens**: `idaas.getAccessToken()`, `idaas.getIdTokenClaims()`.
5. **Sign out**:
   - Hosted: `idaas.oidc.logout`
   - RBA: `idaas.rba.logout`
   - Convenience: `idaas.auth.logout`

## OIDC flows

`OidcClient` encapsulates PKCE generation, authorization URL construction, popup/redirect handling, token exchange, and logout.

- `login(options)` – chooses popup or redirect based on `options.popup`.
- `handleRedirect()` – parses the authorization response (code, state) and finalizes the token exchange.
- `logout(options?)` – calls IDaaS logout endpoint and clears local tokens.

## Risk-Based Authentication

`RbaClient` manages challenge-based flows typically rendered by your own UI.

- `requestChallenge()` – initiates an authentication transaction and returns challenge metadata.
- `submitChallenge()` – submits user responses (OTP, passkey assertion, etc.).
- `poll()` – checks server status for asynchronous methods like push or face.
- `cancel()` – aborts the transaction.

`AuthenticationTransaction` responses include the `transactionId`, challenge type, and next-step instructions.

## Convenience Auth

`AuthClient` wraps common RBA patterns:

```typescript
await idaas.auth.authenticatePassword("user@example.com", "secret");
await idaas.auth.authenticateOtp("user@example.com", { otpDeliveryType: "SMS" });
await idaas.auth.authenticatePasskey();
await idaas.auth.authenticateSoftToken("user@example.com", { push: true });
await idaas.auth.authenticateFace("user@example.com", { mutualChallenge: true });
```

Each helper orchestrates the RBA sequence when it can (request → submit → poll) and returns the final `AuthenticationResponse`.
Some helpers still require a subsequent `idaas.auth.poll()` or `idaas.auth.submit()` call.

## Error handling

All public methods throw errors when the underlying REST call fails or when client-side validation fails.

- Use `try/catch` around login/auth flows.
- Inspect `error.code` or `error.response` (if present) for API-specific context.
- Popup flows can fail due to blocked popups; redirect flows require matching `redirectUri`s configured in IDaaS.

## Putting it together

```typescript
try {
  await idaas.oidc.login({ popup: true });
  const token = await idaas.getAccessToken();
  const claims = idaas.getIdTokenClaims();

} catch (err) {
  console.error("Authentication failed:", err);
}
```

Next, move to the [OIDC Guide](guides/oidc.md), [RBA Guide](guides/rba.md), or [Convenience Auth Guide](guides/auth.md) for deeper scenarios.