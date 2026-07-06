import { spawnSync } from "node:child_process";

const npmCliPath = process.env.npm_execpath;
const npmCommand = npmCliPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  ["run", "supabase:smoke"],
  ["run", "supabase:rls:smoke"],
  ["run", "supabase:api-regression"]
];

for (const args of checks) {
  const label = `npm ${args.join(" ")}`;
  console.log(`\n> ${label}`);

  const result = spawnSync(npmCommand, npmCliPath ? [npmCliPath, ...args] : args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Supabase QA gate failed: ${label}`);
  }
}

console.log("\n✓ Picom Supabase QA gate completed");
