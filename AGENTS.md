# AGENTS.md

This document provides AI agents and developers with comprehensive information about the IDaaS Auth JavaScript SPA SDK repository structure, architecture, and development guidelines.

## Project Overview

**Name:** `@entrustcorp/idaas-auth-js`  
**Description:** IDaaS Authentication SDK for Single Page Applications (SPAs)  
**Version:** 0.1.43  
**License:** Apache-2.0  
**Repository:** https://github.com/EntrustCorporation/idaas-auth-js  
**Owner:** EntrustCorporation

### Purpose

This SDK simplifies integrating secure authentication into JavaScript SPAs using Entrust Identity as a Service (IDaaS). It provides:

- OIDC authentication flows with PKCE
- In-app authentication via IDaaS Authentication API
- Multi-factor authentication (MFA) support
- Risk-based authentication (RBA)
- Passwordless authentication (passkey, biometrics)
- Single Sign-On (SSO)

**Target Environment:** Browser-only (Single Page Applications running in web browsers)

**Module System:** ESM-only (pure ECMAScript modules, no CommonJS support)

## Technology Stack

### Runtime & Build Tools

- **Development Runtime:** Bun >= 1, Node >= 22 (for building and testing only)
- **Production Runtime:** Modern browsers supporting ES2021
- **Language:** TypeScript 5.9.3
- **Build System:** rslib (Rsbuild library build tool)
- **Module Format:** ESM-only (ES2021 syntax, no CJS)
- **Linter/Formatter:** Biome 2.3.2

### Core Dependencies

- **jose** (6.1.0): JWT operations and cryptographic functions
- **onfido-sdk-ui** (14.55.0): Optional peer dependency for face biometric authentication

### Development Dependencies

- **@playwright/test**: End-to-end testing
- **Bun test**: Unit testing
- **oidc-provider**: Test identity provider
- **@biomejs/biome**: Code formatting and linting
- **@arethetypeswrong/cli**: Type checking for package exports

## Architecture

### Core Components

The SDK is organized around several main client classes:

#### 1. **IdaasClient** (Main Entry Point)

- **Location:** `src/IdaasClient.ts`
- **Purpose:** Primary facade for all authentication operations
- **Properties:**
  - `oidc`: Access to OIDC hosted authentication methods
  - `rba`: Access to self-hosted RBA authentication methods
  - `auth`: Convenience methods for authentication (e.g., password)
- **Key Methods:**
  - `isAuthenticated()`: Check if user has valid ID token
  - `getIdTokenClaims()`: Retrieve user claims from stored ID token
  - `getAccessToken()`: Retrieve or request access tokens
  - `getUserInfo()`: Fetch user information from userinfo endpoint

#### 2. **OidcClient**

- **Location:** `src/OidcClient.ts`
- **Purpose:** Handle OIDC flows (Authorization Code + PKCE)
- **Methods:**
  - `login()`: Initiate login via redirect or popup
  - `logout()`: Log user out with optional redirect
  - `handleRedirect()`: Process OAuth callback after redirect

#### 3. **RbaClient**

- **Location:** `src/RbaClient.ts`
- **Purpose:** Handle risk-based authentication challenges
- **Methods:**
  - `requestChallenge()`: Request authentication challenge
  - `submitChallenge()`: Submit user response to challenge
  - `poll()`: Poll for authentication completion
  - `cancel()`: Cancel ongoing authentication

#### 4. **AuthClient**

- **Location:** `src/AuthClient.ts`
- **Purpose:** Convenience methods for common authentication flows
- **Key Methods:**
  - `password(userId, password)`: Password authentication
  - `softToken(userId, options)`: Soft token (OTP/push)
  - `passkey(userId?)`: WebAuthn/FIDO/Passkey authentication
  - `grid(userId)`: Grid card challenge
  - `kba(userId)`: Knowledge-based authentication
  - `tempAccessCode(userId, code)`: Temporary access code
  - `otp(userId, options)`: One-time password
  - `magicLink(userId)`: Magic link authentication
  - `smartCredential(userId, options)`: Smart credential push
  - `faceBiometric(userId, options)`: Face biometric (requires onfido-sdk-ui)
  - `submit(params)`: Submit challenge response
  - `poll()`: Poll for async authentication completion
  - `cancel()`: Cancel ongoing authentication

