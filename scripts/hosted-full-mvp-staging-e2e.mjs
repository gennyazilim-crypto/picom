import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const runRequested = process.argv.includes("--run");
const evidencePath = valueAfter("--evidence");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, label) => {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`FAIL: ${label} exited with code ${result.status ?? "unknown"}.`);
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, ["scripts/full-mvp-staging-e2e-contract.mjs"], "Full MVP staging contract");

if (!runRequested) {
  console.log("Picom Full MVP staging E2E preflight is safe and non-destructive by default.");
  console.log("BLOCKED: real execution requires --run, --evidence, STAGING_ONLY, ALLOW_SYNTHETIC_WRITES, protected staging identities, and native/provider evidence.");
  process.exit(0);
}

if (process.env.PICOM_STAGING_E2E_CONFIRM !== "STAGING_ONLY") {
  console.error("BLOCKED: PICOM_STAGING_E2E_CONFIRM must equal STAGING_ONLY.");
  process.exit(2);
}
if (process.env.PICOM_STAGING_E2E_ALLOW_WRITES !== "ALLOW_SYNTHETIC_WRITES") {
  console.error("BLOCKED: PICOM_STAGING_E2E_ALLOW_WRITES must equal ALLOW_SYNTHETIC_WRITES.");
  process.exit(2);
}
if (!evidencePath) {
  console.error("BLOCKED: --evidence <redacted-json> is required for hosted execution.");
  process.exit(2);
}

const matrix = JSON.parse(await readFile("tests/e2e/full-mvp-staging-matrix.json", "utf8"));
const targetValues = [
  process.env.PICOM_RLS_STAGING_URL,
  process.env.PICOM_REALTIME_STAGING_URL,
  process.env.PICOM_EDGE_STAGING_URL,
].filter(Boolean);
if (targetValues.length !== 3) {
  console.error("BLOCKED: protected Supabase RLS, Realtime, and Edge staging targets are all required.");
  process.exit(2);
}
for (const value of targetValues) {
  let hostname;
  try { hostname = new URL(value).hostname.toLowerCase(); } catch { hostname = ""; }
  if (!hostname || /(^|[.-])(prod|production)([.-]|$)/.test(hostname)) {
    console.error("BLOCKED: a target is invalid or resembles production.");
    process.exit(2);
  }
}

const commands = [...new Set(matrix.flows.flatMap((flow) => flow.preflightCommands))];
for (const command of commands) run(npm, ["run", command], `preflight ${command}`);
for (const suite of matrix.hostedSuites) run(process.execPath, [suite.runner, "--run"], `hosted suite ${suite.id}`);
run(process.execPath, ["scripts/full-mvp-staging-e2e-contract.mjs", "--evidence", evidencePath, "--require-pass"], "redacted Full MVP evidence verification");

console.log("PASS: protected Full MVP staging E2E matrix completed with redacted all-PASS evidence.");
