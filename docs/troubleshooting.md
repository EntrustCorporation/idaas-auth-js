# Troubleshooting

This guide lists common issues encountered when integrating the IDaaS Auth JS SDK and how to resolve them. If a problem isn’t covered here, enable verbose logging in your app and capture the request/response context from the browser dev tools.

---

## Quick checklist

1. Confirm the SDK version and browser support (Chromium 108+, Firefox 102+, Safari 15+).
2. Verify your Entrust tenant configuration (client ID, redirect URIs, authenticators, policies, resource servers).
3. Ensure required optional dependencies are installed (`onfido-sdk-ui` for face flows).
4. Inspect the network tab for failing requests (CORS, 4xx/5xx responses).

---

## Hosted OIDC flows (`oidc`)

| Symptom                                    | Likely cause                                                                         | Fix                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Popup window blocked or immediately closed | Browser blocked popups.                                                              | Switch to redirect flow (`popup: false`) or ask users to allow popups for your domain.    |
| `invalid_redirect_uri` error               | Redirect URI sent by SDK isn’t registered.                                           | Update the tenant app configuration or pass the correct `redirectUri` to `login`.         |
| `state mismatch`/`invalid_state`           | Callback handled without original state (e.g., multiple clients or double handling). | Use a single `IdaasClient` instance per request and call `handleRedirect()` only once per login. |

---

## `getAccessToken` / token storage

| Symptom                     | Likely cause                                                          | Fix                                                                                                |
| --------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Requested token not found` | Token cached under different scope/audience or cleared.               | Pass matching `scope`/`audience` or provide `fallbackAuthorizationOptions` to trigger a new login. |
| Refresh token not issued    | Tenant doesn’t allow refresh tokens or `useRefreshToken` not enabled. | Enable refresh tokens in tenant policy and set `globalUseRefreshToken: true` (or per-call).        |

---

## RBA / self-hosted flows (`rba`, `auth`)

| Symptom                                      | Likely cause                                                            | Fix                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `userId required` errors                     | Missing first argument on RBA/auth helpers.                             | Supply `userId` (only passkey discoverable flows may omit it).                        |
| `INVALID_TRANSACTION`                        | Calling `submit`/`poll` after the transaction expired or was cancelled. | Restart with `requestChallenge` or `authenticate*`.                                   |
| OTP never arrives                            | Wrong delivery channel/attribute.                                       | Specify `otpDeliveryType`/`otpDeliveryAttribute` or update the user profile in IDaaS. |
| Push/face flows never complete               | No polling or Onfido capture incomplete.                                | Call `auth.poll()`.                                                                   |
| Passkey flow rejected with `NotAllowedError` | User cancelled the browser prompt or WebAuthn unsupported.              | Prompt the user again or detect support via `browserSupportsPasskey()`.               |

---

## Convenience helpers (`auth.*`)

- **Missing `onfido-sdk-ui`** – Face flows throw module errors unless the optional peer dependency is installed: `npm install onfido-sdk-ui`.

---

## Common issues:

- Unsupported browser APIs (passkey requires WebAuthn).
- Missing optional dependency (`onfido-sdk-ui`) for face authentication.
- All calls go to the Entrust tenant domain; ensure the domain is reachable over HTTPS and CORS is allowed for your app origin.

## Need more help?

- Compare your implementation with [Self-Hosted UI Examples](self-hosted.md).