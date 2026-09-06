/**
 * Fail closed for PICOM's one approved controlled out-of-order deletion
 * release. Feed the complete official `supabase db push --linked --include-all
 * --dry-run` output on stdin.
 *
 * This guard deliberately has no generic expected-set argument: broad reuse
 * would turn a documented exception into an ambient --include-all permission.
 */
import { readFileSync } from "node:fs";

const APPROVED_VERSIONS = Object.freeze([
  "20260906120000",
  "20260906130000",
]);

function block(code, detail) {
  console.error(`PICOM_CONTROLLED_OUT_OF_ORDER_MIGRATION_GUARD=${code}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function extractPendingVersions(output) {
  const expression = /supabase[\\/]migrations[\\/](\d{14})_[^\s]+\.sql/g;
  const found = [];
  for (const match of output.matchAll(expression)) found.push(match[1]);
  return found;
}

const dryRunOutput = readFileSync(0, "utf8");
if (!/DRY RUN: migrations will \*not\* be pushed to the database\./.test(dryRunOutput)) {
  block("BLOCKED_NOT_A_DRY_RUN", "Official Supabase dry-run marker was not found.");
}

const actualVersions = extractPendingVersions(dryRunOutput);
if (actualVersions.length !== APPROVED_VERSIONS.length) {
  block(
    "BLOCKED_PENDING_COUNT",
    `Expected ${APPROVED_VERSIONS.length}; found ${actualVersions.length}: ${actualVersions.join(",")}`,
  );
}

for (let index = 0; index < APPROVED_VERSIONS.length; index += 1) {
  if (actualVersions[index] !== APPROVED_VERSIONS[index]) {
    block(
      "BLOCKED_PENDING_SET_OR_ORDER",
      `Expected ${APPROVED_VERSIONS.join(",")}; found ${actualVersions.join(",")}`,
    );
  }
}

console.log("PICOM_CONTROLLED_OUT_OF_ORDER_MIGRATION_GUARD=PASS");
console.log(`pendingCount=${actualVersions.length}`);
console.log(`pendingVersions=${actualVersions.join(",")}`);
