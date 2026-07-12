import { readFile } from "node:fs/promises";

const [catalog, overlay, dock, people, control, tile, signal, migration, overlayCss] = await Promise.all([
  readFile("src/services/meeting/meetingReactionCatalog.ts", "utf8"),
  readFile("src/components/meeting/MeetingReactionOverlay.tsx", "utf8"),
  readFile("src/components/meeting/MeetingControlDock.tsx", "utf8"),
  readFile("src/components/meeting/MeetingPeoplePanel.tsx", "utf8"),
  readFile("src/services/meeting/meetingControlService.ts", "utf8"),
  readFile("src/components/meeting/MeetingParticipantTile.tsx", "utf8"),
  readFile("src/services/meeting/meetingSignalService.ts", "utf8"),
  readFile("supabase/migrations/20260711154000_meeting_reactions_hand_signaling.sql", "utf8"),
  readFile("src/components/meeting/MeetingReactionOverlay.css", "utf8"),
]);

const checks = [
  [catalog.includes("MEETING_REACTION_OPTIONS") && catalog.includes("thumbs_up") && catalog.includes("clap"), "approved reaction catalog"],
  [overlay.includes("snapshot.reactions") && overlay.includes("expiresAt") && tile.includes("MeetingReactionOverlay"), "ephemeral per-participant tile overlay"],
  [overlayCss.includes("prefers-reduced-motion:reduce") && overlayCss.includes("animation:none"), "reduced-motion static reaction badges"],
  [dock.includes("reactionCooldownMs") && signal.includes("MEETING_REACTION_RATE_LIMITED"), "client and transport reaction spam controls"],
  [control.includes("request_stage") && control.includes("cancel_stage") && dock.includes("Request to speak"), "stage-aware control dock hand action"],
  [people.includes("Raised hands") && people.includes("acknowledgeHand") && people.includes("handSequence"), "raised-hand queue and host acknowledgement"],
  [migration.includes("close_meeting_signal_on_participant_exit") && migration.includes("hand_raised=false"), "stale hand cleanup on participant exit"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Meeting reactions and raised-hand UI contract passed.");
