import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = readFileSync(path.join(root, "src/services/ops/liveNowReleaseReadiness.ts"), "utf8");

assert.match(matrix, /GENERAL_AVAILABILITY/);
assert.match(matrix, /verdict: "BLOCKED"/);
assert.match(matrix, /verdict: "GO"/);
assert.match(matrix, /PUBLIC_BETA[\s\S]*verdict: "PARTIAL"/);
assert.match(matrix, /REAL_TWO_DESKTOP_MEDIA/);
assert.match(matrix, /OBS_REAL_CLIENT/);
assert.match(matrix, /CHAT_TWO_CLIENT/);
assert.match(matrix, /LIVEKIT_EGRESS/);
assert.match(matrix, /KYC_PROVIDER/);
assert.doesNotMatch(matrix, /99\.9%/);

const doc = "docs/publisher-creator/LIVE_NOW_RELEASE_READINESS.md";
assert.ok(existsSync(path.join(root, doc)), doc);
const readiness = readFileSync(path.join(root, doc), "utf8");
assert.match(readiness, /GENERAL AVAILABILITY|GENERAL_AVAILABILITY/);
assert.match(readiness, /BLOCKED/);
assert.match(readiness, /NOT_CERTIFIED|NOT_RUN|NOT_CONFIGURED/);

console.log("publisher-release-readiness: PASS");
