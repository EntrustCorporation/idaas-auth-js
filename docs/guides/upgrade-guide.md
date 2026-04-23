# Upgrade Guide

This is the page users should be directed to whenever a release includes a breaking change.

Keep adding versioned sections here as new releases introduce breaking changes.

## 2.0.0 breaking changes

### `tokenOptions.acrValues` now uses a string

`tokenOptions.acrValues` now accepts a single string instead of a string array.

This matches the usual OIDC `acr_values` request format, which is space-delimited.

#### Before

```typescript
const tokenOptions = {
  acrValues: ["knowledge", "possession"]
};
```

#### After

```typescript
const tokenOptions = {
  acrValues: "knowledge possession"
};
```

#### Migration tip

If you already have an array of values, join them with a single space before passing them to the SDK:

```typescript
const acrValues = ["knowledge", "possession"];

const tokenOptions = {
  acrValues: acrValues.join(" ")
};
```

#### Affected APIs

Any API that accepts `TokenOptions` now expects `acrValues` as a string, including:

- `IdaasClient` constructor token options
- `getAccessToken(tokenOptions)`
- `oidc.login(loginOptions, tokenOptions)`
- `rba.requestChallenge(options, tokenOptions)`
- `parseResponse(response)` return values

## How to use this guide

When a new breaking change is introduced, add a new version section with:

- a short description of the change
- before/after examples if relevant
- a migration tip
- any affected APIs or user-facing behavior
