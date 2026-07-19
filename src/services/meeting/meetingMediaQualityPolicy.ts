import type { TrackPublishOptions, VideoCaptureOptions, VideoQuality } from "livekit-client";
import type { MeetingConnectionQuality } from "../../types/meeting";
import type { MeetingCameraQualityPreset, MeetingVideoSubscriptionPlan, MeetingVideoTileSize } from "../../types/meetingVideoGrid";

export const DEFAULT_MEETING_CAMERA_QUALITY: MeetingCameraQualityPreset = "balanced";

const VIDEO_QUALITY = {
  LOW: 0 as VideoQuality,
  MEDIUM: 1 as VideoQuality,
  HIGH: 2 as VideoQuality,
} as const;

const cameraPreset = (width: number, height: number, maxBitrate: number, maxFramerate: number) => ({
  width,
  height,
  aspectRatio: width / height,
  encoding: { maxBitrate, maxFramerate },
  resolution: { width, height, frameRate: maxFramerate, aspectRatio: width / height },
});

const CAMERA_PRESETS = {
  h180: cameraPreset(320, 180, 160_000, 20),
  h360: cameraPreset(640, 360, 450_000, 20),
  h720: cameraPreset(1280, 720, 1_700_000, 30),
  h1080: cameraPreset(1920, 1080, 3_000_000, 30),
} as const;

export const MEETING_CAMERA_QUALITY_PRESETS = {
  data_saver: { label: "Data Saver", capture: CAMERA_PRESETS.h360, layers: [CAMERA_PRESETS.h180] },
  balanced: { label: "Balanced", capture: CAMERA_PRESETS.h720, layers: [CAMERA_PRESETS.h180, CAMERA_PRESETS.h360] },
  high_quality: { label: "High Quality", capture: CAMERA_PRESETS.h1080, layers: [CAMERA_PRESETS.h360, CAMERA_PRESETS.h720] },
} as const;

export function cameraCaptureOptions(preset: MeetingCameraQualityPreset, deviceId = "default"): VideoCaptureOptions {
  const selected = MEETING_CAMERA_QUALITY_PRESETS[preset].capture;
  return { ...(deviceId === "default" ? {} : { deviceId }), resolution: { width: selected.width, height: selected.height }, frameRate: selected.encoding.maxFramerate };
}

export function cameraPublishOptions(preset: MeetingCameraQualityPreset): TrackPublishOptions {
  const selected = MEETING_CAMERA_QUALITY_PRESETS[preset];
  return { simulcast: true, videoEncoding: selected.capture.encoding, videoSimulcastLayers: [...selected.layers], degradationPreference: "maintain-framerate" };
}

export function localPublishingQuality(preset: MeetingCameraQualityPreset, connection: MeetingConnectionQuality): VideoQuality {
  if (connection === "poor" || preset === "data_saver") return VIDEO_QUALITY.LOW;
  if (connection === "good" || preset === "balanced") return VIDEO_QUALITY.MEDIUM;
  return VIDEO_QUALITY.HIGH;
}

function tileQuality(size: MeetingVideoTileSize): VideoQuality {
  if (size === "focus") return VIDEO_QUALITY.HIGH;
  if (size === "standard") return VIDEO_QUALITY.MEDIUM;
  return VIDEO_QUALITY.LOW;
}

export function remoteVideoQuality(identity: string, plan: MeetingVideoSubscriptionPlan, connection: MeetingConnectionQuality): VideoQuality {
  const preset = plan.qualityPreset ?? DEFAULT_MEETING_CAMERA_QUALITY;
  const tileSize = plan.tileSizeByIdentity?.[identity] ?? (identity === plan.focusedParticipantIdentity ? "focus" : plan.visibleTileCount <= 4 ? "standard" : "thumbnail");
  const requested = tileQuality(tileSize);
  if (connection === "poor" || preset === "data_saver") return VIDEO_QUALITY.LOW;
  if (connection === "good" && requested === VIDEO_QUALITY.HIGH) return VIDEO_QUALITY.MEDIUM;
  if (preset === "balanced" && requested === VIDEO_QUALITY.HIGH && identity !== plan.focusedParticipantIdentity) return VIDEO_QUALITY.MEDIUM;
  return requested;
}
