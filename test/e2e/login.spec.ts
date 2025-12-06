import { expect, type Page, test } from "@playwright/test";
import { config } from "dotenv";

config();

const { CLIENT_ID = "", DEV_SERVER = "", ISSUER = "", PASSWORD = "", USERNAME = "" } = process.env;

if (!CLIENT_ID || !DEV_SERVER || !ISSUER || !PASSWORD || !USERNAME) {
  throw new Error(
    "Missing required environment variables for E2E tests. Required: CLIENT_ID, DEV_SERVER, ISSUER, PASSWORD, USERNAME",
  );
}

const CLIENT_PARAMS_KEY = `entrust.${CLIENT_ID}.clientParams`;
const ACCESS_TOKENS_KEY = `entrust.${CLIENT_ID}.accessTokens`;
const ID_TOKENS_KEY = `entrust.${CLIENT_ID}.idToken`;

/**
 * Helper function to validate tokens are correctly stored in localStorage
 */
const validateTokenStorage = async (page: Page, expectedAccessToken: string, expectedIdToken: string) => {
  const storage = await page.context().storageState();
  const accessTokens = storage.origins[0]?.localStorage.find(({ name }) => name === ACCESS_TOKENS_KEY);
  const idToken = storage.origins[0]?.localStorage.find(({ name }) => name === ID_TOKENS_KEY);

  expect(accessTokens).toBeTruthy();
  if (accessTokens) {
    const accessTokensJson = JSON.parse(accessTokens.value);
    expect(accessTokensJson.length).toEqual(1);
    expect(accessTokensJson[0].accessToken).toEqual(expectedAccessToken);
  }

  expect(idToken).toBeTruthy();
  if (idToken) {
    const idTokenJson = JSON.parse(idToken.value);
    expect(idTokenJson.encoded).toEqual(expectedIdToken);
  }
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  // Only logout if authenticated
  const isAuthenticated = await page.getByTestId("authenticated-state").textContent();

  if (isAuthenticated === "true") {
    // Logout
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(new RegExp(`${ISSUER}/session/end`));
    await page.getByRole("button", { name: "Yes, sign me out" }).click();
    await expect(page).toHaveURL(DEV_SERVER);

    // Should no longer be authenticated
    await expect(page.getByTestId("authenticated-state")).toHaveText("false");

    // Tokens should be cleared
    await expect(page.getByTestId("access-token-state")).toHaveText("null");
    await expect(page.getByTestId("id-token-state")).toHaveText("null");
  }
});

test("login with popup", async ({ page }) => {
  const popupOpenPromise = page.waitForEvent("popup");
  await page.getByTestId("popup").click();
  const popupPage = await popupOpenPromise;

  await expect(page).toHaveURL(DEV_SERVER);
  await expect(popupPage).toHaveURL(new RegExp(ISSUER));

  // Log the user in at the OP
  await popupPage.getByRole("textbox", { name: "login" }).fill(USERNAME);
  await popupPage.getByRole("textbox", { name: "password" }).fill(PASSWORD);
  await popupPage.getByRole("button", { name: "Sign-in" }).click();

  const popupClosePromise = popupPage.waitForEvent("close");
  const tokenResponse = page.waitForResponse(new RegExp(`${ISSUER}/token`));
  await popupPage.getByRole("button", { name: "Continue" }).click();

  // Popup closed, client should
  await popupClosePromise;
  await expect(page).toHaveURL(DEV_SERVER);

  // Expect a call to the /token endpoint
  const token = await tokenResponse;
  const tokenJson = await token.json();
  expect(token.ok()).toBeTruthy();

  // Token stored in local storage should match the one from the response
  await validateTokenStorage(page, tokenJson.access_token, tokenJson.id_token);

  // Should be able to read access token
  await expect(page.getByTestId("access-token-state")).toContainText(tokenJson.access_token);

  await testAuthenticatedState(page);
});

