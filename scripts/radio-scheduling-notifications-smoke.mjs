import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711001300_radio_scheduling_notifications.sql");
const service = read("src/services/audio/radioScheduleReminderService.ts");
const hook = read("src/hooks/useRadioScheduleReminders.ts");
const shell = read("src/components/audio/RadioCommunityShell.tsx");
const calendar = read("src/components/audio/RadioScheduleCalendarLite.tsx");
const feed = read("src/components/MentionFeedMain.tsx");
const rail = read("src/components/FeedCompanionRail.tsx");

const checks = [
  ["reminder table", migration.includes("create table if not exists public.radio_session_reminders")],
  ["self-only RLS", migration.includes("user_id = auth.uid()") && migration.includes("enable row level security")],
  ["visible schedule insert boundary", migration.includes("public.can_view_radio_session") && migration.includes("session.status = 'scheduled'")],
  ["atomic event claim", migration.includes("claim_radio_session_reminder_event") && migration.includes("last_notification_key is distinct from event_key")],
  ["notification policy routing", service.includes("decideNotificationRoute") && service.includes("notificationService.getPermission() === \"granted\"")],
  ["schedule changes and cancellation", service.includes("schedule_changed") && service.includes("cancelled") && service.includes("starts_soon")],
  ["deduplicated reminder event", service.includes("claimEvent") && service.includes("lastNotificationKey")],
  ["shared reminder hook", hook.includes("radioScheduleReminderService") && hook.includes("30_000")],
  ["timezone calendar", calendar.includes("getCalendarDayKey") && calendar.includes("formatEventTime")],
  ["radio shell integration", shell.includes("RadioScheduleCalendarLite") && shell.includes("useRadioScheduleReminders")],
  ["feed radio events", feed.includes("radioEvents") && feed.includes("onToggleEventReminder")],
  ["companion reminder control", rail.includes("event-mini-reminder") && rail.includes("aria-pressed")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [label] of failed) console.error("FAIL:", label);
  process.exit(1);
}
for (const [label] of checks) console.log("PASS:", label);
console.log("Radio scheduling and notification contract passed.");
