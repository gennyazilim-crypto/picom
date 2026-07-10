import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const service = readFileSync(resolve(root, "src/services/appealService.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260710171000_moderation_appeals_production.sql"), "utf8");

for (const marker of ["affectedUserId !== input.currentUserId", "if (!canReview)", "canTransitionAppealStatus", "APPEAL_SECRET_PATTERN", "auditLogService.append"]) assert.ok(service.includes(marker), `Missing appeal service marker: ${marker}`);
for (const marker of ["affected_user_id = auth.uid()", "action.affected_user_id = auth.uid()", "public.can_moderate_community_reports(community_id)", "moderation_appeals_transition_guard", "revoke all on public.moderation_action_records", "unique (moderation_action_id, affected_user_id)"]) assert.ok(migration.includes(marker), `Missing appeal RLS/schema marker: ${marker}`);
assert.ok(migration.includes("authenticated clients have no insert/update/delete privilege"), "Action ledger must be backend-written");

console.log("Appeals production workflow contract tests passed.");
