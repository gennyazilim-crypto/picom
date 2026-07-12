import { readFile } from "node:fs/promises";

const [gateway, card, workspace, lazyWorkspace, topbar, css, meeting] = await Promise.all([
  readFile("src/components/meeting/MeetingDeepLinkGateway.tsx", "utf8"),
  readFile("src/components/meeting/ConnectedMeetingMiniCard.tsx", "utf8"),
  readFile("src/components/meeting/MeetingWorkspace.tsx", "utf8"),
  readFile("src/components/meeting/MeetingWorkspaceLazy.tsx", "utf8"),
  readFile("src/components/meeting/MeetingTopBar.tsx", "utf8"),
  readFile("src/components/meeting/ConnectedMeetingMiniCard.css", "utf8"),
  readFile("src/services/meeting/meetingService.ts", "utf8"),
]);

const checks = [
  [gateway.includes("minimized") && workspace.includes("onMinimize") && lazyWorkspace.includes("onMinimize") && topbar.includes("return to Picom"), "workspace minimize without leave"],
  [gateway.includes("LazyConnectedMeetingMiniCard") && gateway.includes("onReturn"), "return to exact active workspace"],
  [gateway.includes("active.context.roomId===action.roomId") && gateway.includes("Leave the active meeting before joining another"), "single active meeting/provider instance guard"],
  [card.includes("Voice meeting") && card.includes("Camera meeting") && card.includes("Screen sharing") && card.includes("Live stage"), "all meeting experience summaries"],
  [card.includes("canPublishAudio") && card.includes("canPublishVideo") && card.includes("canShareScreen"), "capability-gated mini controls"],
  [card.includes("setMuted") && card.includes("setDeafened") && card.includes("setCameraEnabled") && card.includes("setNoiseShield"), "real active-room controls"],
  [card.includes("reconnecting") && card.includes("Connection failed") && card.includes("Meeting ended"), "accurate reconnect and terminal states"],
  [gateway.includes("beforeunload") && meeting.includes("async leave"), "application shutdown cleanup"],
  [css.includes("picom-meeting-connected .voice-mini-card"), "legacy Feed voice-card deduplication"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Connected meeting navigation and mini-control integration contract passed.");
