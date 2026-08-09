import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = "docs/publisher-creator/LIVE_NOW_DISASTER_RECOVERY.md";
assert.ok(existsSync(path.join(root, doc)), doc);
const text = readFileSync(path.join(root, doc), "utf8");

assert.match(text, /RESTORE_DRILL/);
assert.match(text, /NOT_RUN_NO_SAFE_ISOLATED_TARGET|NOT_RUN/);
assert.match(text, /PITR|AUTOMATED_BACKUP/);
assert.match(text, /SPOF|single point/i);
assert.match(text, /NO migration repair/i);
assert.match(text, /Never restore over production/i);
assert.doesNotMatch(text, /restore onto production|overwrite production database/i);

const incident = "docs/publisher-creator/LIVE_NOW_INCIDENT_RESPONSE.md";
assert.ok(existsSync(path.join(root, incident)), incident);
assert.match(readFileSync(path.join(root, incident), "utf8"), /incident id/i);

console.log("publisher-dr-contract: PASS");
