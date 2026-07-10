export type ScreenShareQualityPresetId = "presentation" | "balanced" | "performance";

export type ScreenShareQualityPreset = Readonly<{
  id: ScreenShareQualityPresetId;
  label: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
}>;

export const screenShareQualityPresets: readonly ScreenShareQualityPreset[] = [
  { id: "presentation", label: "Presentation", description: "Sharper text and slides", width: 1920, height: 1080, frameRate: 15 },
  { id: "balanced", label: "Balanced", description: "Clear motion and detail", width: 1280, height: 720, frameRate: 24 },
  { id: "performance", label: "Performance", description: "Lower CPU and bandwidth", width: 960, height: 540, frameRate: 15 },
] as const;

export function getScreenShareQualityPreset(id: ScreenShareQualityPresetId): ScreenShareQualityPreset {
  return screenShareQualityPresets.find((preset) => preset.id === id) ?? screenShareQualityPresets[1];
}

export function getScreenShareTrackConstraints(id: ScreenShareQualityPresetId): MediaTrackConstraints {
  const preset = getScreenShareQualityPreset(id);
  return {
    width: { max: preset.width },
    height: { max: preset.height },
    frameRate: { max: preset.frameRate },
  };
}
