import { ScreenSharePicker } from "./ScreenSharePicker";
import type { ScreenShareQualityPresetId } from "../../utils/screenShareQuality";

type ScreenShareControlsProps = {
  connected: boolean;
  screenSharing: boolean;
  variant?: "default" | "rail";
  onStart?: (sourceId: string, preset: ScreenShareQualityPresetId, sourceLabel?: string) => void;
  onStop?: () => void;
};

export function ScreenShareControls({ variant = "default", ...props }: ScreenShareControlsProps) {
  return <ScreenSharePicker variant={variant} {...props} />;
}
