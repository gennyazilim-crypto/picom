import { AppIcon } from "../AppIcon";

export type LiveWatchControlsProps = Readonly<{
  muted: boolean;
  volume: number;
  objectFit: "contain" | "fill";
  chatOpen: boolean;
  pipSupported: boolean;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleObjectFit: () => void;
  onToggleChat: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onLeave: () => void;
  onReport: () => void;
}>;

export function LiveWatchControls({
  muted,
  volume,
  objectFit,
  chatOpen,
  pipSupported,
  onToggleMute,
  onVolumeChange,
  onToggleObjectFit,
  onToggleChat,
  onToggleFullscreen,
  onTogglePip,
  onLeave,
  onReport,
}: LiveWatchControlsProps) {
  return (
    <div className="live-watch-controls" role="toolbar" aria-label="Player controls">
      <button
        type="button"
        className="live-watch-controls__btn"
        aria-label={muted || volume === 0 ? "Unmute stream audio" : "Mute stream audio"}
        aria-pressed={muted || volume === 0}
        onClick={onToggleMute}
      >
        <AppIcon name={muted || volume === 0 ? "volumeOff" : "volume"} size="sm" />
      </button>
      <label className="live-watch-controls__volume">
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          aria-label="Stream volume"
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </label>
      <span className="live-watch-controls__spacer" />
      <button
        type="button"
        className="live-watch-controls__btn"
        aria-label={objectFit === "contain" ? "Fill player" : "Fit to player"}
        aria-pressed={objectFit === "fill"}
        onClick={onToggleObjectFit}
      >
        <AppIcon name="image" size="sm" />
      </button>
      <button
        type="button"
        className="live-watch-controls__btn"
        aria-label={chatOpen ? "Hide chat" : "Show chat"}
        aria-pressed={chatOpen}
        onClick={onToggleChat}
      >
        <AppIcon name="hash" size="sm" />
      </button>
      {pipSupported ? (
        <button type="button" className="live-watch-controls__btn" aria-label="Picture in picture" onClick={onTogglePip}>
          <AppIcon name="minimize" size="sm" />
        </button>
      ) : null}
      <button type="button" className="live-watch-controls__btn" aria-label="Toggle fullscreen" onClick={onToggleFullscreen}>
        <AppIcon name="maximize" size="sm" />
      </button>
      <button type="button" className="live-watch-controls__btn" aria-label="Report stream" onClick={onReport}>
        <AppIcon name="bell" size="sm" />
      </button>
      <button type="button" className="live-watch-controls__btn live-watch-controls__btn--danger" aria-label="Leave stream" onClick={onLeave}>
        <AppIcon name="close" size="sm" />
      </button>
    </div>
  );
}
