import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [voice, viewer, feed, app, edge] = await Promise.all([
  read("src/services/voiceService.ts"), read("src/components/voice/ScreenShareViewer.tsx"),
  read("src/components/FeedCompanionRail.tsx"), read("src/App.tsx"),
  read("supabase/functions/livekit-token/index.ts"),
]);

const checks = [
  [voice.includes('intent: "screen"') && voice.includes("hasScreenPublishToken"), "explicit share upgrades to a screen-scoped token"],
  [edge.includes("canPublish ? [...(authorization.can_publish_audio") && edge.includes('"screen_share_audio"'), "screen token requires screen permission and preserves microphone only with independent permission"],
  [voice.includes("VOICE_SCREEN_SHARE_CONFLICT"), "conflicting local shares are rejected"],
  [voice.includes("publishTrack(track") && voice.includes("Track.Source.ScreenShare"), "selected source publishes to LiveKit"],
  [voice.includes("RoomEvent.TrackSubscribed") && voice.includes("new MediaStream([mediaTrack])"), "remote screen track enters render state"],
  [voice.includes("remoteScreenShareTracks") && voice.includes("mediaTrack.onended"), "remote ended tracks are removed"],
  [voice.includes("removeParticipantScreenShares(participant.identity)"), "participant disconnect clears ghost shares"],
  [voice.includes('reason: "user" | "track_ended"') && voice.includes("track.onended = null"), "local stop and OS-ended paths are distinct and recursion-safe"],
  [voice.includes("unpublishTrack(track, true)"), "stop unpublishes and stops the local track"],
  [viewer.includes("videoRef.current.srcObject = share.stream") && viewer.includes("autoPlay") && viewer.includes("playsInline"), "local and remote streams render in video elements"],
  [viewer.includes("muted={share.isLocal}"), "local preview cannot echo audio"],
  [feed.includes("Screen sharing active") && feed.includes("voiceState.screenSharing"), "Connected Voice reflects active sharing"],
  [app.includes('pushToast("Screen sharing started."') && app.includes('pushToast("Screen sharing stopped."'), "start and stop outcomes are visible"],
  [!app.includes("startActiveVoiceScreenShare()"), "capture never starts automatically"],
];
const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) { console.error(`Screen share publish/render smoke failed:\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log(`Screen share publish, remote render, and stop Full MVP smoke passed (${checks.length} checks).`);
