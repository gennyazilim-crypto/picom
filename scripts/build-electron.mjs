import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const electronOutputDirectory = path.join(projectRoot, "dist-electron");
const preloadEntry = path.join(projectRoot, "electron", "preload.cts");
const preloadOutput = path.join(electronOutputDirectory, "preload.cjs");
const typescriptCli = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
const certificationFixtureDirectory = path.join(projectRoot, "scripts", "fixtures", "livekit-hosted-e2e");
const certificationOutputDirectory = path.join(electronOutputDirectory, "certification");

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

await rm(certificationOutputDirectory, { recursive: true, force: true });
if (process.env.PICOM_BUILD_WINDOWS_MEMBER_MEDIA_CERTIFICATION === "CONTROLLED_WINDOWS_ONLY") {
  await build({
    configFile: false,
    root: certificationFixtureDirectory,
    base: "./",
    logLevel: "warn",
    build: {
      outDir: certificationOutputDirectory,
      emptyOutDir: true,
      minify: true,
      rollupOptions: { input: path.join(certificationFixtureDirectory, "index.html") },
    },
  });
  await mkdir(certificationOutputDirectory, { recursive: true });
  await Promise.all([
    copyFile(path.join(certificationFixtureDirectory, "main.cjs"), path.join(certificationOutputDirectory, "main.cjs")),
    copyFile(path.join(certificationFixtureDirectory, "preload.cjs"), path.join(certificationOutputDirectory, "preload.cjs")),
  ]);
  console.log("Controlled Windows member-media certification runtime bundled into this candidate.");
}

console.log("Electron main process compiled and sandbox-safe preload bundle generated.");
