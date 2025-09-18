import { pluginTypeCheck } from "@rsbuild/plugin-type-check";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  plugins: [pluginTypeCheck()],
  lib: [
    {
      format: "esm",
      syntax: "es2021",
      bundle: true,
      dts: {
        bundle: true,
      },
      output: {
        cleanDistPath: true,
        target: "web",
      },
    },
  ],
});
