import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [service, view, devicePanel, app, feed, discovery] = await Promise.all([
  read("src/services/voiceService.ts"),
  read("src/components/VoiceRoomView.tsx"),
  read("src/components/VoiceDevicePanel.tsx"),
  read("src/App.tsx"),
  read("src/components/FeedCompanionRail.tsx"),
  read("src/services/activeVoiceRoomDiscoveryService.ts"),
]);

const checks = [
  [service.includes("joinInFlight"), "duplicate voice joins remain guarded"],
  [service.includes("roomContext: VoiceRoomContext | null"), "voice snapshots expose canonical room context"],
  [service.includes("RoomEvent.ActiveSpeakersChanged"), "speaking state comes from LiveKit"],
  [service.includes("RoomEvent.Disconnected"), "unexpected room closure is handled"],
  [service.includes("removeAllListeners"), "LiveKit listeners are cleaned up"],
  [view.includes("<VoiceDevicePanel />"), "VoiceRoomView uses the production device panel"],
  [!view.includes("Audio device selection placeholder"), "raw device placeholder is removed"],
  [devicePanel.includes("voiceDeviceService.selectInput"), "microphone selection reaches the device service"],
  [devicePanel.includes("voiceDeviceService.selectOutput"), "speaker selection reaches the device service"],
  [app.includes("leaveVoiceOnWindowClose"), "window shutdown releases the active voice room"],
  [app.includes("communityName: activeCommunity.name"), "join carries community display context"],
  [app.includes("channelName = displayedActiveChannel.name"), "join carries channel display context"],
  [feed.includes("voiceState.roomContext?.channelName"), "Connected Voice shows the channel label"],
  [discovery.includes("voiceSnapshot.roomContext?.channelId === channel.id"), "room discovery uses stable channel identity"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Voice room client smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Voice room client Full MVP smoke passed (${checks.length} checks).`);
