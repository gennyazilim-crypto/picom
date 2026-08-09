import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = readFileSync(path.join(root, "src/services/ops/liveNowAlertRules.ts"), "utf8");

assert.match(rules, /LIVE_NOW_ALERT_TRANSPORT = "NOT_CONFIGURED"/);
for (const sev of ["SEV1", "SEV2", "SEV3", "SEV4"]) {
  assert.match(rules, new RegExp(`"${sev}"`));
}
assert.match(rules, /dedupeKeyTemplate/);
assert.match(rules, /LIVE_NOW_GLOBAL_UNAVAILABLE/);
assert.match(rules, /buildAlertDedupeKey/);
assert.doesNotMatch(rules, /slack\.com|hooks\.slack|mailto:/i);

const sql = readFileSync(path.join(root, "supabase/migrations/20260808430000_live_now_production_ops.sql"), "utf8");
assert.match(sql, /OPEN.*ACKNOWLEDGED.*RESOLVED|status in \('OPEN', 'ACKNOWLEDGED', 'RESOLVED'\)/);
assert.match(sql, /upsert_live_now_ops_alert/);
assert.match(sql, /ack_live_now_ops_alert/);

console.log("publisher-alert-rules: PASS");
