import { VideoPresets, VideoQuality, type TrackPublishOptions, type VideoCaptureOptions } from "livekit-client";
import type { MeetingConnectionQuality } from "../../types/meeting";
import type { MeetingCameraQualityPreset, MeetingVideoSubscriptionPlan, MeetingVideoTileSize } from "../../types/meetingVideoGrid";

export const DEFAULT_MEETING_CAMERA_QUALITY: MeetingCameraQualityPreset = "balanced";

export const MEETING_CAMERA_QUALITY_PRESETS = {
  data_saver: { label: "Data Saver", capture: VideoPresets.h360, layers: [VideoPresets.h180] },
  balanced: { label: "Balanced", capture: VideoPresets.h720, layers: [VideoPresets.h180, VideoPresets.h360] },
  high_quality: { label: "High Quality", capture: VideoPresets.h1080, layers: [VideoPresets.h360, VideoPresets.h720] },
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
  if (connection === "poor" || preset === "data_saver") return VideoQuality.LOW;
  if (connection === "good" || preset === "balanced") return VideoQuality.MEDIUM;
  return VideoQuality.HIGH;
}

function tileQuality(size: MeetingVideoTileSize): VideoQuality {
  if (size === "focus") return VideoQuality.HIGH;
  if (size === "standard") return VideoQuality.MEDIUM;
  return VideoQuality.LOW;
}

export function remoteVideoQuality(identity: string, plan: MeetingVideoSubscriptionPlan, connection: MeetingConnectionQuality): VideoQuality {
  const preset = plan.qualityPreset ?? DEFAULT_MEETING_CAMERA_QUALITY;
  const tileSize = plan.tileSizeByIdentity?.[identity] ?? (identity === plan.focusedParticipantIdentity ? "focus" : plan.visibleTileCount <= 4 ? "standard" : "thumbnail");
  const requested = tileQuality(tileSize);
  if (connection === "poor" || preset === "data_saver") return VideoQuality.LOW;
  if (connection === "good" && requested === VideoQuality.HIGH) return VideoQuality.MEDIUM;
  if (preset === "balanced" && requested === VideoQuality.HIGH && identity !== plan.focusedParticipantIdentity) return VideoQuality.MEDIUM;
  return requested;
}
