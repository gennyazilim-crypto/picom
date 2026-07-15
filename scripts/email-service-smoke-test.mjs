import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EMAIL_IDENTITY, assertSenderPolicy } from "../services/email-worker/emailPolicy.mjs";
import { assertTemplateCoverage } from "../services/email-worker/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [migration, eventHooks, queueService, edgeApi, worker] = await Promise.all([
  read("supabase/migrations/20260715150000_email_operations_production.sql"),
  read("supabase/migrations/20260715151000_email_authoritative_event_hooks.sql"),
  read("supabase/functions/_shared/email-service.ts"),
  read("supabase/functions/email-api/index.ts"),
  read("services/email-worker/index.mjs"),
]);

for (const table of ["email_messages", "email_attempts", "email_events", "email_suppressions", "email_preferences", "email_worker_heartbeats"]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} must be migration-managed`);
}
for (const rpc of ["enqueue_email_message", "claim_email_messages", "complete_email_attempt", "consume_email_rate_limit"]) {
  assert.match(migration, new RegExp(`function public\\.${rpc}`), `${rpc} must exist`);
}
for (const hook of [
  "account_security_events_email_hook",
  "moderation_action_records_email_hook",
  "moderation_appeals_email_insert_hook",
  "moderation_appeals_email_update_hook",
  "communities_ownership_email_hook",
]) {
  assert.match(eventHooks, new RegExp(`create trigger ${hook}`), `${hook} must be migration-managed`);
}
assert.match(eventHooks, /create table if not exists public\.email_hook_failures/);
assert.match(eventHooks, /function public\.enqueue_email_for_user_event/);
assert.match(eventHooks, /on conflict \(hook_name, source_record_id, recipient_user_id\)/);
assert.doesNotMatch(eventHooks, /smtp_pass|smtp_password/i);
assert.match(queueService, /EMAIL_TEMPLATE_IDS/);
assert.match(queueService, /enqueue_email_message/);
assert.match(edgeApi, /support\.submit/);
assert.match(edgeApi, /EMAIL_ADMIN_FORBIDDEN/);
assert.doesNotMatch(edgeApi, /SMTP_PASS|SMTP_PASSWORD/);
assert.match(worker, /createTransport/);
assert.match(worker, /claim_email_messages/);
assert.equal(EMAIL_IDENTITY.fromAddress, "info@picom.gg");
assert.equal(EMAIL_IDENTITY.fromName, "Picom");
assert.throws(() => assertSenderPolicy({ replyTo: "attacker@example.com\r\nBcc: victim@example.com" }), /EMAIL_SENDER_POLICY_VIOLATION/);
assertTemplateCoverage();
console.log("Email queue, authoritative hooks, sender policy, templates, API boundary, and worker contract: PASS");
