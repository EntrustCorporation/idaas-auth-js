import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  client: {
    bundle: true,
    name: "@hey-api/client-fetch",
  },
  input: "./authentication.json",
  output: {
    path: "src/models/openapi-ts",
  },
});
