import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const documentPath = resolve(import.meta.dirname, "..", "docs", "stable-go-no-go.md");
const document = await readFile(documentPath, "utf8");
const decision = document.match(/^Decision:\s*\*\*(.+?)\*\*\s*$/im)?.[1]?.trim();

if (!decision) {
  console.error("Release blocked: docs/stable-go-no-go.md has no explicit Decision line.");
  process.exit(1);
}

const approvedDecisions = new Set(["Go", "Go with known non-blockers"]);
if (!approvedDecisions.has(decision)) {
  console.error(`Release blocked by stable Go/No-Go decision: ${decision}.`);
  process.exit(1);
}

console.log(`Release Go/No-Go guard passed: ${decision}.`);
