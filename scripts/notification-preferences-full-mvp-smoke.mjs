import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settings = read("src/services/settingsService.ts");
const service = read("src/services/notificationService.ts");
const center = read("src/services/notificationCenterService.ts");
const modal = read("src/components/SettingsModal.tsx");
const dm = read("src/hooks/useDirectMessageRealtime.ts");
const friends = read("src/services/friends/friendRequestService.ts");
const events = read("src/services/eventReminderService.ts");
const radio = read("src/services/audio/radioScheduleReminderService.ts");

for (const field of ["nativeDesktopEnabled", "soundEnabled", "mentions", "replies", "reactions", "directMessages", "communityAnnouncements", "friendRequests", "friendAcceptances", "incomingCalls", "radioLive", "radioReminders", "podcastReleases", "eventReminders"]) assert.ok(settings.includes(`${field}: boolean`), `missing notification preference: ${field}`);
const schemaVersion = Number(/currentSchemaVersion = (\d+)/.exec(settings)?.[1]);
assert.ok(schemaVersion >= 9 && settings.includes("fromVersion: 8") && settings.includes('previousApplyTo === "sounds_only_placeholder"') && settings.includes("applyTo: migratedApplyTo"), "settings migrations must retain the v9 notification normalization while allowing later unrelated schema versions");
for (const marker of ["isNotificationCategoryEnabled", "nativeDesktopEnabled", "soundEnabled", "Duplicate notification suppressed.", "User is already reading the active channel.", "isChannelMuted", "isCommunityMuted"]) assert.ok(service.includes(marker), `missing central notification enforcement: ${marker}`);
for (const marker of ["notifications.enableAll", "notifications.nativeDesktop", "notifications.sound", "notifications.dnd", "notifications.pref.podcastReleases.label", "notifications.pref.radioLive.label", "notifications.pref.eventReminders.label", "notifications.sendTest", "notifications.muted.title"]) assert.ok(modal.includes(marker), `missing settings UI: ${marker}`);
assert.ok(center.includes("preferenceCategory ?? routeCategory"), "notification inbox must honor semantic preference categories");
assert.ok(dm.includes('category: "direct_message"') && dm.includes("isNearBottom"), "DM notifications must honor direct-message preference and visible context");
assert.ok(friends.includes('accepted ? "friend_acceptance" : "friend_request"'), "friend notifications must use semantic categories");
assert.ok(events.includes('category: "event_reminder"'), "event reminders must use semantic category");
assert.ok(radio.includes('event.kind === "live" ? "radio_live" : "radio_reminder"'), "Radio notifications must separate live and reminder preferences");
console.log("Notification preferences Full MVP smoke: PASS");
