import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { attachLocalPreviewStream, detachLocalPreviewStream } from "../../utils/electronDesktopCapture";
import { registerFirstLaunchMediaCleanup } from "../../services/firstLaunchMediaCleanup";

export type FirstLaunchScreenShareSummary = Readonly<{
  attempted: boolean;
  passed: boolean;
  skipped: boolean;
  blocked: boolean;
  unavailable: boolean;
}>;

type ScreenPreflightStatus = "not-tested" | "checking" | "picker-ready" | "source-selected" | "capture-ready" | "stopped" | "permission-blocked" | "unavailable" | "error";

type FirstLaunchScreenSharePreflightProps = Readonly<{
  onSummaryChange: (summary: FirstLaunchScreenShareSummary) => void;
}>;

type LocalCaptureResult = Awaited<ReturnType<typeof screenCaptureService.acquireBrowserDisplayMedia>>
  | Awaited<ReturnType<typeof screenCaptureService.acquireElectronDesktopMedia>>;

function errorKey(error: string | null): string {
  switch (error) {
    case "SCREEN_CAPTURE_PERMISSION_DENIED": return "screen.error.permission";
    case "SCREEN_CAPTURE_NO_SOURCES": return "screen.error.noSources";
    case "SCREEN_CAPTURE_UNAVAILABLE": return "screen.error.unavailable";
    default: return "screen.error.unknown";
  }
}

function statusKey(status: ScreenPreflightStatus): string {
  switch (status) {
    case "checking": return "screen.checking";
    case "picker-ready": return "screen.pickerReady";
    case "source-selected": return "screen.sourceSelected";
    case "capture-ready": return "screen.captureReady";
    case "stopped": return "screen.stopped";
    case "permission-blocked": return "screen.permissionBlocked";
    case "unavailable": return "screen.unavailable";
    case "error": return "screen.error";
    default: return "screen.notTested";
  }
}

