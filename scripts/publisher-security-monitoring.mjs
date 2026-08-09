import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sec = readFileSync(path.join(root, "src/services/ops/liveNowSecurityMonitoring.ts"), "utf8");

for (const code of [
  "AUTH_DENIAL_REPEATED",
  "STREAM_CREDENTIAL_ROTATED",
  "UNAUTHORIZED_STREAM_MANAGEMENT",
  "WEBHOOK_SIGNATURE_FAILURE",
  "RATE_LIMIT_ABUSE",
]) {
  assert.match(sec, new RegExp(code));
}

for (const key of ["chat_flood", "invite_abuse", "go_live_failure_abuse", "credential_rotation_abuse"]) {
  assert.match(sec, new RegExp(key));
}

assert.match(sec, /FAIL_CLOSED/);
assert.match(sec, /foreign_stream_control/);
assert.match(sec, /not AI fraud|deterministic/i);
assert.doesNotMatch(sec, /machine learning model|neural network fraud/i);

const sql = readFileSync(path.join(root, "supabase/migrations/20260808430000_live_now_production_ops.sql"), "utf8");
assert.match(sql, /bump_live_now_ops_security_counter/);
assert.match(sql, /live_now_ops_security_counters/);

const redaction = readFileSync(path.join(root, "src/services/logging/logRedaction.ts"), "utf8");
assert.match(redaction, /Bearer \[redacted\]/);
assert.match(redaction, /PRIVATE_CONTENT_KEY_PATTERN/);

console.log("publisher-security-monitoring: PASS");