#### 5. **StorageManager**

- **Location:** `src/storage/StorageManager.ts`
- **Purpose:** Manage tokens and state persistence
- **Storage Types:**
  - `memory`: In-memory storage (default)
  - `localstorage`: Browser localStorage
- **Managed Data:**
  - Access tokens (with scope, audience, expiry, ACR, maxAgeExpiry)
  - ID tokens (encoded and decoded)
  - Refresh tokens
  - Client parameters (nonce, codeVerifier, redirectUri, state)
  - Token parameters (audience, scope, maxAge, acrValue)

#### 6. **IdaasContext**

- **Location:** `src/IdaasContext.ts`
- **Purpose:** Store and provide configuration to all clients
- **Configuration:**
  - `issuerUrl`: IDaaS OIDC issuer URL
  - `clientId`: OAuth client ID
  - `globalAudience`, `globalScope`, `globalUseRefreshToken`: Default parameters

### Public API Exports

The SDK exports the following from `src/index.ts`:

**Main Class:**

- `IdaasClient`: Primary client class

**Configuration Types:**

- `IdaasClientOptions`: Client configuration options
- `TokenOptions`: Token request options
- `OidcLoginOptions`: OIDC-specific login options
- `OidcLogoutOptions`: Logout configuration

**Authentication Types:**

- `AuthenticationRequestParams`: RBA challenge request parameters
- `AuthenticationResponse`: Authentication challenge/completion response
- `AuthenticationSubmissionParams`: Challenge submission parameters
- `IdaasAuthenticationMethod`: Authentication method enum

**Authenticator-Specific Options:**

- `OtpOptions`: OTP authentication options
- `SoftTokenOptions`: Soft token authentication options
- `SoftTokenPushOptions`: Soft token push-specific options
- `FaceBiometricOptions`: Face biometric authentication options
- `SmartCredentialOptions`: Smart credential push options

**Challenge Types:**

- `GridChallenge`: Grid card challenge details
- `KbaChallenge`: Knowledge-based authentication challenge
- `FaceChallenge`: Face biometric challenge details
- `FidoChallenge`: FIDO/WebAuthn challenge details
- `TempAccessCodeChallenge`: Temporary access code challenge

**User Types:**

- `UserClaims`: OIDC standard user claims

### Directory Structure

```
src/
├── IdaasClient.ts              # Main client facade
├── OidcClient.ts               # OIDC flow handling
├── RbaClient.ts                # RBA challenge handling
├── AuthClient.ts               # Authentication convenience methods
├── AuthenticationTransaction.ts # Transaction state management
├── IdaasContext.ts             # Configuration context
├── api.ts                      # API client functions
├── index.ts                    # Public exports
├── models/                     # TypeScript type definitions
│   └── index.ts
│   └── openapi-ts/             # Generated from OpenAPI specs
├── storage/                    # Token and state persistence
│   ├── StorageManager.ts       # Main storage orchestration
│   ├── MemoryStore.ts          # In-memory implementation
│   ├── LocalStorageStore.ts    # Browser localStorage implementation
│   └── shared.ts               # Shared storage interfaces
└── utils/                      # Utility functions
    ├── browser.ts              # Browser API helpers
    ├── crypto.ts               # PKCE and cryptographic functions
    ├── format.ts               # Data formatting utilities
    ├── jwt.ts                  # JWT parsing and validation
    ├── passkey.ts              # WebAuthn/FIDO helpers
    └── url.ts                  # URL manipulation utilities
```

### Test Structure

```
test/
├── unit/                       # Unit tests (Bun test)
│   ├── format.test.ts
│   ├── jwt.test.ts
│   ├── url.test.ts
│   ├── IdaasClient/            # Client method tests
│   └── storage/                # Storage tests
├── e2e/                        # End-to-end tests (Playwright)
│   ├── initialization.spec.ts
│   └── login.spec.ts
├── test-manual/                # Manual testing app and per-authenticator test pages
│   ├── app.ts                  # Test server
│   ├── index.html              # Manual test UI
│   └── [authenticator-type]/   # Per-authenticator pages (password, otp, passkey, etc.)
├── test-spa/                   # Test SPA for E2E tests
│   ├── app.ts
│   ├── index.html
│   └── index.ts
└── test-idp/                   # Test OIDC provider
    └── oidc-provider.ts
```

