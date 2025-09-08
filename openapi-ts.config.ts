import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./authentication.json",
  output: {
    path: "src/models/openapi-ts",
  },
  plugins: ["@hey-api/client-fetch"],
});
