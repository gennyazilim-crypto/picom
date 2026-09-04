import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

const migration = await read("supabase/migrations/20260904100000_production_desktop_notifications.sql");
const host = await read("electron/desktopNotificationToastHost.cts");
const main = await read("electron/main.cts");
const center = await read("src/services/notificationCenterService.ts");
const directRealtime = await read("src/hooks/useDirectMessageRealtime.ts");
const flags = await read("src/services/featureFlagService.ts");
const delivery = await read("src/services/desktop/productionNotificationService.ts");
const rls = await read("supabase/tests/rls/production_desktop_notifications.sql");
const settingsI18n = await read("src/services/settings/settingsI18n.ts");
const settingsI18nTr = await read("src/services/settings/settingsI18nTr.ts");
const localeRegistry = await read("src/services/localization/uiLanguages.ts");

for (const required of [
  "friend_request_received",
  "friend_request_accepted",
  "dm_received",
  "friend_online",
  "followed_user_live",
  "followed_publisher_live",
  "create_direct_message_desktop_notifications",
  "bridge_friend_request_desktop_notification",
  "create_friend_online_desktop_notifications",
  "claim_desktop_notification",
  "list_recent_desktop_notification_delivery_candidates",
  "mark_desktop_notification_seen",
  "dismiss_desktop_notification",
  "mark_desktop_notification_read",
  "users_are_blocked",
  "muted_until",
  "notification_type is null or notification_type in",
]) assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.doesNotMatch(migration, /order\s+by\s+random\s*\(/i);
assert.match(migration, /before insert on public\.notifications/);
assert.match(migration, /delivery_attempted_at/);
assert.match(migration, /stream\.live_session_id::text = split_part\(new\.source_event_id, ':', 2\)/);
assert.match(host, /MAX_VISIBLE_TOASTS = 3/);
assert.match(host, /display\.workArea/);
assert.match(host, /getDisplayMatching/);
assert.match(host, /contextIsolation: true/);
assert.match(host, /nodeIntegration: false/);
assert.match(host, /sandbox: true/);
assert.match(host, /focusable: false/);
assert.match(host, /playPicomToastSound/);
assert.match(host, /export function initializeDesktopNotificationToastHost\(\): void/);
assert.match(host, /let displayEventsRegistered = false/);
assert.doesNotMatch(host, /^screen\.on\(/m);
assert.match(main, /initializeDesktopNotificationToastHost/);
assert.match(main, /app\.whenReady\(\)\.then\(\(\) => \{[\s\S]*initializeDesktopNotificationToastHost\(\)/);
assert.match(main, /function isTrustedMainWindowIpcEvent\(event: Electron\.IpcMainInvokeEvent\): boolean/);
assert.match(main, /ipcMain\.handle\(IPC_CHANNELS\.desktopNotificationToastShow,[\s\S]*isTrustedMainWindowIpcEvent\(event\)/);
assert.match(main, /IPC_CHANNELS\.desktopNotificationToastAction,[\s\S]*isDesktopNotificationToastSender\(event\)/);
assert.doesNotMatch(center, /localStorage/);
assert.doesNotMatch(center, /Mock workspace ready/);
assert.match(directRealtime, /!featureFlagService\.isEnabled\("DESKTOP_NOTIFICATIONS_ENABLED"\)/);
assert.match(flags, /"DESKTOP_NOTIFICATIONS_ENABLED"/);
assert.match(delivery, /decideNotificationRoute/);
assert.match(delivery, /list_recent_desktop_notification_delivery_candidates/);
assert.match(delivery, /mark_desktop_notification_seen/);
assert.match(delivery, /recipient_id=eq\.\$\{input\.currentUserId\}/);
assert.match(rls, /select plan\(22\)/);
assert.match(rls, /authenticated users cannot create trusted notifications/);
assert.match(rls, /anonymous user cannot claim notifications/);

for (const key of [
  "notifications.desktop.friendRequestReceived.body",
  "notifications.desktop.dmReceived.hidden",
  "notifications.desktop.watchLive",
  "notifications.desktop.dismiss",
]) {
  const expression = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*"[^"\\n]+"`);
  assert.match(settingsI18n, expression, `English settings catalog is missing ${key}`);
  assert.match(settingsI18nTr, expression, `Turkish settings catalog is missing ${key}`);
}
for (const locale of ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"]) assert.match(localeRegistry, new RegExp(`"${locale}"`));

console.log("desktop notification static contracts: PASS");
