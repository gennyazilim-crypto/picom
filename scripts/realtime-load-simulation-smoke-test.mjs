import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const scriptPath = "scripts/realtime-load-simulation.mjs";
const docsPath = "docs/realtime-load-simulation.md";
const packagePath = "package.json";

const script = readFileSync(scriptPath, "utf8");
const docs = readFileSync(docsPath, "utf8");
const packageJson = readFileSync(packagePath, "utf8");

const requiredScript = [
  "PICOM_REALTIME_LOAD_ALLOW_REMOTE",
  "connecting users",
  "message:new",
  "typing:start",
  "typing:stop",
  "presence:update",
  "simulated_reconnect",
  "duplicateEventsPrevented",
  "dry_run_in_memory",
];

const requiredDocs = [
  "Realtime Load Simulation",
  "development-only",
  "in-memory dry run",
  "no production traffic",
  "--clients=10",
  "--messages=5",
  "duplicate event checks",
  "Do not run broad realtime load tests against production",
];

const missing = [];
for (const phrase of requiredScript) {
  if (!script.includes(phrase)) missing.push(`${scriptPath} missing: ${phrase}`);
}

for (const phrase of requiredDocs) {
  if (!docs.includes(phrase)) missing.push(`${docsPath} missing: ${phrase}`);
}

if (!packageJson.includes("realtime:load:simulate") || !packageJson.includes("realtime:load:smoke")) {
  missing.push("package.json missing realtime load scripts");
}

const result = spawnSync(process.execPath, [scriptPath, "--clients=2", "--messages=2", "--delayMs=0", "--communityId=smoke-community", "--channelId=smoke-channel"], {
  encoding: "utf8",
});

if (result.status !== 0) {
  missing.push(`simulation command failed: ${result.stderr || result.stdout}`);
} else {
  const summary = JSON.parse(result.stdout);
  if (summary.mode !== "dry_run_in_memory") missing.push("simulation did not run in dry_run_in_memory mode");
  if (summary.clients !== 2) missing.push("simulation client count mismatch");
  if (summary.messageEvents !== 4) missing.push("simulation message event count mismatch");
  if (summary.duplicateEventsPrevented < 1) missing.push("simulation did not exercise duplicate prevention");
}

const blocked = spawnSync(process.execPath, [scriptPath, "--execute"], {
  encoding: "utf8",
  env: { ...process.env, PICOM_REALTIME_LOAD_ALLOW_REMOTE: "" },
});

if (blocked.status === 0) {
  missing.push("--execute should be blocked without PICOM_REALTIME_LOAD_ALLOW_REMOTE=true");
}

if (missing.length > 0) {
  console.error("Realtime load simulation smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Realtime load simulation smoke test passed.");

