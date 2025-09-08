import { pluginTypeCheck } from "@rsbuild/plugin-type-check";
import { defineConfig } from "@rslib/core";
import { pluginPublint } from "rsbuild-plugin-publint";

export default defineConfig({
  plugins: [pluginTypeCheck(), pluginPublint()],
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
