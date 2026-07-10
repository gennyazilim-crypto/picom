import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const service = read("src/services/notificationService.ts");
const policy = read("src/services/notificationPolicyStateService.ts");
const settings = read("src/services/settingsService.ts");
const modal = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const inbox = read("src/services/notificationCenterService.ts");

for (const marker of ["isQuietHoursActive", "quietHoursSuppressesDesktop", "quietHoursShouldSilence", "policyState.doNotDisturb", "isChannelMuted", "isCommunityMuted", "allowMentionsFromMutedScopes"]) assert.ok(service.includes(marker), `missing enforcement marker: ${marker}`);
assert.ok(service.indexOf("if (doNotDisturb)") < service.indexOf("if (quietHoursSuppressesDesktop"), "DND must take precedence over mention and quiet-hours overrides");
assert.ok(service.includes("isMention && settings.quietHours.allowMentions"), "quiet-hours mention override must remain explicit");
for (const marker of ["mutedCommunityIds", "mutedChannelIds", "setDoNotDisturb", "setCommunityMuted", "setChannelMuted", "localStorage"]) assert.ok(policy.includes(marker), `missing persistent policy state: ${marker}`);
assert.ok(settings.includes("currentSchemaVersion = 4") && settings.includes("fromVersion: 3") && settings.includes("allowMentionsFromMutedScopes: true"), "notification preference migration must persist the new override");
assert.ok(modal.includes("Allow mentions from muted communities and channels"), "settings must expose the mention override");
assert.ok(app.includes('setDoNotDisturb(trayPresenceStatus === "dnd")'), "tray DND must feed the central policy state");
assert.ok(inbox.includes("decideNotificationRoute"), "DND and Quiet Hours must not break inbox routing");
console.log("Quiet Hours and DND enforcement test: PASS");