/** A session-only, local screen-share preflight. It never joins or publishes to a call. */
export function FirstLaunchScreenSharePreflight({ onSummaryChange }: FirstLaunchScreenSharePreflightProps) {
  const { t } = useTranslation("firstLaunch");
  const [status, setStatus] = useState<ScreenPreflightStatus>("not-tested");
  const [sources, setSources] = useState<readonly ScreenCaptureSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Readonly<{ width: number; height: number }> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const summaryRef = useRef<FirstLaunchScreenShareSummary>({ attempted: false, passed: false, skipped: false, blocked: false, unavailable: false });

  const updateSummary = (patch: Partial<FirstLaunchScreenShareSummary>) => {
    const next = { ...summaryRef.current, ...patch };
    summaryRef.current = next;
    onSummaryChange(next);
  };

  const stopPreview = (nextStatus: ScreenPreflightStatus = "stopped", options: Readonly<{ keepPassed?: boolean }> = {}) => {
    generationRef.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    detachLocalPreviewStream(videoRef.current, stream);
    stream?.getTracks().forEach((track) => track.stop());
    setDimensions(null);
    setStatus(nextStatus);
    if (!options.keepPassed && nextStatus !== "capture-ready") {
      updateSummary({
        passed: false,
        blocked: nextStatus === "permission-blocked",
        unavailable: nextStatus === "unavailable",
      });
    }
  };

  useEffect(() => {
    const unregister = registerFirstLaunchMediaCleanup(() => stopPreview("stopped", { keepPassed: true }));
    return () => {
      unregister();
      stopPreview("stopped", { keepPassed: true });
      const requestId = requestIdRef.current;
      requestIdRef.current = null;
      if (requestId) void screenCaptureService.cancelSelection(requestId);
    };
  }, []);

  const openLocalPreview = async (acquired: LocalCaptureResult, generation: number) => {
    if (!acquired.ok) {
      if (generation !== generationRef.current) return;
      setError(acquired.error);
      setGuidance(acquired.guidance);
      const nextStatus = acquired.error === "SCREEN_CAPTURE_PERMISSION_DENIED" ? "permission-blocked" : acquired.error === "SCREEN_CAPTURE_UNAVAILABLE" ? "unavailable" : "error";
      setStatus(nextStatus);
      updateSummary({ attempted: true, passed: false, skipped: false, blocked: nextStatus === "permission-blocked", unavailable: nextStatus === "unavailable" });
      return;
    }
    if (generation !== generationRef.current) {
      acquired.stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const videoTrack = acquired.stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      acquired.stream.getTracks().forEach((track) => track.stop());
      setError("SCREEN_CAPTURE_FAILED");
      setStatus("error");
      return;
    }
    streamRef.current = acquired.stream;
    videoTrack.addEventListener("ended", () => {
      if (streamRef.current !== acquired.stream) return;
      stopPreview("stopped");
      updateSummary({ passed: false, skipped: false, blocked: false, unavailable: false });
    }, { once: true });
    try {
      const video = videoRef.current;
      if (!video) throw new Error("PREVIEW_ELEMENT_UNAVAILABLE");
      const preview = await attachLocalPreviewStream(video, acquired.stream);
      if (generation !== generationRef.current || streamRef.current !== acquired.stream || preview.readyState !== "live") {
        acquired.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setDimensions({ width: preview.videoWidth, height: preview.videoHeight });
      setStatus("capture-ready");
      updateSummary({ attempted: true, passed: true, skipped: false, blocked: false, unavailable: false });
    } catch {
      if (generation !== generationRef.current) return;
      if (streamRef.current === acquired.stream) stopPreview("error");
      setError("SCREEN_CAPTURE_FAILED");
    }
  };

  const testScreenSharing = async () => {
    stopPreview("checking");
    const generation = generationRef.current;
    const previousRequest = requestIdRef.current;
    requestIdRef.current = null;
    if (previousRequest) await screenCaptureService.cancelSelection(previousRequest);
    setSources([]);
    setError(null);
    setGuidance(null);
    updateSummary({ attempted: true, passed: false, skipped: false, blocked: false, unavailable: false });
    // Browsers do not disclose desktop sources to JavaScript. The explicit button
    // opens their native picker directly rather than rendering a synthetic source.
    const browserDisplayAvailable = typeof navigator !== "undefined"
      && typeof (navigator.mediaDevices as Partial<MediaDevices> | undefined)?.getDisplayMedia === "function";
    if (!window.picomDesktop?.screenCapture && browserDisplayAvailable) {
      await openLocalPreview(await screenCaptureService.acquireBrowserDisplayMedia({ video: true, audio: false }), generation);
      return;
    }
    const result = await screenCaptureService.listSources();
    if (generation !== generationRef.current) {
      if (result.ok) void screenCaptureService.cancelSelection(result.requestId);
      return;
    }
    if (!result.ok) {
      setError(result.error);
      setGuidance(result.guidance);
      const nextStatus = result.error === "SCREEN_CAPTURE_PERMISSION_DENIED" ? "permission-blocked" : result.error === "SCREEN_CAPTURE_UNAVAILABLE" || result.error === "SCREEN_CAPTURE_NO_SOURCES" ? "unavailable" : "error";
      setStatus(nextStatus);
      updateSummary({ attempted: true, passed: false, skipped: false, blocked: nextStatus === "permission-blocked", unavailable: nextStatus === "unavailable" });
      return;
    }
    requestIdRef.current = result.requestId;
    setSources(result.sources);
    setStatus("picker-ready");
  };

  const selectSource = async (source: ScreenCaptureSource) => {
    const requestId = requestIdRef.current;
    if (!requestId) return;
    stopPreview("source-selected");
    const selectionGeneration = generationRef.current;
    setError(null);
    setGuidance(null);
    const sourceResult = await screenCaptureService.selectSource(requestId, source.id);
    if (selectionGeneration !== generationRef.current) return;
    if (!sourceResult.ok) {
      setError("SCREEN_CAPTURE_FAILED");
      setGuidance(sourceResult.guidance);
      setStatus("error");
      return;
    }
    const generation = ++generationRef.current;
    await openLocalPreview(await screenCaptureService.acquireElectronDesktopMedia(sourceResult.source.id, { includeAudio: false }), generation);
  };

  const skip = () => {
    stopPreview("not-tested");
    const requestId = requestIdRef.current;
    requestIdRef.current = null;
    if (requestId) void screenCaptureService.cancelSelection(requestId);
    updateSummary({ skipped: true, passed: false, blocked: false, unavailable: false });
  };

  return <section className="first-launch-screen-preflight" aria-labelledby="first-launch-screen-heading">
    <header className="first-launch-media-section-heading">
      <div>
        <p className="first-launch-audio-overline">{t("screen.eyebrow")}</p>
        <h2 id="first-launch-screen-heading">{t("screen.title")}</h2>
        <p>{t("screen.body")}</p>
      </div>
      <span className={`first-launch-media-status is-${status}`} role="status" aria-live="polite">{t(statusKey(status))}</span>
    </header>
    <div className="first-launch-screen-actions">
      <button type="button" className="secondary" onClick={() => void testScreenSharing()} disabled={status === "checking" || status === "source-selected"}>{status === "checking" || status === "source-selected" ? t("screen.checking") : t("screen.test")}</button>
      {status === "capture-ready" || status === "source-selected" ? <button type="button" className="secondary" onClick={() => stopPreview()}>{t("screen.stop")}</button> : null}
      <button type="button" className="secondary" onClick={skip}>{t("screen.skip")}</button>
    </div>
    {error ? <article className="first-launch-media-error" role="alert"><strong>{t(errorKey(error))}</strong>{guidance ? <p>{t("screen.guidance")}</p> : null}</article> : null}
    {sources.length > 0 ? <fieldset className="first-launch-screen-sources">
      <legend>{t("screen.choose")}</legend>
      <div className="first-launch-screen-source-grid">
        {sources.map((source) => <button type="button" key={source.id} className="first-launch-screen-source" onClick={() => void selectSource(source)} disabled={status === "source-selected"}>
          {source.thumbnailDataUrl ? <img src={source.thumbnailDataUrl} alt="" /> : <span className="first-launch-screen-source-placeholder" aria-hidden="true" />}
          <span><strong>{source.name}</strong><small>{source.type === "screen" ? t("screen.sourceScreen") : t("screen.sourceWindow")}</small></span>
        </button>)}
      </div>
    </fieldset> : null}
    <figure className="first-launch-screen-preview" aria-labelledby="first-launch-screen-preview-caption">
      <div className="first-launch-camera-preview-frame">
        <video ref={videoRef} autoPlay muted playsInline aria-label={t("screen.previewLabel")} />
        {status !== "capture-ready" ? <span>{t("screen.previewIdle")}</span> : null}
      </div>
      <figcaption id="first-launch-screen-preview-caption">{status === "capture-ready" && dimensions ? t("screen.previewDimensions", { width: dimensions.width, height: dimensions.height }) : t("screen.previewLabel")}</figcaption>
    </figure>
    <small className="first-launch-media-local-note">{t("screen.localOnly")}</small>
  </section>;
}
