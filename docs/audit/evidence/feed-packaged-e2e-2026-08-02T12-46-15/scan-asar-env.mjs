import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = "C:\\Users\\ACER\\Desktop\\picom-feed-production-wt";
const asarPath = path.join(packageRoot, "release", "win-unpacked", "resources", "app.asar");
const extractDir = path.join(evidenceDir, "asar-extract");

const require = createRequire(import.meta.url);
const asar = require(path.join(packageRoot, "node_modules", "@electron", "asar"));

fs.rmSync(extractDir, { recursive: true, force: true });
asar.extractAll(asarPath, extractDir);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(js|css|html|json|mjs|cjs)$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(extractDir);
const hits = {
  staging: false,
  beta: false,
  supabase: false,
  projectRef: false,
  filesScanned: files.length,
};

for (const file of files) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("staging")) hits.staging = true;
  if (/\bbeta\b/.test(text)) hits.beta = true;
  if (text.includes("supabase")) hits.supabase = true;
  if (text.includes("ufmtvqtsklqsmqxefbbs")) hits.projectRef = true;
}

fs.writeFileSync(path.join(evidenceDir, "preflight-env-markers.json"), JSON.stringify(hits, null, 2));
console.log(JSON.stringify(hits));
fs.rmSync(extractDir, { recursive: true, force: true });
