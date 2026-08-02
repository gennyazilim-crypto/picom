export type ScreenShareQualityPresetId = "presentation" | "balanced" | "performance";

export type ScreenShareQualityPreset = Readonly<{
  id: ScreenShareQualityPresetId;
  label: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}>;

export const screenShareQualityPresets: readonly ScreenShareQualityPreset[] = [
  { id: "presentation", label: "Presentation HD", description: "Sharp 1080p text and slides", width: 1920, height: 1080, frameRate: 30, maxBitrate: 6_000_000 },
  { id: "balanced", label: "Balanced HD", description: "1080p motion and detail", width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_500_000 },
  { id: "performance", label: "Performance", description: "720p for limited connections", width: 1280, height: 720, frameRate: 24, maxBitrate: 2_500_000 },
] as const;

export function getScreenShareQualityPreset(id: ScreenShareQualityPresetId): ScreenShareQualityPreset {
  return screenShareQualityPresets.find((preset) => preset.id === id) ?? screenShareQualityPresets[1];
}

export function getScreenShareTrackConstraints(id: ScreenShareQualityPresetId): MediaTrackConstraints {
  const preset = getScreenShareQualityPreset(id);
  return {
    width: { ideal: preset.width, max: preset.width },
    height: { ideal: preset.height, max: preset.height },
    frameRate: { ideal: preset.frameRate, max: preset.frameRate },
  };
}
