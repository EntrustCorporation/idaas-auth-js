[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [OidcClient](../README.md) / OidcClient

# Class: OidcClient

This class handles authorization for OIDC flows using both popup
and redirect authentication patterns. It manages the entire OIDC ceremony
including authorization URL generation, token exchange, validation, and processing
redirect callbacks.

Contains three main methods: login, logout, and handleRedirect.

## Constructors

### Constructor

> **new OidcClient**(`context`, `storageManager`): `OidcClient`

#### Parameters

##### context

`IdaasContext`

##### storageManager

`StorageManager`

#### Returns

`OidcClient`

## Methods

### handleRedirect()

> **handleRedirect**(): `Promise`\<`null`\>

Completes the OIDC authorization code flow after redirect from the identity provider.

Call this method at your application's `redirectUri` to:

1. Parse the authorization code from the URL query parameters
2. Exchange the code for tokens (access, ID, and optionally refresh)
3. Validate and store the tokens

This method should be called early in your application initialization at the redirect URI path,
typically before rendering your main application UI.

**Important**: Only required when using redirect mode (`popup: false` in `login()`).
Popup mode handles the callback automatically.

#### Returns

`Promise`\<`null`\>

`null` after processing the redirect, or `null` if current URL is not an OAuth callback

#### Throws

If client state cannot be recovered from storage

#### Throws

If authorization response contains an error

#### Throws

If token validation fails

#### See

[OIDC Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md)

---

### login()

> **login**(`options`, `tokenOptions`): `Promise`\<`string` \| `null`\>

Initiates the OIDC authorization code flow to authenticate the user.

Supports two modes:

- **Popup mode** (`popup: true`): Opens a popup window for authentication, automatically handles the callback,
  and returns the access token
- **Redirect mode** (`popup: false`): Redirects the current page to the identity provider. Your application
  must call `handleRedirect()` at the `redirectUri` to complete the flow

The flow uses PKCE (Proof Key for Code Exchange) for security and obtains:

- Access token (always)
- ID token (always)
- Refresh token (optional, if `useRefreshToken: true`)

#### Parameters

##### options

[`OidcLoginOptions`](../../index/interfaces/OidcLoginOptions.md) = `{}`

Login options including popup mode and redirect URI

##### tokenOptions

[`TokenOptions`](../../index/interfaces/TokenOptions.md) = `{}`

Token request options (audience, scope, refresh token, ACR values)

#### Returns

`Promise`\<`string` \| `null`\>

The access token if using popup mode, otherwise `null`

#### See

[OIDC Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md)

---

### logout()

> **logout**(`options`): `Promise`\<`void`\>

Logs the user out by clearing the local session and redirecting to the identity provider's logout endpoint.

This method:

1. Removes all stored tokens (access, ID, and refresh) from local storage
2. Redirects the browser to the identity provider's `end_session_endpoint`
3. Optionally redirects back to your application after logout completes

After logout, the user's session with the identity provider is terminated. If `redirectUri` is provided,
the identity provider will redirect the user back to that URI after logout.

#### Parameters

##### options

[`OidcLogoutOptions`](../../index/interfaces/OidcLogoutOptions.md) = `{}`

Logout options with optional redirect URI

#### Returns

`Promise`\<`void`\>

#### See

[OIDC Guide](https://github.com/EntrustCorporation/idaas-auth-js/blob/main/docs/guides/oidc.md)
