import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  name: "E2E Tests",
  testDir: "./test/e2e",
  reporter: "html",
  use: {
    baseURL: "http://localhost:8080",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: "bun ./test/test-idp/oidc-provider.ts",
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run ./test/test-spa/app.ts",
      port: 8080,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
