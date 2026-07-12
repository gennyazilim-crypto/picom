import { readFile } from "node:fs/promises";

const [policy, types, voice, grid, speaker, stage, adapter] = await Promise.all([
  readFile("src/services/meeting/meetingMediaQualityPolicy.ts", "utf8"),
  readFile("src/types/meetingVideoGrid.ts", "utf8"),
  readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/components/meeting/MeetingVideoGrid.tsx", "utf8"),
  readFile("src/components/meeting/MeetingSpeakerFocus.tsx", "utf8"),
  readFile("src/components/meeting/MeetingStageAudience.tsx", "utf8"),
  readFile("src/services/meeting/meetingLiveKitAdapter.ts", "utf8"),
]);

const checks = [
  [types.includes('"data_saver" | "balanced" | "high_quality"') && policy.includes("MEETING_CAMERA_QUALITY_PRESETS"), "Data Saver, Balanced, and High Quality presets"],
  [voice.includes("adaptiveStream: { pixelDensity: 1, pauseVideoInBackground: true }") && voice.includes("dynacast: true"), "LiveKit adaptive stream and dynacast"],
  [policy.includes("simulcast: true") && policy.includes("videoSimulcastLayers"), "LiveKit simulcast publishing layers"],
  [voice.includes("publication.setSubscribed(subscribed)") && voice.includes("publication.setVideoQuality"), "hidden tracks unsubscribe and visible tracks request layers"],
  [types.includes("tileSizeByIdentity") && types.includes("visible.length <= 4") && speaker.includes("thumbnail") && grid.includes("buildMeetingVideoGridPlan"), "layout/tile-size quality hints"],
  [stage.includes("stageOnly: true") && stage.includes("stage.filter((participant) => participant.cameraEnabled)"), "stage viewers subscribe only to stage cameras"],
  [policy.includes('connection === "poor"') && voice.includes("ConnectionQualityChanged") && voice.includes("applyLocalCameraPublishingQuality"), "congestion caps local and remote video"],
  [voice.includes("applyRemoteAudioSubscription") && !policy.includes("Audio"), "audio subscription remains outside video adaptation"],
  [adapter.includes("setCameraQualityPreset") && voice.includes("cameraCaptureOptions") && voice.includes("cameraPublishOptions"), "single LiveKit service controls capture and publish presets"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Meeting adaptive media quality contract passed.");
