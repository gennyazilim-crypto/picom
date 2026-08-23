import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = resolve(root, "scripts");
// Do not flag legitimate accented characters (for example French `â` in
// `démarrera`). Look for the actual multi-byte mojibake prefixes instead.
const mojibakePatterns = [
  new RegExp(`${String.fromCharCode(0x00c3)}[\\u0080-\\u00bf]`, "u"),
  new RegExp(`${String.fromCharCode(0x00c2)}[\\u0080-\\u00bf]`, "u"),
  new RegExp(`${String.fromCharCode(0x00e2)}(?:${String.fromCharCode(0x20ac)}|€™|€œ|€|€¦)`, "u"),
  /\uFFFD/u,
];

for (const file of readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs"))) {
  const text = readFileSync(resolve(scriptsDir, file), "utf8");

  for (const pattern of mojibakePatterns) {
    if (pattern.test(text)) {
      throw new Error(`QA script contains mojibake or replacement characters: scripts/${file}`);
    }
  }
}

const qaGate = readFileSync(resolve(scriptsDir, "qa-smoke-gate.mjs"), "utf8");
if (!qaGate.includes("OK Picom QA smoke gate completed")) {
  throw new Error("QA smoke gate must use ASCII-safe completion output.");
}

console.log("OK QA script output encoding smoke test completed");
