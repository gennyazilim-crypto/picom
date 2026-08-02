/**
 * Canonical Windows staging unpacked package (dir target) for Feed / desktop gates.
 * Injects public renderer staging env from .env.local; never prints secrets.
 *
 * Usage: npm run package:win:dir:staging
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const EXPECTED_REF = "ufmtvqtsklqsmqxefbbs";
const npmCli = process.env.npm_execpath;
const electronBuilderCli = path.join(projectRoot, "node_modules", "electron-builder", "out", "cli", "cli.js");
const renameFallback = path.join(scriptDirectory, "electron-builder-windows-rename-fallback.cjs");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function runNode(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!npmCli) throw new Error("npm_execpath is unavailable. Run this package task through npm.");

const local = parseEnvFile(path.join(projectRoot, ".env.local"));
const supabaseUrl = (process.env.VITE_SUPABASE_URL || local.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || local.VITE_SUPABASE_ANON_KEY || "";
if (!supabaseUrl.includes(EXPECTED_REF)) {
  throw new Error(`Staging package refused: VITE_SUPABASE_URL must target ${EXPECTED_REF}.`);
}
if (!anonKey || /service[_-]?role|sb_secret_/i.test(anonKey)) {
  throw new Error("Staging package refused: missing or non-anon VITE_SUPABASE_ANON_KEY.");
}

const stagingEnv = {
  ...process.env,
  VITE_APP_ENV: "staging",
  VITE_RELEASE_CHANNEL: "beta",
  VITE_DATA_SOURCE: "supabase",
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_AUTH_GATEWAY_URL: process.env.VITE_AUTH_GATEWAY_URL || local.VITE_AUTH_GATEWAY_URL || "https://auth.picom.gg",
  VITE_APP_URL: process.env.VITE_APP_URL || local.VITE_APP_URL || "https://account.picom.gg",
};

console.log(`package:win:dir:staging env=staging channel=beta data=supabase ref=${EXPECTED_REF}`);

runNode(npmCli, ["run", "build"], stagingEnv);

const preloadPath = renameFallback.replaceAll(path.sep, "/");
const nodeOptions = [process.env.NODE_OPTIONS, `--require="${preloadPath}"`].filter(Boolean).join(" ");

runNode(
  electronBuilderCli,
  ["--win", "--x64", "--dir"],
  { ...stagingEnv, NODE_OPTIONS: nodeOptions },
);
