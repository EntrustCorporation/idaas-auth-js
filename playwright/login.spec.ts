import { type Page, expect, test } from "@playwright/test";
import { CLIENT_ID, DEV_SERVER, ISSUER, PASSWORD, USERNAME } from "./test-app/constants";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
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
  const storage = await page.context().storageState();
  const accessTokens = storage.origins[0].localStorage.find(({ name }) => {
    return name === `entrust.accessTokens.${CLIENT_ID}`;
  });
  const idToken = storage.origins[0].localStorage.find(({ name }) => {
    return name === `entrust.idToken.${CLIENT_ID}`;
  });

  expect(accessTokens).toBeTruthy();
  // Should always be true
  if (accessTokens) {
    const accessTokensJson = JSON.parse(accessTokens?.value);
    expect(accessTokensJson.length).toEqual(1);
    expect(accessTokensJson[0].accessToken).toEqual(tokenJson.access_token);
  }

  expect(idToken).toBeTruthy();
  // Should always be true
  if (idToken) {
    const idTokenJson = JSON.parse(idToken.value);
    expect(idTokenJson.encoded).toEqual(tokenJson.id_token);
  }

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
  let storage = await page.context().storageState();

  // Client state in local storage should match the returning url state
  const clientParams = storage.origins[0].localStorage.find(({ name }) => {
    return name === `entrust.clientParams.${CLIENT_ID}`;
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
  storage = await page.context().storageState();
  const accessTokens = storage.origins[0].localStorage.find(({ name }) => {
    return name === `entrust.accessTokens.${CLIENT_ID}`;
  });
  const idToken = storage.origins[0].localStorage.find(({ name }) => {
    return name === `entrust.idToken.${CLIENT_ID}`;
  });

  expect(accessTokens).toBeTruthy();
  // Should always be true
  if (accessTokens) {
    const accessTokensJson = JSON.parse(accessTokens?.value);
    expect(accessTokensJson.length).toEqual(1);
    expect(accessTokensJson[0].accessToken).toEqual(tokenJson.access_token);
  }

  expect(idToken).toBeTruthy();
  // Should always be true
  if (idToken) {
    const idTokenJson = JSON.parse(idToken.value);
    expect(idTokenJson.encoded).toEqual(tokenJson.id_token);
  }

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
  expect(page.getByTestId("user-info-state")).toBeTruthy();
  await expect(page.getByTestId("id-token-state")).toContainText(`"sub": "${USERNAME}"`);
};
