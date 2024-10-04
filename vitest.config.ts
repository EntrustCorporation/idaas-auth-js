import { coverageConfigDefaults, defineConfig } from "vitest/config";

// biome-ignore lint:
export default defineConfig({
  test: {
    dir: "__tests__",
    environment: "happy-dom",
    coverage: {
      include: ["src/**"],
      exclude: [...coverageConfigDefaults.exclude, "**/browser.ts", "**/models.ts"],
      provider: "v8",
      enabled: true,
      thresholds: {
        perFile: true,
        lines: 90,
        functions: 90,
      },
    },
  },
});
