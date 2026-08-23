import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

if (!args.includes("--run")) {
  console.error("BLOCKED: Live Now staging E2E requires --run plus protected staging credentials and redacted all-PASS evidence.");
  process.exit(2);
}

const result = spawnSync(process.execPath, ["scripts/hosted-full-mvp-staging-e2e.mjs", ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
