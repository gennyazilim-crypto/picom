import { ScreenSharePicker } from "./ScreenSharePicker";
import type { ScreenShareQualityPresetId } from "../../utils/screenShareQuality";

type ScreenShareControlsProps = {
  connected: boolean;
  screenSharing: boolean;
  onStart?: (sourceId: string, preset: ScreenShareQualityPresetId) => void;
  onStop?: () => void;
};

export function ScreenShareControls(props: ScreenShareControlsProps) {
  return <ScreenSharePicker {...props} />;
}
