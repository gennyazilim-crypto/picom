import { useState } from "react";
import { AppIcon } from "../AppIcon";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { screenShareQualityPresets, type ScreenShareQualityPresetId } from "../../utils/screenShareQuality";

type PickerStatus = "idle" | "loading" | "ready" | "error";

type ScreenSharePickerProps = {
  connected: boolean;
  screenSharing: boolean;
  onStart?: (sourceId: string, preset: ScreenShareQualityPresetId) => void;
  onStop?: () => void;
};

export function ScreenSharePicker({ connected, screenSharing, onStart, onStop }: ScreenSharePickerProps) {
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [sources, setSources] = useState<ScreenCaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<ScreenShareQualityPresetId>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  async function loadSources(): Promise<void> {
    setStatus("loading");
    setError(null);
    setGuidance(null);
    setRetryable(false);

    const result = await screenCaptureService.listSources();
    if (!result.ok) {
      setSources([]);
      setSelectedSourceId(null);
      setError(result.message);
      setGuidance(result.guidance);
      setRetryable(result.retryable);
      setStatus("error");
      return;
    }

    setSources(result.sources);
    setSelectedSourceId(result.sources[0]?.id ?? null);
    setStatus("ready");
  }

  const selectedSource = sources.find((source) => source.id === selectedSourceId);
  const startDisabled = !connected || (!screenSharing && !selectedSourceId);

  return (
    <div className="screen-share-picker">
      <div className="screen-share-picker-header">
        <span className="screen-share-picker-icon">
          <AppIcon name="image" size="sm" />
        </span>
        <div>
          <strong>Screen share source</strong>
          <small>{selectedSource ? selectedSource.name : "Choose a screen or application window"}</small>
        </div>
        <button type="button" onClick={loadSources} disabled={status === "loading"}>
          {status === "loading" ? "Loading..." : "Choose source"}
        </button>
      </div>

      {error ? (
        <div className="screen-share-picker-error" role="alert">
          <strong>{error}</strong>
          {guidance ? <span>{guidance}</span> : null}
          {retryable ? <button type="button" onClick={() => void loadSources()} disabled={status === "loading"}>Try again</button> : null}
        </div>
      ) : null}

      <label className="screen-share-quality-control">
        <span>Share quality</span>
        <select value={qualityPreset} onChange={(event) => setQualityPreset(event.target.value as ScreenShareQualityPresetId)} disabled={screenSharing}>
          {screenShareQualityPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label} - {preset.description}</option>
          ))}
        </select>
      </label>

      {sources.length ? (
        <>
          <div className="screen-source-grid" aria-label="Available screen capture sources">
            {sources.map((source) => (
              <button
                className={`screen-source-card ${source.id === selectedSourceId ? "is-selected" : ""}`}
                key={source.id}
                type="button"
                onClick={() => setSelectedSourceId(source.id)}
              >
                {source.thumbnailDataUrl ? <img src={source.thumbnailDataUrl} alt="" /> : <span className="screen-source-fallback" />}
                <span>
                  <strong>{source.name}</strong>
                  <small>{source.type === "screen" ? "Screen" : "Window"}</small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="screen-share-start-button"
            type="button"
            disabled={startDisabled}
            onClick={() => {
              if (screenSharing) {
                onStop?.();
                return;
              }
              if (selectedSourceId) onStart?.(selectedSourceId, qualityPreset);
            }}
          >
            {screenSharing ? "Stop sharing" : connected ? "Start sharing" : "Join room to share"}
          </button>
        </>
      ) : (
        <p className="screen-share-picker-note">Sources are loaded only after you choose them, so startup never triggers capture prompts.</p>
      )}
    </div>
  );
}
