import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const dryRun = spawnSync(process.execPath, ["scripts/data-retention-enforcement-placeholder.mjs"], { encoding: "utf8" });
assert.equal(dryRun.status, 0);
const plan = JSON.parse(dryRun.stdout);
assert.equal(plan.mode, "dry_run");
assert.equal(plan.destructiveExecutionEnabled, false);
assert.equal(plan.candidates.auditLogs, 0);
assert.equal(plan.categories.auditLogs, "excluded_from_message_retention");

const unconfirmed = spawnSync(process.execPath, ["scripts/data-retention-enforcement-placeholder.mjs", "--apply"], { encoding: "utf8", env: { ...process.env, PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE: "false" } });
assert.equal(unconfirmed.status, 2);
assert.match(unconfirmed.stderr, /Retention apply is blocked/);

const guardedPlaceholder = spawnSync(process.execPath, ["scripts/data-retention-enforcement-placeholder.mjs", "--apply", "--confirm-retention"], { encoding: "utf8", env: { ...process.env, PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE: "true" } });
assert.equal(guardedPlaceholder.status, 3);
assert.match(guardedPlaceholder.stderr, /intentionally not implemented/);

console.log("Data retention enforcement guard tests passed.");
