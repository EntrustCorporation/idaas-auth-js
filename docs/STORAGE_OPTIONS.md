# Token Storage Options Evaluation

**SDK Version:** 0.1.43  
**Last Updated:** November 9, 2025

This document evaluates current and potential token storage mechanisms for the IDaaS Auth JS SDK, analyzing security, persistence, performance, and browser compatibility.

---

## Table of Contents

- [Current Storage Options](#current-storage-options)
- [Alternative Storage Mechanisms](#alternative-storage-mechanisms)
- [Security Comparison](#security-comparison)
- [Storage Decision Matrix](#storage-decision-matrix)
- [Recommendations](#recommendations)
- [Implementation Considerations](#implementation-considerations)

---

## Current Storage Options

### 1. Memory Storage (Default) ✅ Implemented

**Implementation:** `src/storage/MemoryStore.ts`

**Characteristics:**

- **Persistence:** Session-only (lost on page refresh)
- **Scope:** Tab-specific
- **Capacity:** Limited by available RAM (practically unlimited for tokens)
- **Performance:** Fastest (no I/O)
- **Synchronous:** Yes

**Security:**

- ✅ **XSS Protection:** Highest - tokens never leave JavaScript runtime
- ✅ **CSRF Protection:** Not applicable (tokens not persisted)
- ✅ **Automatic Cleanup:** Immediate on page close

**Use Cases:**

- ✅ High-security applications
- ✅ Applications handling sensitive data
- ✅ Short-lived sessions
- ✅ Testing and development

**Limitations:**

- ❌ No persistence across page refreshes
- ❌ Requires re-authentication on refresh
- ❌ Poor UX for frequent page navigations

**Code Example:**

```typescript
const client = new IdaasClient({
  issuerUrl: "https://idaas.example.com",
  clientId: "my-spa",
  storageType: "memory" // Default
});
```

---

### 2. localStorage ✅ Implemented

**Implementation:** `src/storage/LocalStorageStore.ts`

**Characteristics:**

- **Persistence:** Long-term (until explicitly cleared)
- **Scope:** Origin-specific (shared across tabs)
- **Capacity:** 5-10 MB (browser-dependent)
- **Performance:** Synchronous disk I/O (slower than memory)
- **Synchronous:** Yes

**Security:**

- ⚠️ **XSS Protection:** Vulnerable - accessible to any script on same origin
- ✅ **CSRF Protection:** N/A (not accessible cross-origin)
- ❌ **Automatic Cleanup:** Manual cleanup required

**Use Cases:**

- ✅ Convenience over security applications
- ✅ Long-lived sessions
- ✅ Applications with low XSS risk
- ✅ Shared authentication across tabs

**Limitations:**

- ❌ Vulnerable to XSS attacks
- ❌ Limited capacity (5-10 MB)
- ❌ Synchronous API (blocks UI thread)
- ❌ No encryption at rest

**Code Example:**

```typescript
const client = new IdaasClient({
  issuerUrl: "https://idaas.example.com",
  clientId: "my-spa",
  storageType: "localstorage"
});
```

**Security Warning:** Documented in `docs/guides/security-best-practices.md`

---

## Alternative Storage Mechanisms

### 3. sessionStorage ⚡ Recommended for Implementation

**Status:** Not implemented (see [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md) #8)

**Characteristics:**

- **Persistence:** Session-only (cleared on tab close)
- **Scope:** Tab-specific (isolated per tab)
- **Capacity:** 5-10 MB (same as localStorage)
- **Performance:** Synchronous disk I/O
- **Synchronous:** Yes

**Security:**

- ⚠️ **XSS Protection:** Vulnerable (same as localStorage)
- ✅ **CSRF Protection:** N/A
- ✅ **Automatic Cleanup:** Cleared automatically on tab close

**Advantages over localStorage:**

- ✅ Tab isolation (different tokens per tab)
- ✅ Automatic cleanup on tab close
- ✅ Better for multi-account scenarios

**Disadvantages:**

- ❌ Still vulnerable to XSS
- ❌ Lost on tab close (not just page refresh)

**Use Cases:**

- ✅ Multi-account login (different tabs)
- ✅ Testing scenarios
- ✅ Temporary sessions with automatic cleanup
- ✅ Tab-isolated authentication

**Browser Support:** ✅ Universal (IE8+, all modern browsers)

**Implementation Effort:** Low (1-2 days) - Nearly identical to LocalStorageStore

**Recommended Priority:** Medium

---

### 4. IndexedDB ⚡ Recommended for Implementation

**Status:** Not implemented (see [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md) #4)

**Characteristics:**

- **Persistence:** Long-term (until explicitly cleared)
- **Scope:** Origin-specific (shared across tabs)
- **Capacity:** Large (250 MB - 2 GB+, browser-dependent)
- **Performance:** Asynchronous (non-blocking)
- **Synchronous:** No (Promise-based API)

**Security:**

- ⚠️ **XSS Protection:** Vulnerable (same as localStorage)
- ✅ **CSRF Protection:** N/A
- ❌ **Automatic Cleanup:** Manual cleanup required

**Advantages over localStorage:**

- ✅ Much larger capacity (hundreds of MB vs. 5-10 MB)
- ✅ Asynchronous API (doesn't block UI)
- ✅ Structured data storage (objects, not just strings)
- ✅ Better performance for large payloads
- ✅ Indexed queries (if needed for complex token management)

**Disadvantages:**

- ❌ Still vulnerable to XSS
- ❌ More complex API
- ❌ Async API requires code changes

**Use Cases:**

- ✅ Applications with large token payloads
- ✅ Complex token management scenarios
- ✅ Performance-sensitive applications
- ✅ Applications storing additional auth metadata

**Browser Support:** ✅ Universal (IE10+, all modern browsers)

**Implementation Effort:** Medium (2-3 weeks)

**Recommended Priority:** High (see FUTURE_ENHANCEMENTS.md #4)

**Code Example (Proposed):**

```typescript
const client = new IdaasClient({
  issuerUrl: "https://idaas.example.com",
  clientId: "my-spa",
  storageType: "indexeddb"
});
```

---

### 5. Encrypted Storage (WebCrypto API) 🔬 Research Needed

**Status:** Research phase (see [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md) #16)

**Concept:** Encrypt tokens at rest using WebCrypto API with key derived from user password or biometric authentication.

**Characteristics:**

- **Persistence:** Long-term (encrypted)
- **Scope:** Origin-specific
- **Capacity:** Depends on underlying storage (localStorage/IndexedDB)
- **Performance:** Slower (encryption/decryption overhead)
- **Synchronous:** Depends on underlying storage

**Security:**

- ✅ **XSS Protection:** Improved - attacker needs encryption key
- ✅ **Encryption at Rest:** Tokens encrypted in storage
- ⚠️ **Key Management:** Complex - where to store encryption key?

**Potential Implementation:**

```typescript
// Derive encryption key from user password
const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(userPassword),
  { name: "PBKDF2" },
  false,
  ["deriveBits", "deriveKey"]
);

const encryptionKey = await crypto.subtle.deriveKey(
  {
    name: "PBKDF2",
    salt: crypto.getRandomValues(new Uint8Array(16)),
    iterations: 100000,
    hash: "SHA-256"
  },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);

// Encrypt token before storing
const encryptedToken = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv: crypto.getRandomValues(new Uint8Array(12)) },
  encryptionKey,
  new TextEncoder().encode(token)
);

localStorage.setItem("encrypted_token", base64Encode(encryptedToken));
```

**Challenges:**

- ❌ **Key Management:** Where to store encryption key securely?
  - Derive from user password? (User must re-enter password after page refresh)
  - Store in memory? (Lost on page refresh)
  - Use biometric APIs? (Limited and non-standard)
- ❌ **User Experience:** May require password re-entry
- ❌ **Complexity:** Significant implementation and testing effort
- ❌ **Browser Compatibility:** WebCrypto API well-supported but complex

**Use Cases:**

- ✅ Extremely high-security applications
- ✅ Compliance with encryption-at-rest requirements
- ✅ Applications with user password entry flow

**Browser Support:** ✅ WebCrypto API universal (all modern browsers)

**Implementation Effort:** High (4-6 weeks)

**Recommended Priority:** Research (validate feasibility and UX before committing)

---

### 6. HTTP-Only Cookies ❌ Not Recommended for SPAs

**Status:** Not planned

**Characteristics:**

- **Persistence:** Configurable (session or long-term)
- **Scope:** Origin and path-specific
- **Capacity:** 4 KB per cookie
- **Performance:** Sent with every HTTP request (overhead)
- **Synchronous:** N/A (server-managed)

**Security:**

- ✅ **XSS Protection:** High - `HttpOnly` flag prevents JavaScript access
- ✅ **CSRF Protection:** Requires `SameSite` cookies and CSRF tokens
- ✅ **Secure Flag:** Enforces HTTPS

**Why Not Recommended for SPAs:**

- ❌ **Cannot be set from JavaScript:** Requires server-side cookie management
- ❌ **Not practical for SPAs:** SPAs run entirely in browser without backend
- ❌ **Backend required:** Would require proxy server just for cookie management
- ❌ **Sent with every request:** Bandwidth overhead for APIs that don't need auth
- ❌ **4 KB limit:** Too small for JWTs (especially with claims and multiple tokens)

**When to Consider:**

- Server-rendered applications with backend
- Backend-for-Frontend (BFF) architecture
- Applications with dedicated authentication proxy

**Assessment:** ❌ Not suitable for pure SPAs like this SDK targets

---

### 7. Service Workers / Cache API ❌ Not Recommended

**Status:** Not planned

**Characteristics:**

- **Persistence:** Long-term (until explicitly cleared)
- **Scope:** Origin-specific
- **Capacity:** Large (quota-based, typically GBs)
- **Performance:** Asynchronous

**Security:**

- ⚠️ **XSS Protection:** Vulnerable (accessible via JavaScript)
- ❌ **Complex Access Control:** Service workers have broad access

**Why Not Recommended:**

- ❌ **Not designed for sensitive data:** Cache API is for assets, not credentials
- ❌ **Security model unclear:** No additional XSS protection over IndexedDB
- ❌ **Overkill:** Service workers add complexity without security benefits
- ❌ **Browser compatibility:** Requires HTTPS and modern browser

**Assessment:** ❌ No advantages over IndexedDB for token storage

---

### 8. Web Crypto API + Secure Enclave (Native Apps) 🔬 Future Research

**Status:** Long-term research

**Concept:** Use platform-specific secure enclaves (iOS Keychain, Android Keystore, Windows Hello) via native app wrappers (Cordova, Capacitor, Electron).

**Characteristics:**

- **Persistence:** Long-term (hardware-backed)
- **Security:** Hardware-backed encryption
- **Platform:** Native mobile/desktop apps only

**Security:**

- ✅ **XSS Protection:** Highest - keys stored in hardware secure enclave
- ✅ **Hardware-backed:** TPM/Secure Enclave/TEE protection
- ✅ **Biometric unlocking:** FaceID, TouchID, Windows Hello

**Challenges:**

- ❌ **Not available in web browsers:** Requires native app wrapper
- ❌ **Platform-specific APIs:** Different implementations per OS
- ❌ **Out of scope:** SDK targets browser SPAs, not native apps

**Use Cases:**

- Native mobile apps (Cordova, Capacitor)
- Desktop Electron apps
- Hybrid applications

**Assessment:** ⚠️ Out of scope for browser-based SDK (consider for future native SDK)

---

## Security Comparison

| Storage                | XSS Protection | Persistence  | Tab Scope    | Capacity  | Performance     | Complexity |
| ---------------------- | -------------- | ------------ | ------------ | --------- | --------------- | ---------- |
| **Memory**             | ✅ Highest     | ❌ None      | Tab-specific | Unlimited | ⚡ Fastest      | ✅ Simple  |
| **sessionStorage**     | ⚠️ Vulnerable  | ⚠️ Session   | Tab-specific | 5-10 MB   | Fast            | ✅ Simple  |
| **localStorage**       | ⚠️ Vulnerable  | ✅ Long-term | Shared       | 5-10 MB   | Fast            | ✅ Simple  |
| **IndexedDB**          | ⚠️ Vulnerable  | ✅ Long-term | Shared       | 250 MB+   | ⚡ Fast (async) | ⚠️ Medium  |
| **Encrypted**          | ✅ Improved\*  | ✅ Long-term | Shared       | Depends   | Slower          | ❌ Complex |
| **Cookies (HttpOnly)** | ✅ High        | Configurable | Shared       | 4 KB      | Slow (overhead) | ❌ Complex |
| **Secure Enclave**     | ✅ Highest     | ✅ Long-term | Shared       | Small     | Fast            | ❌ Complex |

\*Encrypted storage still vulnerable to XSS if encryption key is accessible

---

## Storage Decision Matrix

### Decision Tree

```
┌─────────────────────────────────────┐
│ Do you need persistence across     │
│ page refreshes?                     │
└────────────┬────────────────────────┘
             │
       ┌─────┴─────┐
      NO           YES
       │             │
       ▼             ▼
  ┌─────────┐  ┌─────────────────────────────┐
  │ MEMORY  │  │ Do you need tab isolation?  │
  └─────────┘  └──────────┬──────────────────┘
                          │
                    ┌─────┴─────┐
                   YES          NO
                    │            │
                    ▼            ▼
            ┌──────────────┐  ┌────────────────────────────┐
            │sessionStorage│  │ Do you have large payloads │
            └──────────────┘  │ or need async I/O?         │
                              └──────────┬─────────────────┘
                                        │
                                  ┌─────┴─────┐
                                 YES          NO
                                  │            │
                                  ▼            ▼
                          ┌──────────────┐ ┌──────────────┐
                          │  IndexedDB   │ │ localStorage │
                          └──────────────┘ └──────────────┘
```

### Use Case Recommendations

| Use Case                | Recommended Storage            | Rationale                                       |
| ----------------------- | ------------------------------ | ----------------------------------------------- |
| Banking/Finance app     | Memory                         | Highest security, re-auth on refresh acceptable |
| Healthcare app          | Memory or Encrypted            | HIPAA compliance, sensitive data                |
| E-commerce app          | localStorage or sessionStorage | Convenience, lower security risk                |
| Internal enterprise app | localStorage or IndexedDB      | Productivity, controlled environment            |
| Social media app        | localStorage                   | Long sessions, UX-focused                       |
| Multi-account testing   | sessionStorage                 | Tab isolation                                   |
| Large token payloads    | IndexedDB                      | Capacity and performance                        |
| Short-lived sessions    | Memory                         | Automatic cleanup                               |

---

## Recommendations

### Priority 1: Implement sessionStorage ⚡

**Effort:** Low (1-2 days)  
**Benefits:** Tab isolation, automatic cleanup  
**Use Cases:** Multi-account, testing, temporary sessions

**Implementation:**

- Copy `LocalStorageStore.ts` → `SessionStorageStore.ts`
- Change `window.localStorage` → `window.sessionStorage`
- Add to `storageType` union in `IdaasClientOptions`
- Update documentation

---

### Priority 2: Implement IndexedDB ⚡

**Effort:** Medium (2-3 weeks)  
**Benefits:** Large capacity, async API, better performance  
**Use Cases:** Large payloads, performance-sensitive apps

**Implementation:**

- Create `IndexedDBStore.ts` implementing `TokenStore` interface
- Use async methods throughout
- Add tests for initialization, CRUD operations, edge cases
- Update documentation with migration guide

---

### Priority 3: Research Encrypted Storage 🔬

**Effort:** High (4-6 weeks research + implementation)  
**Benefits:** Enhanced XSS protection  
**Challenges:** Key management, UX impact

**Research Phase:**

1. Evaluate key derivation strategies (password, biometric, session)
2. Prototype UX flows
3. Assess performance impact
4. Validate security improvements vs. complexity cost
5. Decision: Implement, defer, or reject

---

### Not Recommended

- ❌ **HTTP-Only Cookies:** Not practical for SPAs
- ❌ **Service Workers/Cache API:** No security benefits over IndexedDB
- ❌ **Secure Enclave:** Out of scope for web browsers

---

## Implementation Considerations

### Backward Compatibility

All new storage options must:

- Implement existing `TokenStore` interface
- Support seamless migration from existing storage
- Maintain existing API surface

### Migration Strategy

When adding new storage types:

1. **Non-breaking:** Add new storage type as option
2. **Documentation:** Explain use cases and tradeoffs
3. **Migration Helper:** Provide utility to migrate between storage types
4. **Testing:** Comprehensive tests for each storage implementation

**Example Migration Utility:**

```typescript
async function migrateStorage(from: TokenStore, to: TokenStore): Promise<void> {
  // Migrate access tokens
  const accessTokens = await from.getAllAccessTokens();
  for (const token of accessTokens) {
    await to.saveAccessToken(token);
  }

  // Migrate ID token
  const idToken = await from.getIdToken();
  if (idToken) {
    await to.saveIdToken(idToken);
  }

  // Migrate refresh token
  const refreshToken = await from.getRefreshToken();
  if (refreshToken) {
    await to.saveRefreshToken(refreshToken);
  }

  // Clear old storage
  await from.clear();
}
```

### Testing Requirements

Each storage implementation must have:

- ✅ Unit tests for all CRUD operations
- ✅ Error handling tests (storage full, quota exceeded, etc.)
- ✅ Browser compatibility tests
- ✅ Concurrent access tests (if shared across tabs)
- ✅ Performance benchmarks

### Documentation Requirements

Each storage option must document:

- ✅ Security characteristics (XSS vulnerability, persistence)
- ✅ Use cases and recommendations
- ✅ Browser compatibility
- ✅ Capacity limits
- ✅ Performance characteristics
- ✅ Migration guide from other storage types

---

## Summary

### Current State ✅

- **Memory Storage:** Best security, no persistence
- **localStorage:** Persistence with XSS risk

### Recommended Additions

1. **sessionStorage** (Priority: High) - Tab isolation, auto-cleanup
2. **IndexedDB** (Priority: High) - Large capacity, async performance

### Research Needed

- **Encrypted Storage** - Enhanced XSS protection, key management challenges

### Not Recommended

- HTTP-Only Cookies (requires backend)
- Service Workers (no security advantage)
- Secure Enclave (out of scope for web)

---

**Feedback:** Questions about storage options? [Open an issue](https://github.com/EntrustCorporation/idaas-auth-js/issues/new) with your use case.
