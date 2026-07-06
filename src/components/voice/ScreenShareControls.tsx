import { ScreenSharePicker } from "./ScreenSharePicker";

type ScreenShareControlsProps = {
  connected: boolean;
  screenSharing: boolean;
  onStart?: (sourceId: string) => void;
  onStop?: () => void;
};

export function ScreenShareControls(props: ScreenShareControlsProps) {
  return <ScreenSharePicker {...props} />;
}
