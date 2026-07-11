import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, rlsTest, types, mock, relationships, dm, followsMigration, dmMigration] = await Promise.all([
  read("supabase/migrations/20260711002000_friendship_schema_rls_privacy_foundation.sql"),
  read("supabase/tests/rls/friendship_schema_rls_privacy_foundation.sql"),
  read("src/types/friends.ts"),
  read("src/data/mockFriends.ts"),
  read("src/services/relationshipService.ts"),
  read("src/services/directMessages/directConversationService.ts"),
  read("supabase/migrations/20260710003100_social_relationships.sql"),
  read("supabase/migrations/20260710187000_direct_messages_backend_production.sql"),
]);

for (const state of ["pending", "accepted", "declined", "cancelled"]) {
  assert.match(migration, new RegExp(`['\"]${state}['\"]`), `migration must include ${state}`);
  assert.match(types, new RegExp(`['\"]${state}['\"]`), `types must include ${state}`);
}
assert.match(migration, /friend_requests_one_pending_pair_idx/);
assert.match(migration, /least\(sender_id, recipient_id\)/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /users_are_blocked/);
assert.match(migration, /friend_requests_participant_read/);
assert.match(migration, /revoke insert, update, delete on public\.friend_requests from authenticated/i);
assert.match(migration, /archive_friend_request_delete/);
assert.match(migration, /independent from one-way user_follows/i);
assert.match(rlsTest, /select plan\(12\)/);
assert.match(mock, /status: "pending"/);
assert.doesNotMatch(mock, /Pending placeholder request/);
assert.match(relationships, /mockRequestHistory/);
assert.match(relationships, /Only incoming friend requests can be accepted/);
assert.match(relationships, /Only outgoing friend requests can be cancelled/);
assert.match(relationships, /userBlockingService\.isBlocked\(userId\)/);
assert.match(dm, /userBlockingService\.isBlocked\(normalizedUserId\)/);
assert.match(followsMigration, /create table if not exists public\.user_follows/i);
assert.match(followsMigration, /create table if not exists public\.friendships/i);
assert.match(dmMigration, /users_are_blocked/);

console.log("Friendship schema, RLS, privacy, mock parity, and DM block contracts passed.");