test("login with redirect", async ({ page }) => {
  await page.getByTestId("redirect").click();

  await expect(page).toHaveURL(new RegExp(ISSUER));

  // Log the user in at the OP
  await page.getByRole("textbox", { name: "login" }).fill(USERNAME);
  await page.getByRole("textbox", { name: "password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Redirect back to client
  await expect(page).toHaveURL(new RegExp(DEV_SERVER));

  const url = new URL(page.url());
  const searchParams = url.searchParams;
  const storage = await page.context().storageState();

  // Client state in local storage should match the returning url state
  const clientParams = storage.origins[0]?.localStorage.find(({ name }) => {
    return name === CLIENT_PARAMS_KEY;
  });

  expect(clientParams).toBeTruthy();

  // Should always be true
  if (clientParams) {
    expect(JSON.parse(clientParams?.value).state).toEqual(searchParams.get("state"));
  }

  // Expect a call to the /token endpoint
  const tokenResponse = page.waitForResponse(new RegExp(`${ISSUER}/token`));
  await page.getByRole("button", { name: "Handle Redirect" }).click();
  const token = await tokenResponse;
  const tokenJson = await token.json();
  expect(token.ok()).toBeTruthy();

  // Query params should be cleared
  const clearedUrl = new URL(page.url());
  expect(clearedUrl.searchParams.size).toBeFalsy();

  // Token stored in local storage should match the one from the response
  await validateTokenStorage(page, tokenJson.access_token, tokenJson.id_token);

  // Should be able to read access token
  await expect(page.getByTestId("access-token-state")).toContainText(tokenJson.access_token);

  await testAuthenticatedState(page);
});

const testAuthenticatedState = async (page: Page) => {
  // Should now be authenticated
  await expect(page.getByTestId("authenticated-state")).toHaveText("true");

  // Should be able to read ID token claims
  await expect(page.getByTestId("id-token-state")).toContainText(`"sub": "${USERNAME}"`);
  await expect(page.getByTestId("id-token-state")).toContainText(`"aud": "${CLIENT_ID}"`);
  await expect(page.getByTestId("id-token-state")).toContainText(`"iss": "${ISSUER}"`);

  // Should be able to get user info
  await page.getByRole("button", { name: "Get User Info" }).click();
  await expect(page.getByTestId("user-info-state")).toContainText(`"sub": "${USERNAME}"`);
};

test("token refresh with expired access token", async ({ page }) => {
  // Login with popup to get initial tokens
  const popupOpenPromise = page.waitForEvent("popup");
  await page.getByTestId("popup").click();
  const popupPage = await popupOpenPromise;

  await popupPage.getByRole("textbox", { name: "login" }).fill(USERNAME);
  await popupPage.getByRole("textbox", { name: "password" }).fill(PASSWORD);
  await popupPage.getByRole("button", { name: "Sign-in" }).click();

  const popupClosePromise = popupPage.waitForEvent("close");
  const tokenResponse = page.waitForResponse(new RegExp(`${ISSUER}/token`));
  await popupPage.getByRole("button", { name: "Continue" }).click();

  await popupClosePromise;
  const token = await tokenResponse;
  const tokenJson = await token.json();

  // Get initial access token
  const initialAccessToken = tokenJson.access_token;
  await expect(page.getByTestId("access-token-state")).toContainText(initialAccessToken);

  // Verify refresh token exists in storage
  const storage = await page.context().storageState();
  const accessTokens = storage.origins[0]?.localStorage.find(({ name }) => name === ACCESS_TOKENS_KEY);
  expect(accessTokens).toBeTruthy();

  if (accessTokens) {
    const accessTokensJson = JSON.parse(accessTokens.value);
    expect(accessTokensJson[0].refreshToken).toBeTruthy();
  }

  // Wait for access token to expire (configured in test IDP for 5 minutes)
  // To speed up testing, we manipulate the token expiry in localStorage
  await page.evaluate(
    ({ key }) => {
      const stored = localStorage.getItem(key);
      if (stored) {
        const tokens = JSON.parse(stored);
        // Set expiresAt to past timestamp (not 'expiry')
        tokens[0].expiresAt = Math.floor(Date.now() / 1000) - 60;
        localStorage.setItem(key, JSON.stringify(tokens));
      }
    },
    { key: ACCESS_TOKENS_KEY },
  );

  // Request new access token - should trigger refresh
  // Set up response listener before clicking to avoid race condition
  const refreshTokenPromise = page.waitForResponse(new RegExp(`${ISSUER}/token`));
  await page.getByRole("button", { name: "Get Access Token" }).click();
  const refreshToken = await refreshTokenPromise;
  const refreshTokenJson = await refreshToken.json();

  expect(refreshToken.ok()).toBeTruthy();

  // New access token should be different from initial token
  const newAccessToken = refreshTokenJson.access_token;
  expect(newAccessToken).not.toEqual(initialAccessToken);

  // UI should show new access token
  await expect(page.getByTestId("access-token-state")).toContainText(newAccessToken);

  // Verify new token stored in localStorage
  await validateTokenStorage(page, newAccessToken, tokenJson.id_token);
});

test("login with invalid credentials", async ({ page }) => {
  const popupOpenPromise = page.waitForEvent("popup");
  await page.getByTestId("popup").click();
  const popupPage = await popupOpenPromise;

  await expect(popupPage).toHaveURL(new RegExp(ISSUER));

  // Attempt login with invalid credentials
  await popupPage.getByRole("textbox", { name: "login" }).fill("invalid@example.com");
  await popupPage.getByRole("textbox", { name: "password" }).fill("wrongpassword");
  await popupPage.getByRole("button", { name: "Sign-in" }).click();

  // Should show error message (exact message depends on IDP)
  await expect(popupPage.locator("body")).toContainText(/error|invalid|failed/i);

  // Popup should still be open
  expect(popupPage.isClosed()).toBeFalsy();

  // Main page should not be authenticated
  await expect(page.getByTestId("authenticated-state")).toHaveText("false");

  // Close popup manually
  await popupPage.close();
});

test("handle redirect without query parameters", async ({ page }) => {
  // Navigate directly to callback without going through login flow
  await page.goto(DEV_SERVER);

  // Try to handle redirect when there are no query parameters
  await page.getByRole("button", { name: "Handle Redirect" }).click();

  // Should remain unauthenticated
  await expect(page.getByTestId("authenticated-state")).toHaveText("false");
  await expect(page.getByTestId("access-token-state")).toHaveText("null");
  await expect(page.getByTestId("id-token-state")).toHaveText("null");
});