## Development Workflow

### Setup

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Format and lint
bun run format
bun run lint

# Fix formatting/linting issues
bun run fix

# Generate API documentation
bun run docs:generate

# Watch mode for documentation
bun run docs:watch
```

### Documentation Generation

The SDK uses [TypeDoc](https://typedoc.org/) with the Markdown plugin to automatically generate API reference documentation from TypeScript source code and JSDoc comments.

**Configuration:** `typedoc.json`

**Output:** `docs/api/` (committed to version control)

**Scripts:**

- `bun run docs:generate` - Generate API documentation
- `bun run docs:watch` - Watch mode for development

**When to regenerate:**

- After adding/modifying public APIs
- After updating JSDoc comments
- Before committing changes that affect the public API
- CI will fail if docs are out of date

**Important:** Generated documentation is **committed to version control** to ensure docs stay in sync with code and CI can validate changes.

**Note:** TypeDoc generates comprehensive API reference from source code. Manual guides in `docs/guides/` provide conceptual explanations and usage patterns.

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

**Format**: `<type>[optional scope]: <description>`

**Key types**: `feat` (minor bump), `fix` (patch bump), `feat!` or `BREAKING CHANGE:` (major bump)

**Validation**: Run `bun run lint:commits` to validate locally. CI enforces this.

### Testing

```bash
# Run unit tests
bun run test:unit

# Run E2E tests (Playwright)
bun run test:e2e

# Run manual test server
bun run test:manual
```

**E2E Infrastructure:** Playwright auto-starts test OIDC provider (port 3000) and test SPA (port 8080). Configuration in `playwright.config.ts`.

### API Code Generation

The SDK includes auto-generated API types from OpenAPI specifications:

```bash
# Download OpenAPI spec
bun run api:download

# Generate TypeScript types
bun run api:generate
```

Configuration in `openapi-ts.config.ts`.

### Build Configuration

**rslib.config.ts:**

- **Format:** ESM-only (no CJS or UMD variants)
- **Syntax:** ES2021
- **Target:** `web` (browser environment)
- **Bundle:** Single bundled output with tree-shaking
- **Type Declarations:** Bundled `.d.ts` file
- **Externalization:** Automatic externalization of dependencies (via `autoExternal: true`)
- **Peer Dependencies:** `onfido-sdk-ui` marked as external and optional
- **Plugins:**
  - `pluginTypeCheck()`: TypeScript type checking during build
  - `pluginPublint()`: Package validation for npm publishing

**Key Configuration Choices:**

1. **Web Target Only:** Despite Node.js being required for development tooling, the SDK targets `web` exclusively because it runs only in browser SPAs and uses browser-specific APIs (WebCrypto, WebAuthn, window, localStorage) plus OIDC flows requiring browser redirects/popups.

2. **ESM-Only:** Modern bundlers (Vite, Webpack 5+, Rollup) fully support ESM, which provides better tree-shaking, aligns with browser native modules, and simplifies maintenance.

3. **No UMD/IIFE:** Direct CDN usage via `<script>` tags is not supported; users must use modern bundlers.

### Code Quality Standards

**Biome:** 2 space indent, 120 char line width. Run `bun run fix` to auto-fix issues.

**TypeScript:** Extends `@tsconfig/bun` with DOM lib for browser APIs.

## Key Concepts

### Authentication Flows

#### 1. **OIDC with Redirect**

```typescript
// Redirect to login page
await client.login({ popup: false, redirectUri: "..." });

// In callback page
await client.handleRedirect();
```

#### 2. **OIDC with Popup**

```typescript
await client.login({ popup: true });
```

#### 3. **In-App Authentication**

```typescript
// Request challenge
const { method, pollForCompletion } = await client.requestChallenge({
  userId: "user@example.com"
});

// Submit response (if required)
if (!pollForCompletion) {
  await client.submitChallenge({ response: "..." });
}

