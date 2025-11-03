# Core Concepts

## IdaasClient lifecycle

1. Instantiate `IdaasClient` with issuer and client ID.
2. Trigger an auth flow (`oidc`, `rba`, or `auth`).
3. Consume tokens via helper methods (`getAccessToken`, `getIdTokenClaims`).

## Tokens and storage

- Access and ID tokens are stored using the configured storage manager (`memory`, `session`, `local`).
- `globalAudience`, `globalScope`, and `globalUseRefreshToken` set defaults for new transactions.

## Error handling

- Methods throw errors with context from the underlying API.
- Wrap calls in `try/catch` and inspect error codes/messages.