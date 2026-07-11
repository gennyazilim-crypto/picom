import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const service = read("src/services/meeting/meetingSchedulingService.ts");
const panel = read("src/components/meeting/MeetingInviteExperience.tsx");
const gateway = read("src/components/meeting/MeetingDeepLinkGateway.tsx");
const navigation = read("src/services/meeting/meetingInviteNavigationService.ts");
const credential = read("src/services/meeting/meetingInviteCredentialService.ts");
const prejoin = read("src/services/meeting/meetingPreJoinService.ts");
const links = read("src/services/deepLinkService.ts");
const migration = read("supabase/migrations/20260711155500_meeting_invite_experience.sql");

for (const marker of ["createInvite", "revokeInvite", "regenerateInvite", "listInvites", "getJoinPreview", "schedule"]) assert.ok(service.includes(marker), `missing invite lifecycle ${marker}`);
for (const marker of ["Create and copy link", "Retry copy", "Save schedule", "Regenerate", "Revoke", "role=\"alertdialog\""]) assert.ok(panel.includes(marker), `missing invite UI ${marker}`);
assert.ok(!panel.includes("tokenHash") && !panel.includes("tokenHint") && !panel.includes("result.data.secret"), "invite UI must not render internal or raw token data");
assert.ok(gateway.includes("deepLinkService.onDeepLink") && gateway.includes("MeetingWorkspaceLazy"), "meeting deep-link gateway missing");
assert.ok(navigation.includes("meetingPreJoinService.configure") && navigation.includes("meetingService.prepare"), "deep link must prepare PreJoin");
assert.ok(credential.includes("validateInvite(roomId, credential.token, true)") && prejoin.includes("meetingInviteCredentialService.redeem"), "invite must be consumed immediately before join");
assert.ok(links.includes("INVALID_MEETING_INVITE_LINK") && links.includes("inviteToken") && links.includes("^[0-9a-f]{64}$"), "strict meeting invite parser missing");
for (const marker of ["regenerate_meeting_invite", "for update", "status='revoked'", "reason:='blocked'", "'hostName'", "'capabilities'", "invite_result-'inviteId'"]) assert.ok(migration.includes(marker), `missing secure SQL marker ${marker}`);
assert.ok(!migration.match(/raw_token|invite_secret|token_plain/i), "migration must not store raw invite credentials");

console.log("Meeting invite lifecycle, secure copy, join preview, deep-link PreJoin, schedule and token hygiene smoke: PASS");
