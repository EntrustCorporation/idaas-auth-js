# IDaaS Auth JavaScript SPA SDK

---

The IDaaS Auth SDK simplifies integrating secure authentication into your JavaScript SPAs.  Designed for flexibility and ease of use, it is fully configurable and customizable. Allowing developers to leverage the power of IDaaS through a simple API that handles their authentication needs.

# Create a Free Trial Account

---

Entrust Identity as a Service (IDaaS) is a cloud-based identity and access management (IAM) solution with multi-factor authentication (MFA), credential-based passwordless access, and single sign-on (SSO).

Get started with a [free trial](https://in.entrust.com/IDaaS/) account today.

# Getting Started

---

## Installation

TODO

## Configure Your IDaaS Application

1. After logging in as an administrator, navigate to the applications page.
2. Click the plus sign in the top left to create a new application.
3. Scroll down and select `Generic SPA Application`.
4. On the `Setup` page, check the `Authorization Code` grant type. This SDK supports only the authorization code flow. 
5. If you intend to use refresh tokens, check the `Refresh Token (OIDC)` grant type.  Failing to do so will cause errors if you attempt to use refresh tokens.
6. Add all URIs that you may redirect to after a successful login or logout. Failing to do so will cause errors if you attempt to redirect to a different URI.
7. Make any other changes necessary for your application, then submit your changes.`

**Make note of your application's `Client ID` and `Issuer URL` (typically `https://{yourIdaasDomain}/api/oidc`). These will be required to configure the SDK.**

## Configure the SDK

Create an `IdaasClient` before rendering or initializing your application. You should only ever have one instance of the client.

```typescript
    import {IdaasClient} from "./IdaasClient";
    
    // you can create a client using our defaults
    const defaultIdaasClient = new IdaasClient({
        clientId: `<IDAAS_CLIENT_ID>`,
        issuerUrl: `<IDAAS_ISSUER_URL>`,
    })

    // or create a customized variant by setting the defaults to be used
    const customIdaasClient = new IdaasClient({
        clientId: `<IDAAS_CLIENT_ID>`,
        issuerUrl: `<IDAAS_ISSUER_URL>`,
        defaultAudience: `<DEFAULT_AUDIENCE>`,
        defaultScope: `<DEFAULT_SCOPE>`,
        defaultUseRefreshToken: true | false
    })
```

## Logging In With Redirect

You can then log in using the `IdaasClient` instance you created. Logging in with redirect will redirect you to an IDaaS login page to enter your login information. It will then redirect to `redirectUrl` if authentication is successful.

```html
    <button id="login-with-redirect">Click to Login With Redirect</button>
```

```typescript
    // login and redirect to <MY_LOGIN_REDIRECT_URI>
    // ensure <MY_LOGIN_REDIRECT_URI> has been added to the list of valid login redirect URIs in your IDaaS application configuration
    document.getElementById("login-with-redirect").addEventListener("click", () => {
        idaasClient.login({popup: false, redirectUri: `<MY_LOGIN_REDIRECT_URI>`});      
    })
```

```typescript
    // in your callback route (<MY_LOGIN_REDIRECT_URI>)
    
    window.addEventListener("load", async () => {
        await idaasClient.handleRedirect();
        // you've now logged in with redirect, you can get the stored ID token like this:
        const idToken = idaasClient.getIdToken();
        console.log(idToken);
    })
```

## Logging Out
```html
    <button id="logout">Logout</button>
```

```typescript
    document.getElementById('logout').addEventListener('click', () => {
      idaasClient.logout();
    });
```
You can redirect users back to your app after logging out. This URL must be present in the Logout Redirect URI(s) setting for the app in your IDaaS application configuration:

```typescript
    idaasClient.logout(`<MY_LOGOUT_REDIRECT_URI>`);
```


# More Examples 

---

## Logging In With Popup

To log in with popup, ensure the `popup` flag is `true`. Logging in with popup will open a login popup to enter your login information. The access token received from this login will be returned upon successful authentication.


```html
    <button id="login-with-popup">Click to Login With Popup</button>
```

```typescript
    // redirect to the universal login page
    document.getElementById("login-with-popup").addEventListener("click", async () => {
        await idaasClient.login({popup: true});
        // you've now logged in with popup, you can get the stored ID token like this:
        const idToken = idaasClient.getIdToken();
        console.log(idToken);
    })
```

## Accessing a Resource

Retrieve an access token to pass along in the `Authorization` header using `getAccessToken`:

```html
    <button id="access-resource">Click to Access Resource</button>
```

```typescript

    document.getElementById("access-resource").addEventListener("click", async () => {
        // `<SCOPE>` and `<AUDIENCE>` specify the scope and audience of the token to be fetched
        const token = idaasClient.getAccessToken({audience: `<AUDIENCE>`, scope: `<SCOPE>`})
        const response = await fetch(`https://resource.com`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        console.log(data);
    })
```

## Getting Information About the Logged-in User

```html
    <button id="get-information">Click to get Information</button>
```

```typescript
    document.getElementById("get-information").addEventListener("click", async () => {
        // assumes the user is logged in and an access token is stored
        const userInfo = await idaasClient.getUserInfo();
        console.log("User Info", userInfo);
    })
```

## Fetching the stored ID token

```html
    <button id="get-id-token">Click to get ID token</button>
```

```typescript
    document.getElementById("get-id-token").addEventListener("click", () => {
        // assumes the user is authenticated
        const idToken = idaasClient.getIdToken();
        console.log("ID Token", idToken);
    })
```

## Checking if the User is Authenticated 

Authentication status is determined by the presence of an ID token. If an ID token is stored, the user is authenticated.

```html
    <button id="check-authentication">Click to Check Authentication Status</button>
```
```typescript
    document.getElementById("check-authentication").addEventListener("click", () => {
        const isAuthenticated = idaasClient.isAuthenticated();
        
        if (isAuthenticated) {
            console.log("User is authenticated");
        } else {
            console.log("User is not authenticated");
        }
    })
```
