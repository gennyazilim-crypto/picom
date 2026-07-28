import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const npmCli = process.env.npm_execpath;
const electronBuilderCli = path.join(projectRoot, "node_modules", "electron-builder", "out", "cli", "cli.js");
const renameFallback = path.join(scriptDirectory, "electron-builder-windows-rename-fallback.cjs");

function runNode(script, args, env = process.env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!npmCli) throw new Error("npm_execpath is unavailable. Run this package task through npm.");

runNode(npmCli, ["run", "build"]);

const preloadPath = renameFallback.replaceAll(path.sep, "/");
const nodeOptions = [process.env.NODE_OPTIONS, `--require="${preloadPath}"`]
  .filter(Boolean)
  .join(" ");

runNode(
  electronBuilderCli,
  ["--win", "--x64", ...process.argv.slice(2)],
  { ...process.env, NODE_OPTIONS: nodeOptions },
);
