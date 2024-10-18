# IDaaS Auth JavaScript SPA SDK

The IDaaS Auth SDK simplifies integrating secure authentication into your JavaScript SPAs. Designed for flexibility and ease of use, it is fully configurable and customizable. Allowing developers to leverage the power of IDaaS through a simple API that handles their authentication needs.

# Create a Free Trial Account

Entrust Identity as a Service (IDaaS) is a cloud-based identity and access management (IAM) solution with multi-factor authentication (MFA), credential-based passwordless access, and single sign-on (SSO).

Get started with a [free trial](https://in.entrust.com/IDaaS/) account today.

# Getting Started

## Installation

TODO

## Configure Your IDaaS Application

1. After logging in as an administrator, navigate to the applications page.
2. Click the plus sign in the top left to create a new application.
3. Scroll down and select `Generic SPA Application`.
4. On the `Setup` page, check the `Authorization Code` grant type. This SDK supports only the authorization code flow with PKCE.
5. If you intend to use refresh tokens, check the `Refresh Token (OIDC)` grant type. Failing to do so will cause errors if you attempt to use refresh tokens.
6. Add all URIs that you may redirect to after a successful login or logout. Failing to do so will cause errors if you attempt to redirect to a different URI.
7. Make any other changes necessary for your application, then submit your changes.

**Make note of your application's `Client ID` and `Issuer URL` (typically `https://{yourIdaasDomain}.region.trustedauth.com/api/oidc`). These will be required to configure the SDK.**

## Configure the SDK

Create an `IdaasClient` before rendering or initializing your application. You should only ever have one instance of the client.

```typescript
import { IdaasClient } from "./IdaasClient";

// you can create a client using our default global values
const defaultIdaasClient = new IdaasClient({
  clientId: "<IDAAS_CLIENT_ID>",
  issuerUrl: "<IDAAS_ISSUER_URL>",
});

// or create a customized variant by setting the global values to be used
const customIdaasClient = new IdaasClient({
  clientId: "<IDAAS_CLIENT_ID>",
  issuerUrl: "<IDAAS_ISSUER_URL>",
  globalAudience: "<GLOBAL_AUDIENCE>",
  globalScope: "<GLOBAL_SCOPE>",
  globalUseRefreshToken: true | false,
});
```

## Logging In With Redirect

You can then log in using the `IdaasClient` instance you created. Logging in with redirect will redirect the user to an IDaaS login page to enter their login information. It will then redirect them to `redirectUrl` if authentication is successful.

```html
<button id="login-with-redirect">Click to Login With Redirect</button>
```

```typescript
// redirect to the IDaaS login page
document.getElementById("login-with-redirect").addEventListener("click", () => {
  // ensure <MY_LOGIN_REDIRECT_URI> has been added to the list of valid login redirect URIs in your IDaaS application configuration
  idaasClient.login({ popup: false, redirectUri: "<MY_LOGIN_REDIRECT_URI>" });
});
```

```typescript
// in your callback route (<MY_LOGIN_REDIRECT_URI>)
window.addEventListener("load", async () => {
  await idaasClient.handleRedirect();
  // you've now logged in with redirect, you can get the stored ID token claims like this:
  const idToken = idaasClient.getIdTokenClaims();
  console.log(idToken);
});
```

## Logging Out

```html
<button id="logout">Logout</button>
```

```typescript
document.getElementById("logout").addEventListener("click", () => {
  idaasClient.logout();
});
```

You can redirect users back to your app after logging out. This URL must be present in the Logout Redirect URI(s) setting for the app in your IDaaS application configuration:

```typescript
idaasClient.logout({ redirectUri: "<MY_LOGOUT_REDIRECT_URI>" });
```

# More Examples

## Logging In With Popup

To log in with popup, ensure the `popup` flag is `true`. Logging in with popup will open a login popup for the user to enter their login information. The access token received from this login will be returned upon successful authentication.

```html
<button id="login-with-popup">Click to Login With Popup</button>
```

```typescript
document
  .getElementById("login-with-popup")
  .addEventListener("click", async () => {
    // open the IDaaS login popup
    await idaasClient.login({ popup: true });
    // you've now logged in with popup, you can get the stored ID token claims like this:
    const idToken = idaasClient.getIdTokenClaims();
    console.log(idToken);
  });
```

You can specify the context class(es) of authentication that are acceptable to be used to authenticate the user. Successful authentication via methods that do not fall under the specified authentication context class(es) will be treated as a failed authentication attempt.

**Note: To use this value later, the received access token must not be opaque.**

```typescript
document
  .getElementById("login-with-popup")
  .addEventListener("click", async () => {
    // authenticate using an authentication method that falls under the `knowledge` authentication context class
    await idaasClient.login({ popup: true, acrValues: ["knowledge"] });
    const idToken = idaasClient.getIdTokenClaims();
    console.log(idToken);
  });
```

## Access Tokens

### Accessing a Resource

Retrieve an access token to pass along in the `Authorization` header using `getAccessToken`:

```html
<button id="access-resource">Click to Access Resource</button>
```

```typescript
document
  .getElementById("access-resource")
  .addEventListener("click", async () => {
    // "<SCOPE>" and "<AUDIENCE>" specify the scope and audience of the token to be fetched
    const token = idaasClient.getAccessToken({
      audience: "<AUDIENCE>",
      scope: "<SCOPE>",
    });
    const response = await fetch(`https://resource.com`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    console.log(data);
  });
