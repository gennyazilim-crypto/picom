/**
 * Production-accurate history: reset through 173000, apply only 221951, then remaining.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");
const holdDir = path.join(root, ".tmp-task08c-mig-hold-prodacc");

function sh(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function listAll() {
  return fs.readdirSync(migDir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
}

fs.mkdirSync(holdDir, { recursive: true });
const held = [];
for (const f of listAll()) {
  if (f.slice(0, 14) > "20260803173000") {
    fs.renameSync(path.join(migDir, f), path.join(holdDir, f));
    held.push(f);
  }
}
console.log(`HELD ${held.length} after 173000`);

let failed = false;
try {
  sh("npx supabase db reset --yes");
  console.log("PRODACC_SOURCE_173000_OK");

  const only221951 = held.filter((f) => f.startsWith("20260803221951"));
  for (const f of only221951) {
    fs.renameSync(path.join(holdDir, f), path.join(migDir, f));
  }
  sh("npx supabase migration up --local --include-all");
  console.log("PRODACC_AFTER_221951_OK");

  for (const f of held) {
    const from = path.join(holdDir, f);
    const to = path.join(migDir, f);
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
  held.length = 0;
  sh("npx supabase migration up --local --include-all");
  console.log("PRODACC_TO_LATEST_OK");
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  for (const f of fs.existsSync(holdDir) ? fs.readdirSync(holdDir) : []) {
    fs.renameSync(path.join(holdDir, f), path.join(migDir, f));
  }
}

process.exit(failed ? 1 : 0);
