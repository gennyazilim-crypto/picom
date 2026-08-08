/**
 * Static smoke for TASK28 live chat + moderation.
 * Asserts migrations, fail-closed flags, XSS-safe rendering, no localStorage moderation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const core = "supabase/migrations/20260808200000_live_chat_core.sql";
const hard = "supabase/migrations/20260808210000_live_chat_moderation_hardening.sql";
assert.ok(existsSync(path.join(root, core)), `missing ${core}`);
assert.ok(existsSync(path.join(root, hard)), `missing ${hard}`);

const coreSql = read(core);
const hardSql = read(hard);

for (const table of [
  "live_chat_settings",
  "live_chat_messages",
  "live_chat_reactions",
  "live_chat_moderators",
  "live_chat_timeouts",
  "live_chat_bans",
  "live_chat_reports",
  "live_chat_rate_limits",
  "live_chat_audit_events",
]) {
  assert.match(coreSql, new RegExp(`create table if not exists public\\.${table}`));
}

for (const rpc of [
  "send_live_chat_message",
  "list_live_chat_messages",
  "remove_live_chat_message",
  "pin_live_chat_message",
  "unpin_live_chat_message",
  "timeout_live_chat_user",
  "ban_live_chat_user",
  "unban_live_chat_user",
  "assign_stream_moderator",
  "remove_stream_moderator",
  "update_live_chat_settings",
  "report_live_chat_message",
  "react_live_chat_message",
  "get_live_chat_viewer_state",
]) {
  assert.match(hardSql, new RegExp(`function public\\.${rpc}\\b`), `missing RPC ${rpc}`);
}

assert.match(hardSql, /live_chat_consume_rate_limit/);
assert.match(hardSql, /LIVE_CHAT_SLOW_MODE/);
assert.match(hardSql, /LIVE_CHAT_DUPLICATE_SPAM/);
assert.match(hardSql, /live_chat_contains_url/);
assert.match(hardSql, /body_fingerprint/);
assert.match(hardSql, /supabase_realtime add table public\.live_chat_messages/);
assert.doesNotMatch(hardSql, /for insert to authenticated/);
assert.doesNotMatch(hardSql, /for update to authenticated/);
assert.doesNotMatch(hardSql, /USING\s*\(\s*true\s*\)/i);

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enableLiveChat/);
assert.match(flags, /enableLiveModeration/);
assert.match(flags, /enableLiveChat:\s*appConfig\.environment !== "production"/);
assert.match(flags, /enableLiveModeration:\s*appConfig\.environment !== "production"/);

const clientConfig = read("supabase/functions/client-config/index.ts");
assert.match(clientConfig, /PICOM_ENABLE_LIVE_CHAT/);
assert.match(clientConfig, /PICOM_ENABLE_LIVE_MODERATION/);

const service = read("src/services/live/liveChatService.ts");
assert.doesNotMatch(service, /localStorage\.(setItem|getItem)/);
assert.match(service, /send_live_chat_message/);
assert.match(service, /FEATURE_DISABLED/);
assert.match(service, /postgres_changes/);

const ui = read("src/components/live/LiveStreamChatPanel.tsx");
assert.doesNotMatch(ui, /dangerouslySetInnerHTML/);
assert.doesNotMatch(ui, /localStorage\.(setItem|getItem)/);
assert.match(ui, /alertdialog|role="log"|aria-live/);
assert.match(ui, /translateLiveChat/);

const mod = read("src/components/live/LiveChatModeratorConsole.tsx");
assert.match(mod, /enableLiveModeration/);
assert.match(mod, /ban\.confirm|unban\.confirm|moderators\.remove/);

const catalog = read("src/services/localization/liveChatCatalog.ts");
for (const key of [
  "liveChat.title",
  "slowMode.label",
  "timedOut.title",
  "banned.title",
  "followersOnly.title",
  "verifiedOnly.title",
  "controlRoom.moderation",
  "linkNotAllowed",
  "rateLimited",
  "messageTooLong",
]) {
  assert.match(catalog, new RegExp(`"${key.replace(/\./g, "\\.")}"`));
}
assert.match(catalog, /assertLiveChatLocaleParity/);

console.log("live-chat-management-smoke: PASS");
process.exit(0);
