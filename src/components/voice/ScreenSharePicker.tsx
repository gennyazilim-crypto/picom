import { useEffect, useRef, useState } from "react";
import { AppIcon } from "../AppIcon";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { screenShareQualityPresets, type ScreenShareQualityPresetId } from "../../utils/screenShareQuality";

type PickerStatus = "idle" | "loading" | "ready" | "error";

type ScreenSharePickerProps = {
  connected: boolean;
  screenSharing: boolean;
  onStart?: (sourceId: string, preset: ScreenShareQualityPresetId, sourceLabel?: string) => void;
  onStop?: () => void;
};

export function ScreenSharePicker({ connected, screenSharing, onStart, onStop }: ScreenSharePickerProps) {
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [sources, setSources] = useState<ScreenCaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceRequestId, setSourceRequestId] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<ScreenShareQualityPresetId>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const activeRequestId = useRef<string | null>(null);

  useEffect(() => () => { if (activeRequestId.current) void screenCaptureService.cancelSelection(activeRequestId.current); }, []);

  async function loadSources(): Promise<void> {
    setStatus("loading");
    setError(null);
    setGuidance(null);
    setRetryable(false);
    setNotice(null);

    if(activeRequestId.current)await screenCaptureService.cancelSelection(activeRequestId.current);
    activeRequestId.current=null;
    const result = await screenCaptureService.listSources();
    if (!result.ok) {
      setSources([]);
      setSelectedSourceId(null);
      setSourceRequestId(null);
      setError(result.message);
      setGuidance(result.guidance);
      setRetryable(result.retryable);
      setStatus("error");
      return;
    }

    setSources(result.sources);
    activeRequestId.current=result.requestId;
    setSourceRequestId(result.requestId);
    setSelectedSourceId(result.sources[0]?.id ?? null);
    setStatus("ready");
  }

  async function cancelSourceSelection(): Promise<void> {
    if (sourceRequestId) await screenCaptureService.cancelSelection(sourceRequestId);
    activeRequestId.current=null;
    setSources([]);
    setSelectedSourceId(null);
    setSourceRequestId(null);
    setError(null);
    setGuidance(null);
    setRetryable(false);
    setNotice("Screen source selection canceled.");
    setStatus("idle");
  }

  async function startSelectedSource(): Promise<void> {
    if (!sourceRequestId || !selectedSourceId) return;
    setStatus("loading");
    setError(null);
    const result = await screenCaptureService.selectSource(sourceRequestId, selectedSourceId);
    activeRequestId.current=null;
    if (!result.ok) {
      setError(result.message);
      setGuidance(result.guidance);
      setRetryable(result.retryable);
      setSources([]);
      setSelectedSourceId(null);
      setSourceRequestId(null);
      setStatus("error");
      return;
    }
    onStart?.(result.source.id, qualityPreset, result.source.name);
    setSources([]);
    setSelectedSourceId(null);
    setSourceRequestId(null);
    setStatus("idle");
  }

  const selectedSource = sources.find((source) => source.id === selectedSourceId);
  const startDisabled = !connected || status === "loading" || (!screenSharing && (!selectedSourceId || !sourceRequestId));

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
        <div className="screen-share-picker-actions">
          {!screenSharing && sources.length ? <button type="button" onClick={() => void loadSources()} disabled={status === "loading"}>Refresh</button> : null}
          <button type="button" onClick={screenSharing ? onStop : sources.length ? () => void cancelSourceSelection() : () => void loadSources()} disabled={status === "loading"}>
            {screenSharing ? "Stop sharing" : status === "loading" ? "Loading..." : sources.length ? "Cancel" : "Choose source"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="screen-share-picker-error" role="alert">
          <strong>{error}</strong>
          {guidance ? <span>{guidance}</span> : null}
          {retryable ? <button type="button" onClick={() => void loadSources()} disabled={status === "loading"}>Try again</button> : null}
        </div>
      ) : null}

      {notice ? <p className="screen-share-picker-note" role="status">{notice}</p> : null}

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
                aria-pressed={source.id === selectedSourceId}
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
              void startSelectedSource();
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
