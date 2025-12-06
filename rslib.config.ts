import { defineConfig } from "@rslib/core";
import { pluginPublint } from "rsbuild-plugin-publint";

export default defineConfig({
  plugins: [pluginPublint()],
  lib: [
    {
      format: "esm",
      syntax: "es2022",
      bundle: true,
      autoExternal: true,
      dts: {
        bundle: true,
      },
      output: {
        cleanDistPath: true,
        target: "web",
        externals: ["onfido-sdk-ui"],
      },
    },
  ],
});
