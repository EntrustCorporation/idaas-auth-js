import { expect, test } from "@playwright/test";

const { DEV_SERVER = "", ISSUER = "" } = process.env;

if (!DEV_SERVER || !ISSUER) {
  throw new Error("Missing required environment variables for E2E tests. Required: DEV_SERVER, ISSUER");
}

/**
 * If these tests fail, it is an issue with server initialization, not the SDK
 */
test("client is initialized", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(DEV_SERVER);
  await expect(page).toHaveTitle("IDaaS");
});

test("server is initialized", async ({ request }) => {
  const url = `${ISSUER}/.well-known/openid-configuration`;
  const response = await request.get(url);

  expect(response.ok()).toBeTruthy();

  const responseBody = await response.json();

  expect(responseBody.issuer).toEqual(ISSUER);
});
