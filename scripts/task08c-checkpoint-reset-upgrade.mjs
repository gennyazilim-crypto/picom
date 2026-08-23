/**
 * TASK 08C checkpoint upgrade via temporary migration hold + supabase db reset/up.
 * Usage: node scripts/task08c-checkpoint-reset-upgrade.mjs --through=20260803221951 --label=prod221951
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");
const holdDir = path.join(root, ".tmp-task08c-mig-hold");

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const through = arg("through");
const label = arg("label") || through || "unknown";
if (!through) {
  console.error("Missing --through=YYYYMMDDHHMMSS");
  process.exit(2);
}

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { encoding: "utf8", stdio: "inherit", ...opts });
}

function listAll() {
  return fs.readdirSync(migDir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
}

fs.mkdirSync(holdDir, { recursive: true });
const held = [];
for (const f of listAll()) {
  if (f.slice(0, 14) > through) {
    const from = path.join(migDir, f);
    const to = path.join(holdDir, f);
    fs.renameSync(from, to);
    held.push(f);
  }
}
console.log(`HELD ${held.length} migrations after ${through}`);

let failed = false;
try {
  sh("npx supabase db reset --yes", { cwd: root });
  console.log(`CHECKPOINT_SOURCE_OK label=${label} through=${through}`);
  for (const f of held) {
    fs.renameSync(path.join(holdDir, f), path.join(migDir, f));
  }
  held.length = 0;
  sh("npx supabase migration up --local --include-all", { cwd: root });
  console.log(`CHECKPOINT_UPGRADE_OK label=${label}`);
} catch (err) {
  failed = true;
  console.error(String(err?.message || err));
} finally {
  for (const f of held) {
    const from = path.join(holdDir, f);
    const to = path.join(migDir, f);
    if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
  }
}

process.exit(failed ? 1 : 0);
