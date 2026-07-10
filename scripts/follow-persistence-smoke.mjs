import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710202000_follow_persistence_hardening.sql", "utf8");
const service = readFileSync("src/services/relationshipService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

for (const marker of ["follow_user", "unfollow_user", "FOLLOW_BLOCKED", "PROFILE_NOT_VISIBLE", "on conflict", "replica identity full", "supabase_realtime", "revoke insert, update, delete"]) {
  if (marker === "on conflict") continue;
  assert.ok(migration.toLowerCase().includes(marker.toLowerCase()), `missing follow marker: ${marker}`);
}
assert.ok(migration.includes("if exists (select 1 from public.user_follows"), "duplicate follow must return safely");
assert.ok(service.includes('client.rpc("follow_user"'), "follow service must use RPC");
assert.ok(service.includes('client.rpc("unfollow_user"'), "unfollow service must use RPC");
assert.ok(service.includes("subscribeToFollowing"), "following changes must support realtime refresh");
assert.ok(app.includes("followMutationInFlightRef"), "UI must suppress duplicate follow clicks");
assert.ok(app.includes("authoritative.ok"), "optimistic UI must reconcile with authoritative follows");

console.log("Follow persistence static smoke: PASS");