// Poll for completion (if required)
if (pollForCompletion) {
  await client.poll();
}
```

### Authentication Methods

Supported authentication methods:

- **PASSWORD**: Username/password authentication
- **PASSWORD_AND_SECONDFACTOR**: Two-factor authentication
- **OTP**: One-time password
- **TOKEN**: Software token (TOTP)
- **TOKENPUSH**: Push notification to mobile device
- **GRID**: Grid card challenge
- **KBA**: Knowledge-based authentication (security questions)
- **FACE**: Facial recognition biometrics
- **FIDO**: WebAuthn/FIDO2 (user-specific)
- **PASSKEY**: WebAuthn/FIDO2 passwordless (usernameless)
- **TEMP_ACCESS_CODE**: Temporary access code
- **SMARTCREDENTIALPUSH**: Smart credential authentication
- **MAGICLINK**: Magic link authentication
- **EXTERNAL**: External authentication

### Token Management

The SDK manages three types of tokens:

1. **Access Tokens**: Used for API authorization
   - Stored with scope, audience, expiry, ACR, and maxAgeExpiry
   - Can be refreshed if refresh token available
   - Retrieved via `getAccessToken()`

2. **ID Tokens**: Contain user identity claims
   - JWT format with user information
   - Retrieved via `getIdTokenClaims()`

3. **Refresh Tokens**: Used to obtain new access tokens
   - Optional (must be enabled in app config)
   - Automatically used when access token expires

### PKCE (Proof Key for Code Exchange)

All OIDC flows use PKCE for security:

- Code verifier generated: 43-128 character random string
- Code challenge created: SHA-256 hash of verifier, base64url encoded
- Verifier stored temporarily, sent during token exchange
- Implementation in `src/utils/crypto.ts`

## API Integration

The SDK communicates with two main APIs:

1. **OIDC Provider** (issuerUrl)
   - Authorization endpoint: `${issuerUrl}/authorize`
   - Token endpoint: `${issuerUrl}/token`
   - UserInfo endpoint: `${issuerUrl}/userinfo`
   - End session endpoint: `${issuerUrl}/endsession`

2. **Authentication API** (derived from issuerUrl)
   - Challenge request: `POST /authenticate`
   - Challenge submission: `POST /authenticate/{transactionId}`
   - Poll status: `GET /authenticate/{transactionId}`
   - Cancel: `DELETE /authenticate/{transactionId}`

## Common Patterns

### Pattern: Authentication Context Classes (ACR)

Specify required authentication strength:

```typescript
// Require knowledge-based authentication
await client.login({
  popup: true,
  acrValues: ["knowledge"] // e.g., password, KBA
});

// Require possession-based authentication
await client.login({
  popup: true,
  acrValues: ["possession"] // e.g., OTP, soft token
});
```

### Pattern: Transaction Details for RBA

Pass contextual information for risk assessment:

```typescript
await client.requestChallenge({
  userId: "user@example.com",
  transactionDetails: [
    {
      detail: "IP_ADDRESS",
      value: "192.168.1.1",
      usage: ["RBA", "TVS"]
    },
    {
      detail: "TRANSACTION_AMOUNT",
      value: "1000.00",
      usage: ["TVS"]
    }
  ]
});
```

### Pattern: Convenience Authentication Methods

The `AuthClient` provides simplified methods for common authentication flows:

```typescript
// Password authentication
await client.auth.password("user@example.com", "password123");

// Soft token with push
await client.auth.softToken("user@example.com", { push: true });

// Passkey (usernameless)
await client.auth.passkey();

// OTP with custom delivery
await client.auth.otp("user@example.com", {
  otpDeliveryType: "EMAIL"
});

