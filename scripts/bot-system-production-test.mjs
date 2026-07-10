import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/20260710173000_bot_system_mvp_production.sql"), "utf8");
const ui = readFileSync(resolve(root, "src/components/CommunityBotsAdminSection.tsx"), "utf8");
const message = readFileSync(resolve(root, "src/components/MessageItem.tsx"), "utf8");
const member = readFileSync(resolve(root, "src/components/MemberGroup.tsx"), "utf8");

for (const marker of ["can_manage_community_bots", "issue_community_bot_credential", "revoke_community_bot_credential", "consume_bot_action_rate_limit", "extensions.gen_random_bytes(32)", "append_community_audit_log"]) assert.ok(migration.includes(marker), `Missing bot production marker: ${marker}`);
assert.ok(migration.includes("revoke all on public.bot_action_rate_limits from anon, authenticated"), "Rate-limit counters must be backend-only");
assert.ok(migration.includes("revoke all on function public.consume_bot_action_rate_limit") && migration.includes("to service_role"), "Rate limiter must be service-role only");
const issueSignature = migration.slice(migration.indexOf("returns table(raw_token"), migration.indexOf("language plpgsql", migration.indexOf("returns table(raw_token")));
assert.equal(issueSignature.includes("token_hash"), false, "One-time response must not expose token hash");
assert.ok(ui.includes("One-time bot token") && ui.includes("stores only its hash"), "Community Bots UI must explain one-time token behavior");
assert.ok(message.includes("member.isBot") && member.includes("member.isBot"), "Bot identities must be visibly marked");

console.log("Bot system production foundation contract tests passed.");
