import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const files = {
  main: read("electron/main.cts"),
  preload: read("electron/preload.cts"),
  capture: read("src/services/screenCaptureService.ts"),
  picker: read("src/components/voice/ScreenSharePicker.tsx"),
  preview: read("src/components/voice/ScreenSharePreview.tsx"),
  viewer: read("src/components/voice/ScreenShareViewer.tsx"),
  voice: read("src/services/voiceService.ts"),
};

const checks = [
  ["native source enumeration stays in Electron main", files.main.includes("desktopCapturer.getSources")],
  ["source enumeration requires a focused initiating window", files.main.includes("sourceWindow.isFocused()")],
  ["only screen and window sources are requested", files.main.includes('types: ["screen", "window"]')],
  ["preload exposes a narrow validated source bridge", files.preload.includes("parseScreenCaptureListPayload") && files.preload.includes("parseScreenCaptureSelectionPayload")],
  ["renderer never receives raw desktopCapturer", !files.preload.includes("desktopCapturer")],
  ["source requests are explicit user actions", files.capture.includes("userInitiated: true")],
  ["selection supports cancel and refresh", files.picker.includes("cancelSourceSelection") && files.picker.includes("Refresh")],
  ["system audio is not requested", /createElectronScreenShareConstraints[\s\S]*?audio:\s*false/.test(files.voice)],
  ["source IDs are validated before capture", files.voice.includes('/^(screen|window):[a-zA-Z0-9:_-]{1,240}$/.test(sourceId)')],
  ["capture publishes a LiveKit screen-share track", files.voice.includes("source: Track.Source.ScreenShare")],
  ["active members are not role-gated by the screen UI", !/owner|admin|moderator/i.test(files.picker)],
  ["source-ended stops and unpublishes the local track", files.voice.includes('stopScreenShareInternal(activeRoom, "track_ended")') && files.voice.includes("unpublishTrack(track, true)")],
  ["participant departure removes remote shares", files.voice.includes("removeParticipantScreenShares(participant.identity)")],
  ["remote tracks retain sharer identity", files.voice.includes("participantName: participant.name || participant.identity")],
  ["multiple shares have a visible switcher", files.preview.includes("shares.length > 1") && files.preview.includes("onSelectShare")],
  ["remote media renders through a video srcObject", files.viewer.includes("videoRef.current.srcObject = share.stream")],
  ["local preview is muted to avoid capture feedback", files.viewer.includes("muted={share.isLocal}")],
  ["leave clears all screen-share state", files.voice.includes("screenShares: []") && files.voice.includes("focusedScreenShareId: null")],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
if (failures.length) {
  console.error(`Self-hosted screen-share contract failed (${failures.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`Self-hosted screen-share contract passed (${checks.length}/${checks.length}).`);
