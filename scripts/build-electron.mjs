import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const electronOutputDirectory = path.join(projectRoot, "dist-electron");
const preloadEntry = path.join(projectRoot, "electron", "preload.cts");
const preloadOutput = path.join(electronOutputDirectory, "preload.cjs");
const typescriptCli = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

const typeScriptResult = spawnSync(
  process.execPath,
  [typescriptCli, "-p", path.join(projectRoot, "tsconfig.electron.json")],
  {
    cwd: projectRoot,
    stdio: "inherit",
  },
);

if (typeScriptResult.error) {
  throw typeScriptResult.error;
}

if (typeScriptResult.status !== 0) {
  process.exit(typeScriptResult.status ?? 1);
}

await build({
  configFile: false,
  logLevel: "warn",
  build: {
    emptyOutDir: false,
    lib: {
      entry: preloadEntry,
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    minify: false,
    outDir: electronOutputDirectory,
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "preload.cjs",
      },
    },
    sourcemap: true,
    target: "node20",
  },
});

const bundledPreload = await readFile(preloadOutput, "utf8");
const unresolvedLocalRequire = /require\(["']\.\//u.test(bundledPreload);

if (unresolvedLocalRequire) {
  throw new Error("Sandboxed Electron preload bundle contains an unresolved local require().");
}

console.log("Electron main process compiled and sandbox-safe preload bundle generated.");
