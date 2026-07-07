# AGENTS.md

## Project Overview

`@entrustcorp/idaas-auth-js` — Entrust IDaaS authentication SDK for browser SPAs. Browser-only, ESM-only.

OIDC+PKCE, in-app RBA/MFA challenges, passwordless (passkey/biometric), DPoP-bound tokens (RFC 9449), RFC 9470/6750 step-up parsing (`parseResponse`). Full feature list: README.md.

**Stack:** TypeScript, rslib (build), Biome+Prettier (lint/format), Bun (dev runtime/test). Core deps: `jose` (JWT/crypto), optional peer `onfido-sdk-ui` (face biometric).

## Architecture

- **`IdaasClient`** (`src/IdaasClient.ts`) — main facade. `.oidc`/`.rba`/`.auth` sub-clients plus `isAuthenticated()`, `getIdTokenClaims()`, `getAccessToken()`, `getUserInfo()`, `getDpopHeaders()`, `parseResponse()`.
- **`OidcClient`** (`src/OidcClient.ts`) — hosted OIDC (Authorization Code + PKCE): `login()` (redirect/popup), `logout()`, `handleRedirect()`.
- **`RbaClient`** (`src/RbaClient.ts`) — self-hosted risk-based auth: `requestChallenge()`, `submitChallenge()`, `poll()`, `cancel()`.
- **`AuthClient`** (`src/AuthClient.ts`) — convenience wrappers over RBA per authenticator (password, OTP, soft token, passkey, grid, KBA, temp access code, magic link, smart credential, face).
- **`StorageManager`** (`src/storage/StorageManager.ts`) — persists client params, access/ID/refresh tokens, DPoP key refs. `Store` interface + `MemoryStore`/`LocalStore` impls are defined directly in this one file (no separate storage abstraction files).
- **`IdaasContext`** (`src/IdaasContext.ts`) — shared config (issuerUrl, clientId, global token/DPoP defaults) passed to all clients.

Public API is exported from `src/index.ts` — grep it for the authoritative type list, don't hand-maintain a copy here. Utility files (`src/utils/*.ts`): crypto (PKCE), jwt, url, format, passkey, `dpop*.ts` (DPoP proof/keys/cleanup), wwwAuthenticate (RFC 9470 parser), browser (popup helpers) — one concern per file.

### Directory Structure

```
src/
├── IdaasClient.ts, OidcClient.ts, RbaClient.ts, AuthClient.ts  # Core clients
├── AuthenticationTransaction.ts  # Transaction state management
├── IdaasContext.ts               # Configuration context
├── api.ts / index.ts             # API client / public exports
├── models/                       # Types (+ openapi-ts/ generated from OpenAPI spec)
├── storage/StorageManager.ts     # Token/state persistence
└── utils/                        # See Architecture above

test/
├── unit/            # Bun test — IdaasClient/, RbaClient/, storage/, utils/
├── e2e/             # Playwright specs
├── test-manual/     # Manual test server, one page per authenticator type
├── test-spa/        # Test SPA used by E2E tests
└── test-idp/        # Test OIDC provider used by E2E tests
```

## Development Workflow

Scripts live in `package.json`; a few have non-obvious behavior:

- `bun install` — postinstall also runs `api:generate`
- `bun run docs:generate` — regenerates `docs/api/` from TypeDoc
- `bun run test:e2e` — Playwright auto-starts the test IdP (`:3000`) and test SPA (`:8080`)
- `bun run lint:types` — runs `attw` (validates published type exports resolve), distinct from `bun run type-check` (tsc)

### Commit Messages

Conventional Commits. `feat`/`fix`/`feat!` drive Release Please version bumps; `chore` does not.

**`chore:` vs `fix:`** — only use `fix:` for bugs in the **published SDK**. CI/build/config changes are `chore:`.

Validate locally with `bun run lint:commits`; CI enforces this.

## Key Concepts

- **Tokens:** `StorageManager` manages access/ID/refresh tokens. Access tokens carry scope/audience/expiry/ACR and, when DPoP is enabled, a `dpopKeyRef` binding them to a persisted keypair. `storageType: "memory"` (default, cleared on refresh) vs `"localstorage"` (persists, XSS-exposed) — an app-level tradeoff, not a default to change casually.
- **PKCE:** always on for OIDC/RBA authorization flows (`utils/crypto.ts`).
- **DPoP (RFC 9449):** opt-in per token request via `dpop: { alg }`, requires a matching proof (`getDpopHeaders()`) on each protected-resource request; server verifies `cnf.jkt`. See `docs/guides/dpop.md`.
- **API surface:** OIDC endpoints come from the issuer's discovery doc; the Authentication API (derived from `issuerUrl`) is `POST /authenticate` (request), `POST /authenticate/{transactionId}` (submit), `GET .../{transactionId}` (poll), `DELETE .../{transactionId}` (cancel).
- Usage examples (login flows, RBA lifecycle, ACR classes, `includeOpenidScope: false`, `transactionDetails`): `docs/guides/` (`oidc.md`, `rba.md`, `auth.md`, `dpop.md`, `step-up.md`) and the README quickstart — not duplicated here.

## Publishing & CI

**Never** manually bump versions, tag, or `npm publish` — Release Please publishes to npm (Trusted Publishing/OIDC) when its release PR is merged.

`.github/workflows/`:

- `build.yaml` — install → lint commits → generate docs + verify no diff → lint → type-check → knip → build → `lint:types` → unit + E2E tests → verify npm package
- `release-please.yml` — release PRs + publish
- `new-version.yml` — scheduled check for upstream IDaaS API changes
- `sync-to-github.yml` — mirrors `main`/tags to github.com

## Documentation

- Users: `README.md`, `docs/quickstart.md`, `docs/self-hosted.md`, `docs/troubleshooting.md`, full guide index at `docs/guides/README.md`.
- Generated API reference: `docs/api/` (not `docs/reference/` — that path doesn't exist).

## Maintaining This Document

Update when architecture, public APIs, directory structure, or dev workflow change — skip it for bug fixes, refactors, or version bumps. Litmus test: does an agent need this specific fact, and is it _not_ already discoverable via grep/TypeDoc/`docs/guides/`? If not, cut it. Task-specific playbooks belong in `.agents/common-tasks.md`, not here. Keep this file under ~200 lines.

---

_Last updated: July 7, 2026_