// Face biometric (requires onfido-sdk-ui and <div id="onfido-mount"></div>)
await client.auth.faceBiometric("user@example.com");
```

## Utilities Reference

### crypto.ts

- `generateCodeVerifier()`: Generate PKCE code verifier
- `generateCodeChallenge()`: Generate PKCE code challenge
- `generateRandomString()`: Cryptographically secure random strings

### jwt.ts

- `readAccessToken()`: Decode and validate access token
- `validateIdToken()`: Validate ID token claims and signature
- `validateUserInfoToken()`: Validate and verify UserInfo JWT responses

### url.ts

- `generateAuthorizationUrl()`: Construct OAuth authorization URL with PKCE

### format.ts

- `calculateEpochExpiry()`: Calculate token expiration timestamps

### passkey.ts

- WebAuthn credential creation and assertion helpers

### browser.ts

- `openPopup()`: Open centered popup window
- `listenToAuthorizePopup()`: Listen for OAuth callback in popup
- `browserSupportsPasskey()`: Check if browser supports WebAuthn

## Publishing

The package is published to npm under the `@entrustcorp` scope using **automated releases with Release Please**.

### Automated Release Process

1. **Make changes** with conventional commits (see "Development Workflow" section)
2. **Merge to main**: Release Please automatically creates/updates a release PR
3. **Review the PR**: Check the auto-generated changelog and version bump
4. **Merge the release PR**: Publishing happens automatically via GitHub Actions with Trusted Publishing (OIDC)

**Note**: Never manually bump versions, create tags, or run `npm publish` locally. All releases are automated.

**Published Files:**

- `dist/` (compiled JavaScript and types)
- `LICENSE`
- `README.md`

## Security Considerations

### Token Storage

- **Memory storage** (default): Tokens lost on page refresh
- **localStorage**: Tokens persist across sessions, vulnerable to XSS
- Choose based on security vs. UX requirements

### PKCE

- Always enabled for all authorization code flows
- Protects against authorization code interception

### Token Validation

- Access tokens decoded and validated before use
- ID tokens validated against OIDC claims

### Sensitive Data

- Never log tokens or credentials
- Clear sensitive data from memory after use

## CI/CD

This project uses **GitHub Actions** for continuous integration and automated releases.

### Workflows

**Build Workflow (`build.yaml`)** - Runs on PRs and main branch:

- Validates commits, generates API types, formats, lints, builds, type checks, tests (unit + E2E)

**Release Please Workflow (`release-please.yml`)** - Automated releases:

- Creates release PRs from conventional commits
- Auto-publishes when release PR is merged (npm Trusted Publishing with OIDC)

**Note**: Jenkins pipeline (`Jenkinsfile`) exists for legacy purposes; GitHub Actions is the primary CI/CD system.

**Local CI Checks:**

```bash
bun run fix             # Auto-fix formatting and linting
bun run lint:types      # Type check
bun run lint:commits    # Validate commits
bun run build           # Build package
bun run test:unit       # Unit tests
bun run test:e2e        # E2E tests
```

## Dependencies Management

**Renovate Configuration:**

- Auto-update dependencies via `renovate.json`
- Keeps dependencies current and secure

**Lock File:**

- `bun.lock`: Deterministic dependency resolution
- Commit lock file to version control

## Documentation

### For Users

- **README.md**: User-facing documentation with examples
- **docs/index.md**: Documentation overview
- **docs/quickstart.md**: Quick start guide
- **docs/self-hosted.md**: Self-hosted authentication guide
- **docs/troubleshooting.md**: Troubleshooting guide
- **docs/guides/**: Detailed guides for OIDC, RBA, and Auth methods
- **docs/reference/**: API reference documentation

### For Maintainers

- **AGENTS.md**: This file - architecture and development guide
- **SECURITY.md**: Security policies and vulnerability reporting

## Contributing Guidelines

When working on this codebase:

1. **Follow existing patterns**: Use established client and utility patterns
2. **Maintain type safety**: All public APIs must have TypeScript types
3. **Test thoroughly**: Add unit tests for utilities, E2E for flows
4. **Document changes**: Update README for user-facing changes
5. **Use Biome**: Run `bun run fix` before committing
6. **Bundle types**: Ensure types are bundled in dist output

## Maintaining This Document (AGENTS.md)

**IMPORTANT:** AI agents should keep this AGENTS.md file up to date whenever making significant changes to the codebase.

### Writing Philosophy

**This document should be streamlined and focused on what AI agents actually need to know.** Avoid unnecessary details:

- **Don't list exhaustive details** that agents can discover themselves (e.g., all command variations, every config option)
- **Don't duplicate information** that's already documented elsewhere (e.g., listing all API methods when they're in "Public API Exports")
- **Don't include verbose explanations** when concise statements suffice
- **Focus on actionable information**: How to do things, where things are, when to regenerate/rebuild
- **Prefer summaries over lists**: "Validates commits, formats, lints, builds, tests" not bullet points for each step
- **Keep it scannable**: AI agents should quickly find what they need without wading through details

**Ask yourself**: "Does an AI agent need this specific detail to maintain the codebase effectively?" If not, remove it.

### When to Update AGENTS.md

Update this document when:

1. **Architecture Changes:** Adding/removing core client classes, changing component relationships, new design patterns
2. **API Changes:** New public methods, changed signatures, new authentication methods, token management changes
3. **Directory Structure Changes:** New directories, reorganization, moved files
4. **Development Workflow Changes:** New build/test commands, updated tools, CI/CD modifications
5. **Dependency Changes:** Major dependencies added/removed, major version upgrades, new peer dependencies
6. **New Patterns or Utilities:** New usage patterns, utility categories, security considerations

### What NOT to Update

Do **not** update for: minor bug fixes, internal refactoring, documentation typos, patch version bumps, test-only changes.

### How to Update

1. **Be Comprehensive but Concise:** Include necessary context without exhaustive detail
2. **Update Multiple Sections:** Changes often affect Architecture, Common Patterns, and Common Tasks
3. **Maintain Consistency:** Follow existing format and style (terse, scannable, action-oriented)
4. **Remove Redundancy:** If information exists elsewhere or can be easily discovered, don't duplicate it
5. **Update Version Info & Date:** Bump version in Project Overview and "Last updated" date
6. **Add Examples Judiciously:** Include code examples only when they clarify complex patterns
7. **Check Cross-References:** Verify all file paths and references are accurate
8. **Review for Bloat:** After updating, review the entire section and remove any unnecessary details

### Update Checklist

```markdown
- [ ] Updated Architecture section if components changed
- [ ] Updated Directory Structure if files added/moved
- [ ] Added new patterns to Common Patterns section
- [ ] Updated Utilities Reference for new helper functions
- [ ] Added to Common Tasks for AI Agents if new workflow
- [ ] Updated version number if package.json changed
- [ ] Updated "Last updated" date at bottom
```

## Common Tasks for AI Agents

### Adding a New Authentication Method

1. Check if method exists in OpenAPI types (`src/models/openapi-ts/`)
2. Add method-specific types to `src/models/index.ts`
3. Update `RbaClient` or `AuthClient` with new method logic
4. Add manual test page in `test/test-manual/[method-name]/`
5. Update README with usage examples

### Adding a New Utility Function

1. Determine category (crypto, format, jwt, url, etc.)
2. Add function to appropriate `src/utils/` file
3. Add unit tests in `test/unit/`
4. Export if needed for internal use only (don't expose in public API)

### Modifying Token Storage

1. Update `StorageManager` interface in `src/storage/shared.ts`
2. Implement in both `MemoryStore` and `LocalStorageStore`
3. Add tests in `test/unit/storage/`
4. Consider migration path for existing users

### Adding API Endpoints

1. Update OpenAPI spec (via `bun run api:download`)
2. Regenerate types (`bun run api:generate`)
3. Add API client function to `src/api.ts`
4. Update client classes to use new endpoint
5. Add integration test

## Version History

Current version: **0.1.43**

This is a pre-1.0 SDK. Expect breaking changes between minor versions until 1.0 is released.

## Important Notes

### Runtime Environment Clarification

Despite `package.json` specifying `"engines": { "bun": ">= 1", "node": ">= 22" }`, this SDK **does not run in Node.js at runtime**. These engine requirements are exclusively for:

- **Development tooling:** Building, testing, linting, and formatting
- **CI/CD pipelines:** Running automated tests and builds
- **Code generation:** OpenAPI type generation and validation

**The SDK is browser-only** and relies on browser-specific APIs unavailable in Node.js (WebCrypto, WebAuthn, window, localStorage).

## Contact & Support

- **Issues:** https://github.com/EntrustCorporation/idaas-auth-js/issues
- **Homepage:** https://github.com/EntrustCorporation/idaas-auth-js
- **Free Trial:** https://in.entrust.com/IDaaS/

---

_Last updated: November 7, 2025 (streamlined for clarity and removed unnecessary details)_