```

### Requesting a New Access Token

Request an access token that is not already stored by supplying `fallbackAuthorizationOptions` to `getAccessToken`. Doing so will initiate an access token request from the authorization server.

```html
<button id="access-resource">Click to Retrieve Access Token</button>
```

```typescript
document
  .getElementById("access-resource")
  .addEventListener("click", async () => {
    // a login with popup will be attempted to fetch a token with "<SCOPE>" and "<AUDIENCE>" if there is not a token with "<SCOPE>" and "<AUDIENCE>" already stored.
    const token = idaasClient.getAccessToken({
      audience: "<AUDIENCE>",
      scope: "<SCOPE>",
      fallbackAuthorizationOptions: {
        popup: true,
      },
    });

    const response = await fetch(`https://resource.com`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    console.log(data);
  });
```

### Verify Context Class of Authentication

You are able to specify the context class(es) of authentication that must be/have been used when authenticating the user to receive the token.
```html
<button id="password_login">Authenticate Using Knowledge Authentication</button>
```

```typescript
document
  .getElementById("access-resource")
  .addEventListener("click", async () => {
    const token = idaasClient.getAccessToken({
      // Retrieve a token with <SCOPE> and <AUDIENCE> that was authenticated via a `knowledge` method of authentication
      audience: "<AUDIENCE>",
      scope: "<SCOPE>",
      acrValues: ["knowledge"],
      // If the token is not found, login via an authentication method that falls under the `knowledge` context class to receive this token
      fallbackAuthorizationOptions: {
        popup: true,
      },
    });

    const response = await fetch(`https://resource.com`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    console.log(data);
  });
```

## User Authentication

Authentication status is determined by the presence of an ID token. If an ID token is stored, the user is authenticated.

```html
<button id="check-authentication">Click to Check Authentication Status</button>
```

```typescript
document
  .getElementById("check-authentication")
  .addEventListener("click", () => {
    const isAuthenticated = idaasClient.isAuthenticated();

    if (isAuthenticated) {
      console.log("User is authenticated");
    } else {
      console.log("User is not authenticated");
    }
  });
```

### Getting Information About the Logged-in User

```html
<button id="get-information">Click to get Information</button>
```

```typescript
document
  .getElementById("get-information")
  .addEventListener("click", async () => {
    // assumes the user is logged in and an access token is stored
    const userInfo = await idaasClient.getUserInfo();
    console.log("User Info", userInfo);
  });
```

### Fetching the Stored ID Token

```html
<button id="get-id-token">Click to get ID token</button>
```

```typescript
document.getElementById("get-id-token").addEventListener("click", () => {
  // assumes the user is authenticated
  const idToken = idaasClient.getIdTokenClaims();
  console.log("ID Token", idToken);
});
```