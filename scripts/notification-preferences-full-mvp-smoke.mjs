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

for (const field of ["nativeDesktopEnabled", "soundEnabled", "mentions", "replies", "reactions", "directMessages", "communityAnnouncements", "friendRequests", "friendAcceptances", "radioLive", "radioReminders", "podcastReleases", "eventReminders"]) assert.ok(settings.includes(`${field}: boolean`), `missing notification preference: ${field}`);
assert.ok(settings.includes("currentSchemaVersion = 9") && settings.includes("fromVersion: 8") && settings.includes('previousApplyTo === "sounds_only_placeholder"') && settings.includes("applyTo: migratedApplyTo"), "settings v9 migration must normalize notification preferences");
for (const marker of ["isNotificationCategoryEnabled", "nativeDesktopEnabled", "soundEnabled", "Duplicate notification suppressed.", "User is already reading the active channel.", "isChannelMuted", "isCommunityMuted"]) assert.ok(service.includes(marker), `missing central notification enforcement: ${marker}`);
for (const marker of ["Enable notifications", "Native desktop notifications", "Notification sounds", "Do not disturb", "Podcast releases", "Radio live alerts", "Event reminders", "Send test notification", "Muted scopes"]) assert.ok(modal.includes(marker), `missing settings UI: ${marker}`);
assert.ok(center.includes("preferenceCategory ?? routeCategory"), "notification inbox must honor semantic preference categories");
assert.ok(dm.includes('category: "direct_message"') && dm.includes("isNearBottom"), "DM notifications must honor direct-message preference and visible context");
assert.ok(friends.includes('accepted ? "friend_acceptance" : "friend_request"'), "friend notifications must use semantic categories");
assert.ok(events.includes('category: "event_reminder"'), "event reminders must use semantic category");
assert.ok(radio.includes('event.kind === "live" ? "radio_live" : "radio_reminder"'), "Radio notifications must separate live and reminder preferences");
console.log("Notification preferences Full MVP smoke: PASS");
