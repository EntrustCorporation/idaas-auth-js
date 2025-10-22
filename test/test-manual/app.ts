import { watch } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const baseDir = import.meta.dir;
const outDir = join(baseDir, "dist");

console.log(process.env.CLIENT_ID);

// Build function
const buildProject = async () => {
  console.log("🏗️ Building", baseDir);

  await Bun.build({
    entrypoints: [
      join(baseDir, "./soft-token/soft-token.ts"),
      join(baseDir, "./grid/grid.ts"),
      join(baseDir, "./rba-mfa/rba-mfa.ts"),
      join(baseDir, "./password/password.ts"),
      join(baseDir, "./passkey/passkey.ts"),
      join(baseDir, "./kba/kba.ts"),
      join(baseDir, "./temp-access-code/temp-access-code.ts"),
    ],
    outdir: outDir,
    root: baseDir,
    env: "inline",
  });
};

// Set up file watching for hot reload
const setupHotReload = () => {
  const srcDir = join(baseDir, "../../src"); // Watch the main source directory
  const testDir = baseDir; // Watch the test directory

  console.log("👀 Watching for file changes...");

  // Watch TypeScript files in src and test directories
  const watcher1 = watch(srcDir, { recursive: true }, async (_eventType, filename) => {
    if (filename && (filename.endsWith(".ts") || filename.endsWith(".js"))) {
      console.log(`📁 Source file changed: ${filename}`);
      await buildProject();
      console.log("🔄 Rebuild complete - refresh browser to see changes");
    }
  });

  const watcher2 = watch(testDir, { recursive: false }, async (_eventType, filename) => {
    if (filename && (filename.endsWith(".ts") || filename.endsWith(".js"))) {
      console.log(`📁 Test file changed: ${filename}`);
      await buildProject();
      console.log("🔄 Rebuild complete - refresh browser to see changes");
    }
  });

  return [watcher1, watcher2];
};

(async () => {
  console.log("♻️ Cleaning", outDir);

  await $`rm -rf ${outDir}`;

  // Initial build
  await buildProject();

  // Set up hot reload
  const watchers = setupHotReload();

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

      try {
        await bunfile.stat();
        return new Response(bunfile);
      } catch (_error) {
        return new Response("File not found", { status: 404 });
      }
    },
  });

  console.log("🚀", server.url.origin);
  console.log("💡 Hot reload enabled - changes to .ts files will trigger rebuilds");
  console.log("💡 HTML changes require manual browser refresh");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    watchers.forEach((watcher) => watcher.close());
    process.exit(0);
  });
})();
