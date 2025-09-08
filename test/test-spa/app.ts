import { join } from "node:path";
import { $ } from "bun";

const baseDir = import.meta.dir;
const outDir = join(baseDir, "dist");

console.log(process.env.CLIENT_ID);

(async () => {
  console.log("♻️ Cleaning", outDir);

  await $`rm -rf ${outDir}`;

  console.log("🏗️ Building", baseDir);

  await Bun.build({
    entrypoints: [join(baseDir, "./index.ts")],
    outdir: outDir,
    root: baseDir,
    env: "inline",
  });

  console.log("🍦 Serving", baseDir);

  const server = Bun.serve({
    port: 8080,
    development: true,
    async fetch(req) {
      const url = new URL(req.url);

      const filename = url.pathname === "/" ? "index.html" : url.pathname;

      console.info("🟢", req.method, filename);

      const fullPath = join(baseDir, filename);

      const bunfile = Bun.file(fullPath);

      await bunfile.stat();

      return new Response(bunfile);
    },
  });

  console.log("🚀", server.url.origin);
})();
