import { IdaasClient } from "../../src";

const CLIENT_ID = process.env.CLIENT_ID as string;
const DEV_SERVER = process.env.DEV_SERVER as string;
const ISSUER = process.env.ISSUER as string;

/**
 * Initialize the IDaaS Client
 */
const initializeClient = () => {
  console.log(`Initializing client with issuer ${ISSUER}`);

  return new IdaasClient({
    issuerUrl: ISSUER,
    clientId: CLIENT_ID,
    storageType: "localstorage",
  });
};

const idaasClient: IdaasClient = initializeClient();

const updateUI = async () => {
  const isAuthenticated = idaasClient.isAuthenticated();
  let accessTokens: string | null = null;
  try {
    accessTokens = await idaasClient.getAccessToken();
  } catch {
    // Purposefully empty
  }
  const idToken = idaasClient.getIdTokenClaims();

  const idTokenField = document.getElementById("id-token-state");
  if (idTokenField) {
    idTokenField.innerText = JSON.stringify(idToken, null, 2);
  }

  const authenticatedStateLabel = document.getElementById("authenticated-state");
  if (authenticatedStateLabel) {
    authenticatedStateLabel.innerText = String(isAuthenticated);
  }

  const accessTokenField = document.getElementById("access-token-state");
  if (accessTokenField) {
    accessTokenField.innerText = String(accessTokens);
  }
};

document.getElementById("login-with-popup")?.addEventListener("click", async () => {
  console.info("Logging in with popup flow");

  try {
    await idaasClient.oidc.login({ redirectUri: DEV_SERVER, popup: true }, { useRefreshToken: true });
  } catch (e) {
    console.error("Login with popup failed.", e);
  }

  await updateUI();
});

document.getElementById("login-with-redirect")?.addEventListener("click", async () => {
  console.info("Logging in with redirect flow");

  try {
    await idaasClient.oidc.login({ redirectUri: DEV_SERVER, popup: false }, { useRefreshToken: true });
  } catch (e) {
    console.error("Login with redirect failed.", e);
  }

  await updateUI();
});

document.getElementById("logout")?.addEventListener("click", async () => {
  console.info("Logging out");

  try {
    await idaasClient.oidc.logout({ redirectUri: DEV_SERVER });
  } catch (e) {
    console.error("Logout failed", e);
  }

  await updateUI();
});

document.getElementById("handle-redirect")?.addEventListener("click", async () => {
  console.info("Handling redirect");

  try {
    await idaasClient.oidc.handleRedirect();
  } catch (e) {
    console.error("Handle redirect failed", e);
  }

  await updateUI();
});

document.getElementById("get-user-info")?.addEventListener("click", async () => {
  console.info("Getting user info");

  try {
    const userInfo = await idaasClient.getUserInfo();
    const userInfoState = document.getElementById("user-info-state");
    if (userInfoState) {
      userInfoState.innerText = JSON.stringify(userInfo, null, 2);
    }
  } catch (e) {
    console.error("Get user info failed", e);
  }
});

document.getElementById("get-access-token")?.addEventListener("click", async () => {
  console.info("Getting access token");

  try {
    await idaasClient.getAccessToken();
    await updateUI();
  } catch (e) {
    console.error("Get access token failed", e);
  }
});

window.addEventListener("load", async () => {
  await updateUI();
});
