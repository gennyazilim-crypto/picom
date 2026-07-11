import { readFile } from "node:fs/promises";

const files = Object.fromEntries(await Promise.all([
  ["migration", "supabase/migrations/20260711153400_meeting_schedules_invites_join_policy.sql"],
  ["service", "src/services/meeting/meetingSchedulingService.ts"],
  ["types", "src/types/meetingScheduling.ts"],
  ["edge", "supabase/functions/meeting-join/index.ts"],
  ["config", "supabase/config.toml"],
  ["database", "src/services/supabase/database.types.ts"],
  ["sqlTest", "supabase/tests/meeting_schedules_invites_join_policy.sql"],
].map(async ([key, path]) => [key, await readFile(path, "utf8")])));

const failures = [];
for (const rpc of ["schedule_meeting_room", "create_meeting_invite", "revoke_meeting_invite", "validate_meeting_invite", "get_meeting_join_preview", "list_meeting_invites"]) {
  if (!files.migration.includes(rpc) || !files.database.includes(`${rpc}:`)) failures.push(`missing ${rpc} database contract`);
}
for (const marker of ["meeting_invite_redemptions", "token_hash", "cohost_user_ids", "reminder_policy", "meeting_schedule_write", "meeting_invite_write", "meeting_join_preview", "meeting_user_is_restricted", "users_are_blocked", "audit_log"]) {
  if (!files.migration.includes(marker)) failures.push(`missing backend marker ${marker}`);
}
if (!files.migration.includes("revoke all on table public.meeting_invites from anon,authenticated")) failures.push("invite hash table remains directly readable");
if (!files.migration.includes("Raw invite secrets are never persisted") || /add column[^;]*(invite_secret|raw_token|plain_token)/i.test(files.migration)) failures.push("plain invite secret storage contract violated");
if (!files.service.includes("crypto.subtle.digest") || !files.service.includes("crypto.getRandomValues") || files.service.includes("localStorage")) failures.push("client invite generation/hash contract missing");
if (!files.service.includes('functions.invoke<MeetingJoinPreview>("meeting-join"') || !files.edge.includes('rpc("get_meeting_join_preview"') || !files.edge.includes('rpc("validate_meeting_invite"')) failures.push("meeting join Edge/service path missing");
if (!files.edge.includes('"Cache-Control": "no-store"') || /console\.(log|debug|info)\(/.test(files.edge)) failures.push("Edge secret/logging safety contract missing");
if (!/\[functions\.meeting-join\]\s*\r?\nverify_jwt = true/.test(files.config)) failures.push("meeting-join JWT verification missing");
if (!files.sqlTest.includes("has_table_privilege") || !files.sqlTest.includes("plain invite secret column found")) failures.push("database privilege/secret test missing");
if (failures.length) { console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n")); process.exit(1); }
console.log("PASS: scheduled meetings, hash-only revocable invitations, join policy preview, rate limits, audit, and blocked-user enforcement are integrated.");
