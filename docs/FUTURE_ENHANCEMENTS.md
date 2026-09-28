# Future Enhancements Roadmap

**SDK Version:** 0.1.43  
**Last Updated:** November 9, 2025

This document outlines potential future enhancements for the IDaaS Auth JS SDK, organized by priority and category.

---

## Table of Contents

- [High Priority Enhancements](#high-priority-enhancements)
- [Medium Priority Enhancements](#medium-priority-enhancements)
- [Low Priority Enhancements](#low-priority-enhancements)
- [Research & Exploration](#research--exploration)
- [Implementation Guidelines](#implementation-guidelines)

---

## High Priority Enhancements

### 1. Pushed Authorization Requests (PAR) - RFC 9126

**Category:** Security  
**Effort:** Medium (2-3 weeks)  
**Priority:** High  
**Status:** Not Started

**Description:**  
Add support for Pushed Authorization Requests (PAR) to push authorization request parameters directly to the authorization server before redirecting the user.

**Benefits:**

- ✅ Enhanced security - request parameters encrypted in transit via back-channel
- ✅ Prevents parameter tampering and interception
- ✅ Reduces URL length issues with complex authorization requests
- ✅ Required for some high-security scenarios (e.g., FAPI compliance)

**Implementation Details:**

```typescript
// New method in OidcClient
private async pushAuthorizationRequest(params: AuthParams): Promise<string> {
  const config = await this.context.getConfig();

  if (!config.pushed_authorization_request_endpoint) {
    throw new Error('PAR not supported by issuer');
  }

  const response = await fetch(config.pushed_authorization_request_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  const { request_uri, expires_in } = await response.json();
  return request_uri;
}

// Usage in login()
const requestUri = await this.pushAuthorizationRequest(authParams);
const authUrl = `${config.authorization_endpoint}?client_id=${clientId}&request_uri=${requestUri}`;
```

**Configuration:**

```typescript
interface OidcLoginOptions {
  // ...
  usePAR?: boolean; // Default: auto-detect from discovery document
}
```

**Testing Requirements:**

- Unit tests for PAR request construction
- E2E tests with PAR-enabled test provider
- Fallback to standard authorization request if PAR unavailable

**References:**

- [RFC 9126 - Pushed Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9126)

---

### 2. Demonstrating Proof of Possession (DPoP) - RFC 9449

**Category:** Security  
**Effort:** High (4-6 weeks)  
**Priority:** High  
**Status:** Not Started

**Description:**  
Implement DPoP to cryptographically bind access tokens to the client, preventing token theft and replay attacks.

**Benefits:**

- ✅ Tokens bound to client's private key - stolen tokens unusable
- ✅ Prevents token replay attacks
- ✅ Enhanced security for high-value transactions
- ✅ Required for some regulatory compliance scenarios

**Implementation Details:**

- Generate DPoP key pair (ES256 or RS256)
- Store private key securely (non-exportable CryptoKey)
- Create DPoP proof for each token request
- Include DPoP header in API calls
- Handle key rotation and expiration

**Configuration:**

```typescript
interface IdaasClientOptions {
  // ...
  enableDPoP?: boolean; // Default: false
  dPoPAlgorithm?: "ES256" | "RS256"; // Default: 'ES256'
}
```

**Challenges:**

- Key storage in browser (non-exportable CryptoKey API)
- Key rotation strategy
- Backwards compatibility with non-DPoP servers

**Testing Requirements:**

- Crypto key generation tests
- DPoP proof JWT creation tests
- Token binding validation tests
- E2E tests with DPoP-enabled server

**References:**

- [RFC 9449 - OAuth 2.0 Demonstrating Proof of Possession](https://datatracker.ietf.org/doc/html/rfc9449)

---

### 3. Discovery Document Caching

**Category:** Performance  
**Effort:** Low (1-2 days)  
**Priority:** High  
**Status:** Not Started

**Description:**  
Cache the OIDC discovery document with configurable TTL to reduce network requests and improve initialization performance.

**Benefits:**

- ✅ Faster SDK initialization
- ✅ Reduced network requests
- ✅ Lower latency for authentication flows
- ✅ Resilience to temporary network issues

**Implementation Details:**

```typescript
// In IdaasContext
private cachedConfig: OidcConfiguration | null = null;
private configExpiry: number | null = null;
private configTTL: number = 5 * 60 * 1000; // 5 minutes default

public async getConfig(): Promise<OidcConfiguration> {
  const now = Date.now();

  if (this.cachedConfig && this.configExpiry && now < this.configExpiry) {
    return this.cachedConfig;
  }

  this.cachedConfig = await this.fetchConfig();
  this.configExpiry = now + this.configTTL;
  return this.cachedConfig;
}

// Clear cache on demand
public clearConfigCache(): void {
  this.cachedConfig = null;
  this.configExpiry = null;
}
```

**Configuration:**

```typescript
interface IdaasClientOptions {
  // ...
  discoveryDocumentTTL?: number; // TTL in milliseconds, default: 5 minutes
  cacheDiscoveryDocument?: boolean; // Default: true
}
```

**Testing Requirements:**

- Cache hit/miss tests
- TTL expiration tests
- Manual cache clearing tests

---

### 4. IndexedDB Storage Option

**Category:** Storage  
**Effort:** Medium (2-3 weeks)  
**Priority:** High  
**Status:** Not Started

**Description:**  
Add IndexedDB as a storage option for larger token payloads and better performance compared to localStorage.

**Benefits:**

- ✅ Larger storage capacity (no 5-10MB limit)
- ✅ Async API (doesn't block UI thread)
- ✅ Better performance for large tokens
- ✅ Structured data storage

**Challenges:**

- ❌ Still vulnerable to XSS (same as localStorage)
- ❌ More complex API
- ❌ Browser compatibility (though widely supported)

**Implementation:**

```typescript
// New storage implementation
export class IndexedDBStore implements TokenStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    const request = indexedDB.open("idaas-auth-sdk", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("tokens", { keyPath: "key" });
    };
    this.db = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAccessToken(params: TokenParams): Promise<AccessTokenState | null> {
    const key = this.generateKey(params);
    return this.get("tokens", key);
  }

  // ... other methods
}
```

**Configuration:**

```typescript
interface IdaasClientOptions {
  storageType?: "memory" | "localstorage" | "indexeddb";
}
```

**Testing Requirements:**

- IndexedDB initialization tests
- Read/write/delete tests
- Browser compatibility tests
- Migration from localStorage tests

---

## Medium Priority Enhancements

### 5. JWT Secured Authorization Requests (JAR) - RFC 9101

**Category:** Security  
**Effort:** Medium (2-3 weeks)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Support signed JWT authorization requests for request integrity and non-repudiation.

**Benefits:**

- ✅ Request integrity protection
- ✅ Non-repudiation
- ✅ Required for FAPI (Financial-grade API) compliance
- ✅ Prevents parameter tampering

**Implementation:**

- Sign authorization request parameters as JWT
- Use request parameter in authorization URL
- Support both signed and unsigned requests

**Configuration:**

```typescript
interface OidcLoginOptions {
  // ...
  useJAR?: boolean; // Default: false
  jarSigningKey?: CryptoKey; // Required if useJAR=true
}
```

**References:**

- [RFC 9101 - JWT Secured Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9101)

---

### 6. Token Lifecycle Events

**Category:** Developer Experience  
**Effort:** Low (3-5 days)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Add event emitter for token lifecycle events (token acquired, refreshed, expired, revoked).

**Benefits:**

- ✅ Application can react to authentication state changes
- ✅ Better debugging and logging capabilities
- ✅ Custom token refresh UI
- ✅ Analytics integration

**Implementation:**

```typescript
type TokenEvent = "token:acquired" | "token:refreshed" | "token:expired" | "token:revoked";

interface IdaasClient {
  on(event: TokenEvent, callback: (data: TokenEventData) => void): void;
  off(event: TokenEvent, callback: (data: TokenEventData) => void): void;
}

// Usage
client.on("token:expired", () => {
  console.log("Token expired, refreshing...");
});

client.on("token:refreshed", (data) => {
  console.log("Token refreshed successfully", data.expiresIn);
});
```

**Testing Requirements:**

- Event emission tests
- Callback invocation tests
- Event unsubscription tests

---

### 7. Silent Authentication (iframe-based)

**Category:** User Experience  
**Effort:** Medium (2-3 weeks)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Support silent authentication via hidden iframe when user has active SSO session.

**Benefits:**

- ✅ Seamless token renewal without popup/redirect
- ✅ Better user experience (no visible navigation)
- ✅ Fallback for blocked popups

**Challenges:**

- ❌ Requires `prompt=none` support from IdP
- ❌ Third-party cookie restrictions in some browsers
- ❌ More complex error handling

**Implementation:**

```typescript
async silentLogin(options?: OidcLoginOptions): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const authUrl = await this.generateAuthUrl({
    ...options,
    prompt: 'none',
    responseMode: 'web_message',
  });

  return new Promise((resolve, reject) => {
    window.addEventListener('message', async (event) => {
      if (event.origin !== this.issuerOrigin) return;

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        await this.handleCallback(event.data);
        resolve();
      }

      document.body.removeChild(iframe);
    });

    iframe.src = authUrl;
  });
}
```

---

### 8. sessionStorage Support

**Category:** Storage  
**Effort:** Low (1-2 days)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Add sessionStorage as an alternative to localStorage for tab-specific token storage.

**Benefits:**

- ✅ Tab-isolated tokens (different tokens per tab)
- ✅ Automatic cleanup on tab close
- ✅ Same XSS security considerations as localStorage

**Use Cases:**

- Multi-account login in different tabs
- Testing scenarios
- Temporary sessions

**Implementation:**

```typescript
// Nearly identical to LocalStorageStore
export class SessionStorageStore implements TokenStore {
  private get storage() {
    return window.sessionStorage;
  }
  // ... same methods as LocalStorageStore
}
```

**Configuration:**

```typescript
interface IdaasClientOptions {
  storageType?: "memory" | "localstorage" | "sessionstorage" | "indexeddb";
}
```

---

### 9. Framework Wrappers (React, Vue, Angular)

**Category:** Developer Experience  
**Effort:** High (2-3 months for all frameworks)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Create official framework-specific wrappers that provide idiomatic integrations for popular JavaScript frameworks.

**Benefits:**

- ✅ Better developer experience for framework users
- ✅ Framework-specific patterns (hooks, composables, services)
- ✅ Type-safe integrations
- ✅ Reduced boilerplate code
- ✅ Expanded SDK adoption

**Proposed Packages:**

1. **@entrustcorp/idaas-auth-react**
   - React hooks (`useIdaasAuth`, `useAccessToken`, `useUser`)
   - Context provider component
   - Protected route components
   - TypeScript support

2. **@entrustcorp/idaas-auth-vue**
   - Vue 3 composables (`useIdaasAuth`, `useAccessToken`)
   - Plugin registration
   - Navigation guards
   - TypeScript support

3. **@entrustcorp/idaas-auth-angular**
   - Angular services and modules
   - Route guards
   - HTTP interceptors for token injection
   - RxJS observables

**Example: React Wrapper**

```typescript
// useIdaasAuth.ts
import { IdaasClient } from '@entrustcorp/idaas-auth-js';
import { createContext, useContext, useState, useEffect } from 'react';

export function useIdaasAuth() {
  const client = useContext(IdaasContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    client.isAuthenticated().then(setIsAuthenticated);
    client.getIdTokenClaims().then(setUser);
    setIsLoading(false);
  }, [client]);

  const login = () => client.login();
  const logout = () => client.logout();

  return { isAuthenticated, user, isLoading, login, logout };
}

// Usage
function App() {
  const { isAuthenticated, user, login, logout } = useIdaasAuth();

  if (!isAuthenticated) {
    return <button onClick={login}>Login</button>;
  }

  return <div>Welcome {user?.name} <button onClick={logout}>Logout</button></div>;
}
```

**Considerations:**

- Maintain separate repositories or monorepo
- Independent versioning per framework
- Framework version compatibility matrix
- Additional maintenance burden
- Community contributions welcome

**Phase 1 (React):** 6-8 weeks  
**Phase 2 (Vue):** 4-6 weeks  
**Phase 3 (Angular):** 6-8 weeks

---

### 10. Documentation Website

**Category:** Documentation  
**Effort:** Medium (3-4 weeks initial, ongoing maintenance)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Create a dedicated documentation website with better navigation, search, and interactive examples instead of relying solely on markdown docs.

**Benefits:**

- ✅ Better discoverability and navigation
- ✅ Search functionality
- ✅ Interactive code examples and playgrounds
- ✅ Version switcher for different SDK versions
- ✅ Mobile-friendly responsive design
- ✅ Better SEO for documentation
- ✅ Professional appearance

**Technology Options:**

1. **Rspress** (Preferred)
   - Rspack-based (extremely fast build times)
   - Built on Rslib/Rsbuild ecosystem (consistent with our build tooling)
   - Modern React-based framework
   - Built-in search with Pagefind
   - MDX support for interactive examples
   - Excellent TypeScript support
   - Active development and modern architecture
   - Already familiar with Rsbuild in this project

2. **VitePress**
   - Vue-based static site generator
   - Optimized for documentation
   - Built-in search
   - Markdown-based content
   - Low maintenance

3. **Docusaurus**
   - React-based
   - Feature-rich
   - MDX support
   - Larger bundle size

4. **Nextra**
   - Next.js-based
   - Modern and fast
   - Good TypeScript support

**Proposed Structure (Rspress):**

```
docs-site/
├── rspress.config.ts
├── public/
│   └── logo.svg
├── docs/
│   ├── index.md
│   ├── getting-started/
│   │   ├── installation.md
│   │   ├── quickstart.md
│   │   └── configuration.md
│   ├── guides/
│   │   ├── oidc.md
│   │   ├── rba.md
│   │   ├── authentication-methods.md
│   │   └── security-best-practices.md
│   ├── api-reference/
│   │   ├── idaas-client.md
│   │   ├── oidc-client.md
│   │   └── rba-client.md
│   └── examples/
│       ├── react-spa.mdx
│       ├── vue-spa.mdx
│       └── vanilla-js.mdx
├── theme/
│   └── index.tsx (optional custom theme)
└── package.json
```

**Example rspress.config.ts:**

```typescript
import { defineConfig } from "rspress/config";

export default defineConfig({
  root: "docs",
  title: "IDaaS Auth JS",
  description: "Authentication SDK for Single Page Applications",
  icon: "/logo.svg",
  logo: {
    light: "/logo.svg",
    dark: "/logo-dark.svg"
  },
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/EntrustCorporation/idaas-auth-js"
      }
    ],
    nav: [
      { text: "Guide", link: "/getting-started/installation" },
      { text: "API Reference", link: "/api-reference/idaas-client" },
      { text: "Examples", link: "/examples/react-spa" }
    ],
    sidebar: {
      "/getting-started/": [
        {
          text: "Getting Started",
          items: [
            { text: "Installation", link: "/getting-started/installation" },
            { text: "Quick Start", link: "/getting-started/quickstart" },
            { text: "Configuration", link: "/getting-started/configuration" }
          ]
        }
      ],
      "/guides/": [
        {
          text: "Guides",
          items: [
            { text: "OIDC Authentication", link: "/guides/oidc" },
            { text: "RBA Authentication", link: "/guides/rba" },
            { text: "Authentication Methods", link: "/guides/authentication-methods" },
            { text: "Security Best Practices", link: "/guides/security-best-practices" }
          ]
        }
      ]
    }
  },
  builderConfig: {
    source: {
      // Inherit from main project's Rsbuild config if needed
    }
  }
});
```

**Features:**

- **MDX Support:** Interactive code examples with live React components
- **Pagefind Search:** Fast, built-in full-text search
- **Version Switching:** Multi-version documentation support
- **Dark/Light Mode:** Built-in theme switching
- **Code Highlighting:** Syntax highlighting with copy-to-clipboard
- **Fast Build Times:** Powered by Rspack (faster than Webpack/Vite)
- **TypeScript First:** Full TypeScript support out of the box
- **Mobile Responsive:** Mobile-friendly by default
- **GitHub Integration:** Edit links and automatic deployments

**Rspress Advantages for This Project:**

- ✅ Consistent tooling ecosystem (already using Rslib/Rsbuild)
- ✅ Extremely fast build and hot reload (Rspack performance)
- ✅ Modern React-based (easier for React framework wrapper docs)
- ✅ Growing community and active development
- ✅ Excellent DX with TypeScript
- ✅ Better alignment with future framework wrappers

**Hosting Options:**

- GitHub Pages (free, simple)
- Netlify (free tier, preview deployments)
- Vercel (free tier, automatic deploys)
- Cloudflare Pages (free tier, fast global CDN)

**Migration Plan:**

1. **Phase 1: Setup** (Week 1)
   - Install Rspress and dependencies
   - Create `docs-site/` directory structure
   - Configure `rspress.config.ts`
   - Set up basic theme and navigation

2. **Phase 2: Content Migration** (Week 1-2)
   - Copy existing markdown docs to `docs-site/docs/`
   - Maintain original docs in root `docs/` as source of truth
   - Update internal links and image paths
   - Add frontmatter metadata to pages

3. **Phase 3: Enhancement** (Week 2-3)
   - Add interactive MDX examples
   - Integrate TypeDoc-generated API reference
   - Set up Pagefind search
   - Create custom theme components if needed
   - Add code playgrounds (StackBlitz/CodeSandbox embeds)

4. **Phase 4: Deploy** (Week 3-4)
   - Configure CI/CD for automatic deployments
   - Set up preview deployments for PRs
   - Add version switcher for multi-version support
   - Update README and CONTRIBUTING.md with docs site link
   - Configure custom domain (if applicable)

**Integration with Existing Workflow:**

```json
// package.json scripts
{
  "docs:dev": "rspress dev docs-site",
  "docs:build": "rspress build docs-site",
  "docs:preview": "rspress preview docs-site"
}
```

**Maintenance:**

- Automatic deploys on main branch changes via GitHub Actions
- Preview deployments for pull requests
- Version tagging synced with SDK releases
- Community contributions via PRs
- Rspack's fast builds make local development seamless

---

### 12. TypeScript Strict Mode Improvements

**Category:** Code Quality  
**Effort:** Low (1 week)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Enable stricter TypeScript compiler options and fix any resulting type errors.

**Current tsconfig.json:**

```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "lib": ["DOM", "ES2021"]
  }
}
```

**Proposed additions:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Benefits:**

- ✅ Better type safety
- ✅ Catch more bugs at compile time
- ✅ Improved IDE autocomplete
- ✅ Better developer experience

---

### 13. Enhanced Error Types

**Category:** Developer Experience  
**Effort:** Low (1 week)  
**Priority:** Medium  
**Status:** Not Started

**Description:**  
Create specific error classes for different failure scenarios.

**Current:**

```typescript
throw new Error("Authentication failed");
```

**Proposed:**

```typescript
export class IdaasAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "IdaasAuthError";
  }
}

export class TokenExpiredError extends IdaasAuthError {
  constructor() {
    super("Token expired", "TOKEN_EXPIRED");
  }
}

export class InvalidStateError extends IdaasAuthError {
  constructor() {
    super("Invalid state parameter", "INVALID_STATE");
  }
}

// Usage
try {
  await client.login();
} catch (error) {
  if (error instanceof TokenExpiredError) {
    // Handle expired token
  } else if (error instanceof InvalidStateError) {
    // Handle CSRF attack
  }
}
```

**Error Codes:**

- `TOKEN_EXPIRED` - Token has expired
- `INVALID_STATE` - State parameter mismatch (CSRF)
- `INVALID_NONCE` - Nonce mismatch (replay attack)
- `POPUP_BLOCKED` - Popup window blocked by browser
- `NETWORK_ERROR` - Network request failed
- `AUTHENTICATION_FAILED` - Authentication challenge failed
- `INVALID_CONFIGURATION` - SDK misconfigured

---

## Low Priority Enhancements

### 14. Optional ID Token Signature Validation

**Category:** Security (Defense-in-Depth)  
**Effort:** Low (2-3 days)  
**Priority:** Low  
**Status:** Not Started

**Description:**  
Add optional ID token signature validation using JWKS, even though the SDK relies on TLS per OIDC spec allowance.

**Benefits:**

- ✅ Defense-in-depth security
- ✅ Protection against compromised TLS (unlikely but possible)
- ✅ Compliance with strict security policies

**Implementation:**

```typescript
interface IdaasClientOptions {
  // ...
  validateIdTokenSignature?: boolean; // Default: false
}

// In jwt.ts
if (options.validateIdTokenSignature && typeof idToken === "string") {
  const jwks = createRemoteJWKSet(new URL(jwksEndpoint));
  await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId
  });
}
```

**Note:** Currently, the SDK follows OIDC spec 3.1.3.7 #6 which allows relying on TLS for Authorization Code Flow.

---

### 15. Request Deduplication

**Category:** Performance  
**Effort:** Low (2-3 days)  
**Priority:** Low  
**Status:** Not Started

**Description:**  
Deduplicate concurrent identical requests (e.g., multiple `getAccessToken()` calls).

**Benefits:**

- ✅ Prevents race conditions
- ✅ Reduces unnecessary API calls
- ✅ Better performance

**Implementation:**

```typescript
private pendingRequests = new Map<string, Promise<AccessToken>>();

async getAccessToken(options: TokenOptions): Promise<string> {
  const key = this.generateRequestKey(options);

  if (this.pendingRequests.has(key)) {
    return this.pendingRequests.get(key)!;
  }

  const promise = this.fetchAccessToken(options);
  this.pendingRequests.set(key, promise);

  try {
    return await promise;
  } finally {
    this.pendingRequests.delete(key);
  }
}
```

---

### 16. Token Introspection Support (RFC 7662)

**Category:** Security  
**Effort:** Low (1 week)  
**Priority:** Low  
**Status:** Not Started

**Description:**  
Add support for token introspection endpoint to validate token status.

**Use Cases:**

- Validate if token has been revoked
- Check token metadata
- Audit token usage

**Implementation:**

```typescript
async introspectToken(token: string): Promise<TokenIntrospection> {
  const config = await this.context.getConfig();

  if (!config.introspection_endpoint) {
    throw new Error('Introspection not supported');
  }

  const response = await fetch(config.introspection_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });

  return response.json();
}
```

**References:**

- [RFC 7662 - Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)

---

### 17. Logout Token Support (Back-Channel Logout)

**Category:** Security  
**Effort:** Medium (2-3 weeks)  
**Priority:** Low  
**Status:** Not Started

**Description:**  
Support back-channel logout to handle logout notifications from the IdP.

**Benefits:**

- ✅ Centralized logout across all sessions
- ✅ Enhanced security
- ✅ Better multi-device logout experience

**Challenges:**

- Requires server-side component to receive logout token
- Not applicable for purely client-side SPAs

**References:**

- [OpenID Connect Back-Channel Logout](https://openid.net/specs/openid-connect-backchannel-1_0.html)

---

### 18. WebAuthn Conditional UI Support

**Category:** User Experience  
**Effort:** Medium (1-2 weeks)  
**Priority:** Low  
**Status:** Not Started

**Description:**  
Support WebAuthn conditional UI (autofill) for passkey authentication.

**Benefits:**

- ✅ Passkey suggestions in username field
- ✅ Better UX for passkey authentication
- ✅ Modern browser feature

**Implementation:**

```typescript
async passkeyWithAutofill(): Promise<AuthenticationResponse> {
  const publicKey = await this.getPublicKeyOptions();

  const credential = await navigator.credentials.get({
    publicKey,
    mediation: 'conditional', // Enable autofill
  });

  return this.submitPasskeyCredential(credential);
}
```

**Browser Support:** Chrome 108+, Safari 16+, Edge 108+

---

## Research & Exploration

### 19. WebCrypto API Encrypted Storage

**Category:** Security Research  
**Effort:** High (4-6 weeks)  
**Priority:** Research  
**Status:** Not Started

**Description:**  
Research feasibility of encrypting tokens at rest using WebCrypto API with key derived from user password or biometric.

**Potential Benefits:**

- ✅ Encrypted tokens in localStorage/IndexedDB
- ✅ Protection against XSS (attacker needs encryption key)

**Challenges:**

- ❌ Key management complexity
- ❌ User must re-enter password after page refresh
- ❌ Biometric APIs limited and non-standard
- ❌ May not be practical for SPAs

**Research Questions:**

- How to derive encryption key securely?
- How to handle key storage?
- Performance impact of encryption/decryption?
- User experience impact?

---

### 20. Trusted Types API Integration

**Category:** Security Research  
**Effort:** Medium (2-3 weeks)  
**Priority:** Research  
**Status:** Not Started

**Description:**  
Research using Trusted Types API to prevent DOM XSS attacks.

**Potential Benefits:**

- ✅ Additional XSS protection layer
- ✅ Enforces secure coding patterns

**Challenges:**

- ❌ Limited browser support (Chrome, Edge only)
- ❌ May require significant refactoring
- ❌ CSP policy requirement

**Research Questions:**

- What code paths require Trusted Types?
- Impact on bundle size?
- Backwards compatibility strategy?

**References:**

- [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)

---

### 21. OAuth 2.1 Preparation

**Category:** Standards Research  
**Effort:** Medium (ongoing)  
**Priority:** Research  
**Status:** Not Started

**Description:**  
Monitor OAuth 2.1 specification development and prepare for migration.

**OAuth 2.1 Changes:**

- PKCE required for all OAuth clients (already implemented ✅)
- Implicit flow removed (already not implemented ✅)
- Refresh token rotation recommended (already implemented ✅)
- Additional security requirements

**Action Items:**

- Monitor OAuth 2.1 specification progress
- Identify any SDK changes needed
- Plan migration strategy

**References:**

- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)

---

### 22. CIBA (Client-Initiated Backchannel Authentication)

**Category:** Feature Research  
**Effort:** High (6-8 weeks)  
**Priority:** Research  
**Status:** Not Started

**Description:**  
Research CIBA support for decoupled authentication flows (e.g., authenticate on mobile, grant access on desktop).

**Use Cases:**

- Call center authentication
- IoT device authentication
- TV/console authentication

**Challenges:**

- Requires IdP support
- Complex polling mechanism
- Different UX paradigm

**References:**

- [OpenID Connect CIBA](https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html)

---

## Implementation Guidelines

### Priority Definitions

- **High Priority:** Significant security improvement or widely requested feature
- **Medium Priority:** Nice-to-have enhancement with clear benefits
- **Low Priority:** Minor improvement or niche use case
- **Research:** Requires investigation before committing to implementation

### Effort Estimates

- **Low:** 1-5 days
- **Medium:** 1-3 weeks
- **High:** 1-2 months

### Implementation Process

1. **Create GitHub Issue** - Describe enhancement with use cases and benefits
2. **Community Feedback** - Gather input from users
3. **Design Document** - Write technical design for complex enhancements
4. **Implementation** - Develop with tests and documentation
5. **Review** - Code review and security review if applicable
6. **Documentation** - Update user guides and API reference
7. **Release** - Follow semantic versioning

### Breaking Changes

If an enhancement requires breaking changes:

- Must be justified with significant benefits
- Provide migration guide
- Deprecate old API first (if possible)
- Reserve for major version releases

---

## Contributing

Community contributions are welcome! If you'd like to work on any of these enhancements:

1. Check if a GitHub issue already exists
2. Comment on the issue to avoid duplicate work
3. Follow the [contributing guidelines](../CONTRIBUTING.md)
4. Submit a pull request

---

**Feedback:** Have ideas for additional enhancements? [Open an issue](https://github.com/EntrustCorporation/idaas-auth-js/issues/new) with the "enhancement" label.
