import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const matrix = JSON.parse(read("supabase/tests/hosted/full-mvp-rls-matrix.json"));
const runner = read("scripts/hosted-staging-rls-validation.mjs");
const expectedActors = ["anonymous", "owner", "admin", "moderator", "member", "visitor", "blocked", "dm_non_participant"];
const expectedDomains = ["text", "radio", "podcast", "feed", "stories", "profile", "friends", "direct_messages", "settings", "audit", "storage", "realtime"];
const expectedOperations = ["SELECT", "INSERT", "UPDATE", "DELETE", "STORAGE_SELECT", "REALTIME_AUTHORIZE"];

assert.deepEqual(Object.keys(matrix.actors), expectedActors, "actor inventory is incomplete");
for (const domain of expectedDomains) assert.ok(matrix.coverage.domains.includes(domain), `missing domain ${domain}`);
for (const operation of expectedOperations) assert.ok(matrix.coverage.operations.includes(operation), `missing operation ${operation}`);
assert.ok(matrix.readCases.length >= 19, "read matrix is incomplete");
assert.ok(matrix.storageCases.length >= 5, "Storage matrix is incomplete");
assert.ok(matrix.realtimeCases.length >= 6, "Realtime matrix is incomplete");
for (const suite of ["text_message_crud_reply_reaction", "dm_message_crud", "settings_own_update_cross_user_deny", "radio_listener_join_leave", "podcast_comment_create_delete"]) {
  assert.ok(matrix.mutationSuites.some((item) => item.id === suite), `missing mutation suite ${suite}`);
}
for (const marker of ["STAGING_ONLY", "ALLOW_EPHEMERAL_WRITES", "can_access_picom_realtime_topic", "send_text_message_idempotent", "send_direct_message_v3", "podcast_episode_comments", "join_current_user_radio_listener", "No database, Storage, Auth, or Realtime connection was made"]) {
  assert.ok(runner.includes(marker), `runner is missing ${marker}`);
}
assert.ok(!/SERVICE_ROLE|serviceRoleKey/.test(runner), "runner must not use a service-role key");
console.log("Full MVP hosted RLS actor, domain, operation, Storage, Realtime, and mutation contract: PASS");
