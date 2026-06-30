# DPoP Protected Resource Requests

DPoP (Demonstration of Proof-of-Possession) binds an access token to a browser-held private key. This reduces the value of a stolen access token because the token must be presented with a signed proof from the matching key.

Use DPoP when your protected API or resource server validates RFC 9449 DPoP proofs. The SDK can acquire DPoP-bound tokens and create the client request headers, but the protected resource must enforce DPoP on the server side.

## SDK APIs for DPoP

DPoP support is exposed through token options and one DPoP-specific request helper.

### `TokenOptions.dpop`

Pass `dpop` anywhere the SDK accepts `TokenOptions` to request or use DPoP for that operation:

- `new IdaasClient(clientOptions, tokenOptions)` for default token behavior.
- `idaas.oidc.login(loginOptions, tokenOptions)` for hosted OIDC login.
- `idaas.rba.requestChallenge(authenticationRequestParams, tokenOptions)` for RBA authentication.
- `idaas.getAccessToken(tokenOptions)` for access-token lookup and refresh.
- `idaas.getUserInfo(accessToken, tokenOptions)` for SDK-managed UserInfo calls.

```typescript
const tokenOptions = {
  audience: "https://api.example.com",
  scope: "accounts:read",
  dpop: { alg: "ES256" }
};
```

The `dpop` object supports:

- `alg`: the signing algorithm for DPoP proof JWTs.
- `includeJkt`: when `true`, includes `dpop_jkt` in authorization requests that support it.

### `getDpopHeaders()`

Use `getDpopHeaders()` when your application calls its own DPoP protected resource. This method creates request headers for an existing DPoP-bound access token.

```typescript
const headers = await idaas.getDpopHeaders({
  method: "GET",
  uri: "https://api.example.com/accounts",
  accessToken
});
```

The method is intentionally DPoP-only. It does not return Bearer headers and does not create a new DPoP key for a Bearer token. The selected access token must already be stored by the SDK as DPoP-bound so the SDK can restore the key material referenced by that token.

### Exported types

The SDK exports these DPoP-related types:

- `DPoPOptions`: the shape of `TokenOptions.dpop`.
- `DpopHeadersOptions`: the parameter type for `getDpopHeaders()`.

## Request a DPoP-bound token

Pass `dpop` in token options when starting authentication or requesting an access token.

```typescript
await idaas.oidc.login(
  { popup: true },
  {
    audience: "https://api.example.com",
    scope: "openid profile email accounts:read",
    dpop: { alg: "ES256", includeJkt: true }
  }
);

const accessToken = await idaas.getAccessToken({
  audience: "https://api.example.com",
  scope: "accounts:read",
  dpop: { alg: "ES256" }
});
```

When DPoP is enabled, the SDK creates key material in the browser, stores the private key as non-extractable key material, and stores a reference to that key with the DPoP-bound access token.

## Call a DPoP protected resource

Use `getDpopHeaders()` to create the `Authorization` and `DPoP` headers for your API request.

```typescript
const accessToken = await idaas.getAccessToken({
  audience: "https://api.example.com",
  scope: "accounts:read",
  dpop: { alg: "ES256" }
});

if (!accessToken) {
  throw new Error("No access token available");
}

const headers = await idaas.getDpopHeaders({
  method: "GET",
  uri: "https://api.example.com/accounts",
  accessToken
});

const response = await fetch("https://api.example.com/accounts", {
  method: "GET",
  headers
});
```

The returned headers have this shape:

```typescript
{
  Authorization: "DPoP <access-token>",
  DPoP: "<signed-proof-jwt>"
}
```

`getDpopHeaders()` is DPoP-specific. It does not fall back to Bearer headers. It throws when the selected token is not DPoP-bound, when key material cannot be restored, or when the protected resource URI is not absolute `http` or `https`.

## What the protected resource must verify

The SDK only creates the client-side request headers. Your API, gateway, or resource server must validate the token and proof before serving the request.

At minimum, the protected resource must verify:

- The access token signature, issuer, audience, expiry, scopes, and claims.
- The request uses `Authorization: DPoP <access-token>`.
- The `DPoP` proof JWT signature is valid with the public JWK in the proof header.
- The proof header has `typ: "dpop+jwt"`.
- The `htm` claim matches the HTTP method.
- The `htu` claim matches the request URI after removing query and fragment.
- The `iat` value is recent and the proof has not expired.
- The `jti` value has not already been used for that key.
- The `ath` claim matches the SHA-256 hash of the access token.
- The access token confirmation claim `cnf.jkt` matches the JWK thumbprint of the DPoP proof public key.

That final `cnf.jkt` comparison is what proves the caller has both the access token and the private key bound to it.

## Security notes

- DPoP does not replace normal access-token validation. It adds proof-of-possession checks on top of it.
- DPoP does not make XSS harmless. If attacker-controlled JavaScript runs in your page, it may be able to call SDK methods while the session is active.
- Do not expose private key material or raw DPoP signing primitives to application code.
- Use Content Security Policy and standard SPA hardening to reduce script injection risk.
- Use `https` for protected resources in production.
