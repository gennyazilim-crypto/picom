import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260710210000_notification_inbox_production.sql");
const remote = read("src/services/supabase/notificationInboxService.ts");
const center = read("src/services/notificationCenterService.ts");
const app = read("src/App.tsx");
const popover = read("src/components/NotificationCenterPopover.tsx");

for (const marker of ["recipient_id = auth.uid()", "notifications_recipient_select", "notifications_recipient_update", "update(read_at, deleted_at)", "deleted_at is null"]) assert.ok(migration.includes(marker), `missing notification RLS marker: ${marker}`);
assert.ok(!migration.includes("showNotification") && migration.includes("Native desktop notifications remain a client routing concern"), "backend must not send native desktop notifications");
for (const marker of ["list(limit", "markRead", "markAllRead", "softDelete", "subscribeToChanges"]) assert.ok(remote.includes(marker), `missing remote inbox operation: ${marker}`);
assert.ok(center.includes("decideNotificationRoute") && center.includes("startRemoteSync") && center.includes("dataSourceService.getStatus().isSupabase"), "center must preserve preferences, DND routing, and local fallback");
assert.ok(app.includes("notificationCenterService.startRemoteSync()"), "authenticated app startup must connect the production inbox");
assert.ok(popover.includes("notificationCenterService.delete(item.id)") && popover.includes('name="trash"'), "delete placeholder must be available without redesigning the inbox");
console.log("Notification inbox production smoke: PASS");
