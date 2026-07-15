import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoots = ["src", "supabase/functions", "services/email-worker"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const files = [];

async function walk(relative) {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await walk(next);
    else if (extensions.has(path.extname(entry.name))) files.push(next);
  }
}
for (const directory of runtimeRoots) await walk(directory);

const violations = [];
for (const file of files) {
  const source = await readFile(path.join(root, file), "utf8");
  if (/VITE_(?:SMTP|EMAIL_(?:PASSWORD|SECRET|API_KEY))/i.test(source)) violations.push(`${file}: renderer-exposed email secret name`);
  if (file.startsWith(`src${path.sep}`) && /SMTP_(?:PASS|PASSWORD|SECRET)|EMAIL_UNSUBSCRIBE_SECRET/i.test(source)) violations.push(`${file}: server secret referenced by renderer`);
  for (const match of source.matchAll(/\bfrom\s*:\s*[`'"]([^`'"]+)[`'"]/gi)) {
    if (match[1].includes("@") && !match[1].toLowerCase().includes("info@picom.gg") && !match[1].includes("sender")) violations.push(`${file}: unapproved From assignment`);
  }
}
assert.deepEqual(violations, [], `Email sender policy violations:\n${violations.join("\n")}`);
console.log(`Email sender policy scan: PASS (${files.length} runtime files)`);
