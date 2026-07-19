import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "../AppIcon";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { screenShareQualityPresets, type ScreenShareQualityPresetId } from "../../utils/screenShareQuality";
import "./ScreenSharePickerModal.css";

type ScreenSharePickerModalProps = Readonly<{
  connected: boolean;
  onStart: (sourceId: string, preset: ScreenShareQualityPresetId, sourceLabel?: string) => void;
  onClose: () => void;
}>;

type LoadStatus = "loading" | "ready" | "error";
type SourceFilter = "all" | "screen" | "window";

export function ScreenSharePickerModal({ connected, onStart, onClose }: ScreenSharePickerModalProps) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [sources, setSources] = useState<ScreenCaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceRequestId, setSourceRequestId] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<ScreenShareQualityPresetId>("balanced");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [starting, setStarting] = useState(false);
  const activeRequestId = useRef<string | null>(null);

  const filteredSources = useMemo(() => {
    if (filter === "all") return sources;
    return sources.filter((source) => source.type === filter);
  }, [filter, sources]);

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;

  async function loadSources(): Promise<void> {
    setStatus("loading");
    setError(null);
    setGuidance(null);
    setRetryable(false);
    if (activeRequestId.current) await screenCaptureService.cancelSelection(activeRequestId.current);
    activeRequestId.current = null;

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
    activeRequestId.current = result.requestId;
    setSourceRequestId(result.requestId);
    setSelectedSourceId(result.sources[0]?.id ?? null);
    setStatus("ready");
  }

  useEffect(() => {
    void loadSources();
    return () => {
      if (activeRequestId.current) void screenCaptureService.cancelSelection(activeRequestId.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      void (async () => {
        if (activeRequestId.current) await screenCaptureService.cancelSelection(activeRequestId.current);
        activeRequestId.current = null;
        onClose();
      })();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleStart(sourceId = selectedSourceId): Promise<void> {
    if (!connected || !sourceRequestId || !sourceId || starting) return;
    setSelectedSourceId(sourceId);
    setStarting(true);
    setError(null);
    const result = await screenCaptureService.selectSource(sourceRequestId, sourceId);
    activeRequestId.current = null;
    if (!result.ok) {
      setError(result.message);
      setGuidance(result.guidance);
      setRetryable(result.retryable);
      setSources([]);
      setSelectedSourceId(null);
      setSourceRequestId(null);
      setStatus("error");
      setStarting(false);
      return;
    }
    onStart(result.source.id, qualityPreset, result.source.name);
    onClose();
  }

  async function handleClose(): Promise<void> {
    if (sourceRequestId) await screenCaptureService.cancelSelection(sourceRequestId);
    activeRequestId.current = null;
    onClose();
  }

  return (
    <div className="screen-share-picker-modal" role="dialog" aria-modal="true" aria-label="Choose a screen to share" onClick={() => void handleClose()}>
      <div className="screen-share-picker-modal__card" onClick={(event) => event.stopPropagation()}>
        <header className="screen-share-picker-modal__head">
          <div>
            <p className="screen-share-picker-modal__eyebrow">Screen share</p>
            <h2>Choose what to share</h2>
            <p>Pick a full screen or an application window. Picom will only capture the source you select.</p>
          </div>
          <button type="button" className="screen-share-picker-modal__close" aria-label="Close screen share picker" onClick={() => void handleClose()}>
            <AppIcon name="close" size="sm" />
          </button>
        </header>

        <div className="screen-share-picker-modal__toolbar">
          <div className="screen-share-picker-modal__filters" role="tablist" aria-label="Source type">
            {([
              ["all", "All"],
              ["screen", "Screens"],
              ["window", "Windows"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? "is-active" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="screen-share-picker-modal__quality">
            <span>Quality</span>
            <select
              value={qualityPreset}
              onChange={(event) => setQualityPreset(event.target.value as ScreenShareQualityPresetId)}
              aria-label="Screen share quality"
            >
              {screenShareQualityPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="screen-share-picker-modal__error" role="alert">
            <strong>{error}</strong>
            {guidance ? <p>{guidance}</p> : null}
            {retryable ? (
              <button type="button" onClick={() => void loadSources()} disabled={status === "loading"}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="screen-share-picker-modal__loading" role="status">Loading available screens and windows…</div>
        ) : null}

        {status === "ready" && filteredSources.length === 0 ? (
          <div className="screen-share-picker-modal__empty" role="status">
            No matching sources. Try another filter or refresh.
            <button type="button" onClick={() => void loadSources()}>Refresh</button>
          </div>
        ) : null}

        {filteredSources.length ? (
          <div className="screen-share-picker-modal__grid" aria-label="Available screen capture sources">
            {filteredSources.map((source) => (
              <button
                key={source.id}
                type="button"
                className={`screen-share-picker-modal__source${source.id === selectedSourceId ? " is-selected" : ""}`}
                aria-pressed={source.id === selectedSourceId}
                onClick={() => setSelectedSourceId(source.id)}
                onDoubleClick={() => {
                  void handleStart(source.id);
                }}
              >
                <span className="screen-share-picker-modal__thumb">
                  {source.thumbnailDataUrl ? <img src={source.thumbnailDataUrl} alt="" /> : <span className="screen-share-picker-modal__thumb-fallback" aria-hidden="true" />}
                </span>
                <span className="screen-share-picker-modal__source-meta">
                  <strong>{source.name}</strong>
                  <small>{source.type === "screen" ? "Entire screen" : "Application window"}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <footer className="screen-share-picker-modal__footer">
          <p>
            {selectedSource ? `Selected: ${selectedSource.name}` : "Select a screen or window to continue."}
          </p>
          <div>
            <button type="button" className="screen-share-picker-modal__ghost" onClick={() => void handleClose()}>
              Cancel
            </button>
            <button
              type="button"
              className="screen-share-picker-modal__primary"
              disabled={!connected || !selectedSourceId || !sourceRequestId || starting || status !== "ready"}
              onClick={() => void handleStart()}
            >
              <AppIcon name="maximize" size="sm" />
              {starting ? "Starting…" : connected ? "Share this screen" : "Join room to share"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
