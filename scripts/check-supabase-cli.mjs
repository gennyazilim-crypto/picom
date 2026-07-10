import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const required = process.argv.includes("--require");
const localBinary = resolve(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
const command = existsSync(localBinary) ? localBinary : "supabase";
const result = spawnSync(command, ["--version"], { encoding: "utf8", shell: false });

if (!result.error && result.status === 0) {
  console.log(`Supabase CLI available: ${(result.stdout || result.stderr).trim()}`);
  process.exit(0);
}

const message = [
  "Supabase CLI is not available.",
  "Picom mock/UI development remains available: npm run mock:smoke and npm run dev.",
  "For local database work use Node.js 20+, Docker, and install the CLI as documented in docs/supabase-local-development.md.",
].join("\n");

if (required) {
  console.error(message);
  process.exit(1);
}

console.warn(message);
console.warn("Hosted-only fallback steps are documented; no local RLS execution is being claimed.");
