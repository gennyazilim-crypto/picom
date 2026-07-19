import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [view, css, signals] = await Promise.all([
  read("src/components/VoiceRoomView.tsx"),
  read("src/components/VoiceRoomView.css"),
  read("src/services/voice/voiceStageSignalService.ts"),
]);

const checks = [
  [view.includes("function VoiceParticipantCamera"), "camera video attaches to participant tiles"],
  [view.includes("voice-room-tile__avatar"), "avatar fallback remains when camera is off"],
  [view.includes("voice-room-tile__hand"), "raised-hand badge renders on tiles"],
  [view.includes("voiceStageSignalService"), "stage signals drive hand and reactions"],
  [view.includes("MEETING_REACTION_OPTIONS"), "reaction picker reuses meeting reaction catalog"],
  [view.includes("cameraTracks={cameraTracks}"), "live camera tracks pass into the stage grid"],
  [view.includes("connected ? Math.max(participants.length, 1)"), "connected density follows participant count"],
  [view.includes("const showInviteTile = !connected"), "invite tile leaves the connected participant grid"],
  [css.includes(".voice-room-stage-grid.is-density-1"), "solo density uses a single-column stage"],
  [css.includes("grid-template-columns: minmax(0, 1fr)"), "solo density is one box wide"],
  [css.includes(".voice-room-tile__video"), "camera video styling exists"],
  [css.includes(".voice-room-tile__hand"), "hand badge styling exists"],
  [signals.includes('picom.voice.hand'), "hand raises publish on a voice data topic"],
  [signals.includes('picom.voice.reaction'), "reactions publish on a voice data topic"],
  [signals.includes("publishDataPacket"), "signals use LiveKit data packets"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Voice stage grid smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Voice stage grid smoke passed (${checks.length} checks).`);
