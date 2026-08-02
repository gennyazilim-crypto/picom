import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "../AppIcon";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { goLiveService, type GoLiveTarget } from "../../services/live/goLiveService";
import { broadcasterChannelService } from "../../services/live/broadcasterChannelService";
import { attachLiveScreenShareSession } from "../../services/live/liveScreenShareRegistry";
import { voiceService } from "../../services/voiceService";
import { loggingService } from "../../services/loggingService";
import {
  attachLocalPreviewStream,
  detachLocalPreviewStream,
} from "../../utils/electronDesktopCapture";
import type { BroadcasterScheduleItem } from "./broadcasterChannelModel";
import {
  GO_LIVE_CATEGORIES,
  GO_LIVE_STEPS,
  allowedVisibilityModes,
  canAdvanceFromStep,
  createEmptyGoLiveDraft,
  evaluateGoLivePreflight,
  loadGoLiveLocalSettings,
  nextGoLiveStep,
  parseGoLiveRouteParams,
  preflightBlocksStart,
  previousGoLiveStep,
  reduceGoLiveStartPhase,
  saveGoLiveLocalSettings,
  sanitizeGoLiveText,
  systemAudioCapabilityLabel,
  validateGoLiveTitle,
  visibilitySummary,
  type GoLiveDraft,
  type GoLivePreflightCheck,
  type GoLiveStartPhase,
  type GoLiveStepId,
  type GoLiveVisibilityMode,
} from "./goLiveModel";
import "./goLive.css";

export type GoLiveWorkspaceProps = Readonly<{
  currentUserId: string;
  initialSearch?: string;
  initialCommunityId?: string | null;
  initialChannelId?: string | null;
  onNotice: (message: string, kind?: "info" | "error" | "success") => void;
  onCancel: () => void;
  onLiveStarted: (input: Readonly<{ liveSessionId: string; communityId: string; channelId: string }>) => void;
}>;

function platformKind(): "electron" | "web" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  if (window.picomDesktop?.screenCapture) return "electron";
  if (typeof navigator.mediaDevices?.getDisplayMedia === "function") return "web";
  return "unknown";
}

function stepLabel(step: GoLiveStepId): string {
  switch (step) {
    case "context":
      return "Context";
    case "source":
      return "Source";
    case "details":
      return "Details";
    case "visibility":
      return "Visibility";
    case "preflight":
      return "Preflight";
    default:
      return step;
  }
}

export function GoLiveWorkspace({
  currentUserId,
  initialSearch = "",
  initialCommunityId = null,
  initialChannelId = null,
  onNotice,
  onCancel,
  onLiveStarted,
}: GoLiveWorkspaceProps) {
  const routeSeed = useMemo(() => parseGoLiveRouteParams(initialSearch), [initialSearch]);
  const settings = useMemo(() => loadGoLiveLocalSettings(), []);
  const [step, setStep] = useState<GoLiveStepId>("context");
  const [draft, setDraft] = useState<GoLiveDraft>(() =>
    createEmptyGoLiveDraft({
      communityId: initialCommunityId ?? routeSeed.communityId,
      channelId: initialChannelId ?? routeSeed.channelId,
      scheduleEventId: routeSeed.scheduleEventId,
      microphoneEnabled: settings.microphoneEnabled ?? false,
      microphoneDeviceId: settings.microphoneDeviceId ?? "default",
      cameraEnabled: false,
      cameraDeviceId: settings.cameraDeviceId ?? "default",
      category: settings.category ?? "other",
      languageCode: settings.languageCode ?? "",
    }),
  );
  const [targets, setTargets] = useState<readonly GoLiveTarget[]>([]);
  const [scheduleOptions, setScheduleOptions] = useState<readonly BroadcasterScheduleItem[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [sources, setSources] = useState<readonly ScreenCaptureSource[]>([]);
  const [sourceRequestId, setSourceRequestId] = useState("");
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [previewDims, setPreviewDims] = useState<Readonly<{ width: number; height: number }> | null>(null);
  const [previewBindError, setPreviewBindError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<readonly GoLivePreflightCheck[]>([]);
  const [startPhase, setStartPhase] = useState<GoLiveStartPhase>("idle");
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const previewAttachGenerationRef = useRef(0);
  const startingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const correlationIdRef = useRef(crypto.randomUUID());

  const stopPreviewTracks = useCallback(() => {
    previewAttachGenerationRef.current += 1;
    const stream = previewStreamRef.current;
    previewStreamRef.current = null;
    detachLocalPreviewStream(previewVideoRef.current, stream);
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    setPreviewStream(null);
    setPreviewDims(null);
    setPreviewBindError(null);
  }, []);

  const stopCameraTracks = useCallback(() => {
    const stream = cameraStreamRef.current;
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    setCameraStream(null);
  }, []);

  const cleanupLocalMedia = useCallback(() => {
    stopPreviewTracks();
    stopCameraTracks();
  }, [stopCameraTracks, stopPreviewTracks]);

  useEffect(() => {
    let cancelled = false;
    setTargetsLoading(true);
    void goLiveService.listBroadcastTargets().then((result) => {
      if (cancelled) return;
      setTargetsLoading(false);
      if (!result.ok) {
        setTargetsError(result.error.message);
        setTargets([]);
        return;
      }
      setTargetsError(null);
      setTargets(result.data);
      const preferredCommunity = draft.communityId;
      const preferredChannel = draft.channelId;
      const match =
        result.data.find((row) => row.communityId === preferredCommunity && row.channelId === preferredChannel)
        ?? result.data.find((row) => row.communityId === preferredCommunity)
        ?? result.data[0];
      if (match) {
        setDraft((current) => ({
          ...current,
          communityId: match.communityId,
          channelId: match.channelId,
          communityName: match.communityName,
          channelName: match.channelName,
          communityVisibility: match.communityVisibility,
          channelPrivate: match.channelPrivate,
          canPublishAudio: match.canPublishAudio,
          canPublishScreen: match.canPublishScreen,
          visibilityMode: allowedVisibilityModes(match).includes(current.visibilityMode)
            ? current.visibilityMode
            : allowedVisibilityModes(match)[0] ?? "channel_members",
        }));
      }
    });
    void broadcasterChannelService.listVisibleBroadcasterSchedule(currentUserId, 20).then((result) => {
      if (cancelled || !result.ok) return;
      setScheduleOptions(result.data.filter((item) => item.status === "published"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  // True unmount only — never depend on stream identity (StrictMode / step changes
  // previously re-ran a stream-bound cleanup and stopped live preview tracks).
  useEffect(() => () => {
    const preview = previewStreamRef.current;
    previewStreamRef.current = null;
    preview?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    const camera = cameraStreamRef.current;
    cameraStreamRef.current = null;
    camera?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }, []);

  useEffect(() => {
    const video = previewVideoRef.current;
    const stream = previewStream;
    if (!video) return;
    if (!stream) {
      detachLocalPreviewStream(video, null);
      return;
    }

    const generation = previewAttachGenerationRef.current;
    let cancelled = false;
    void attachLocalPreviewStream(video, stream)
      .then((result) => {
        if (cancelled || generation !== previewAttachGenerationRef.current) return;
        setPreviewDims({ width: result.videoWidth, height: result.videoHeight });
        setPreviewBindError(null);
      })
      .catch((error) => {
        if (cancelled || generation !== previewAttachGenerationRef.current) return;
        setPreviewDims(null);
        setPreviewBindError(error instanceof Error ? error.message : "PREVIEW_BIND_FAILED");
        loggingService.logWarn("Go Live local preview bind failed", {
          correlationId: correlationIdRef.current,
          message: error instanceof Error ? error.message : String(error),
        }, "live");
      });

    return () => {
      cancelled = true;
      // Detach element only — do not stop tracks (publish re-acquires separately).
      detachLocalPreviewStream(video, stream);
    };
  }, [previewStream]);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (!video) return;
    video.srcObject = cameraStream;
    video.muted = true;
    video.playsInline = true;
    if (cameraStream) void video.play().catch(() => undefined);
    return () => {
      if (video.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraStream]);

  const communities = useMemo(() => {
    const map = new Map<string, { id: string; name: string; visibility: string }>();
    for (const target of targets) {
      if (!map.has(target.communityId)) {
        map.set(target.communityId, {
          id: target.communityId,
          name: target.communityName,
          visibility: target.communityVisibility,
        });
      }
    }
    return [...map.values()];
  }, [targets]);

  const channelsForCommunity = useMemo(
    () => targets.filter((target) => target.communityId === draft.communityId),
    [targets, draft.communityId],
  );

  const visibilityOptions = allowedVisibilityModes(draft);

  const loadSources = useCallback(async () => {
    setSourcesError(null);
    const listed = await screenCaptureService.listSources();
    if (!listed.ok) {
      setSources([]);
      setSourceRequestId("");
      setSourcesError(listed.message);
      return;
    }
    setSourceRequestId(listed.requestId);
    setSources(listed.sources);
  }, []);

  useEffect(() => {
    if (step === "source") void loadSources();
  }, [step, loadSources]);

  const selectSource = useCallback(async (source: ScreenCaptureSource) => {
    stopPreviewTracks();
    setDraft((current) => ({
      ...current,
      sourceId: source.id,
      sourceLabel: source.name.slice(0, 80),
      sourceType: source.id === "browser:display" ? "browser" : source.type,
      includeSystemAudio: null,
      applicationName: sanitizeGoLiveText(source.name, 120),
    }));

    const adoptPreviewStream = (stream: MediaStream) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());
        setPreviewBindError("PREVIEW_TRACK_NOT_LIVE");
        onNotice("Capture opened but the video track is not live. Choose the source again.", "error");
        return false;
      }
      videoTrack.onended = () => {
        if (previewStreamRef.current !== stream) return;
        previewStreamRef.current = null;
        setPreviewStream(null);
        setPreviewDims(null);
        setPreviewBindError("PREVIEW_TRACK_ENDED");
        setDraft((current) => ({
          ...current,
          sourceId: null,
          sourceLabel: "",
          sourceType: null,
        }));
        onNotice("The selected screen or window became unavailable.", "error");
      };
      previewStreamRef.current = stream;
      setPreviewStream(stream);
      setPreviewBindError(null);
      return true;
    };

    if (source.id === "browser:display") {
      const acquired = await screenCaptureService.acquireBrowserDisplayMedia();
      if (!acquired.ok) {
        onNotice(acquired.message, "error");
        setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
        return;
      }
      const hasAudio = acquired.stream.getAudioTracks().length > 0;
      if (!adoptPreviewStream(acquired.stream)) {
        setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
        return;
      }
      setDraft((current) => ({
        ...current,
        includeSystemAudio: hasAudio,
        sourceLabel: "Browser display",
        sourceType: "browser",
      }));
      return;
    }

    let requestId = sourceRequestId;
    let validated = requestId
      ? await screenCaptureService.selectSource(requestId, source.id)
      : { ok: false as const, message: "Refresh capture sources, then choose a screen again.", guidance: "", retryable: true };

    if (!validated.ok) {
      const relisted = await screenCaptureService.listSources();
      if (relisted.ok) {
        setSourceRequestId(relisted.requestId);
        setSources(relisted.sources);
        requestId = relisted.requestId;
        const match = relisted.sources.find((item) => item.id === source.id) ?? relisted.sources[0];
        if (!match) {
          onNotice(validated.message, "error");
          setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
          return;
        }
        validated = await screenCaptureService.selectSource(requestId, match.id);
      }
    }

    if (!validated.ok) {
      onNotice(validated.message, "error");
      setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
      return;
    }

    const selectedSource = validated.source;

    setDraft((current) => ({
      ...current,
      sourceId: selectedSource.id,
      sourceLabel: selectedSource.name.slice(0, 80),
      sourceType: selectedSource.type,
      applicationName: sanitizeGoLiveText(selectedSource.name, 120),
    }));

    // Same Electron desktop-capture contract as LiveKit publish (video-only for preview).
    const acquired = await screenCaptureService.acquireElectronDesktopMedia(selectedSource.id, {
      includeAudio: false,
    });
    if (!acquired.ok) {
      setPreviewBindError(acquired.error);
      onNotice(`${acquired.message} ${acquired.guidance}`.trim(), "error");
      setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
      return;
    }
    if (!adoptPreviewStream(acquired.stream)) {
      setDraft((current) => ({ ...current, sourceId: null, sourceLabel: "", sourceType: null }));
      return;
    }
    setDraft((current) => ({ ...current, includeSystemAudio: false }));
  }, [onNotice, sourceRequestId, stopPreviewTracks]);

  const refreshPreflight = useCallback(async () => {
    const sourceEnded = Boolean(previewStream?.getVideoTracks().some((track) => track.readyState === "ended"));
    const checks = evaluateGoLivePreflight({
      authenticated: Boolean(currentUserId),
      canPublishScreen: draft.canPublishScreen,
      hasCommunityChannel: Boolean(draft.communityId && draft.channelId),
      hasActiveSource: Boolean(draft.sourceId),
      sourceEnded,
      microphoneDesired: draft.microphoneEnabled,
      microphoneReady: draft.microphoneEnabled ? null : true,
      networkOnline: typeof navigator === "undefined" ? true : navigator.onLine,
      livekitReachable: null,
      conflict: false,
    });
    setPreflight(checks);

    if (!draft.communityId || !draft.channelId) return;
    const probe = await voiceService.requestToken({
      communityId: draft.communityId,
      channelId: draft.channelId,
      intent: "screen",
    });
    setPreflight(
      evaluateGoLivePreflight({
        authenticated: Boolean(currentUserId),
        canPublishScreen: draft.canPublishScreen && (probe.ok ? probe.data.canPublishScreen : false),
        hasCommunityChannel: Boolean(draft.communityId && draft.channelId),
        hasActiveSource: Boolean(draft.sourceId),
        sourceEnded,
        microphoneDesired: draft.microphoneEnabled,
        microphoneReady: draft.microphoneEnabled ? (probe.ok ? probe.data.canPublishAudio : null) : true,
        networkOnline: typeof navigator === "undefined" ? true : navigator.onLine,
        livekitReachable: probe.ok,
        conflict: false,
      }),
    );
  }, [currentUserId, draft, previewStream]);

  useEffect(() => {
    if (step === "preflight") void refreshPreflight();
  }, [step, refreshPreflight]);

  const goNext = () => {
    const gate = canAdvanceFromStep(step, draft);
    if (!gate.ok) {
      onNotice(gate.message, "error");
      return;
    }
    if (step === "source") {
      const track = previewStreamRef.current?.getVideoTracks()[0];
      const live = Boolean(track && track.readyState === "live" && previewDims && previewDims.width > 0 && previewDims.height > 0);
      if (!live) {
        onNotice("Wait for the local preview to show real frames before continuing.", "error");
        return;
      }
    }
    const next = nextGoLiveStep(step);
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = previousGoLiveStep(step);
    if (prev) setStep(prev);
  };

  const requestClose = () => {
    if (startPhase === "preparing" || startPhase === "authorizing" || startPhase === "connecting" || startPhase === "publishing") {
      setConfirmClose(true);
      return;
    }
    void abortAndLeave();
  };

  const abortAndLeave = async () => {
    const sessionId = sessionIdRef.current;
    cleanupLocalMedia();
    if (sessionId) {
      await goLiveService.abortBroadcast(sessionId);
      sessionIdRef.current = null;
    }
    if (voiceService.getSnapshot().status === "connected" || voiceService.getSnapshot().status === "connecting") {
      await voiceService.leave().catch(() => undefined);
    }
    onCancel();
  };

  const startLive = async () => {
    if (startingRef.current || startPhase !== "idle") return;
    const title = validateGoLiveTitle(draft.title);
    if (!title.ok) {
      onNotice(title.message, "error");
      return;
    }
    if (!draft.communityId || !draft.channelId || !draft.sourceId) {
      onNotice("Complete all Go Live steps before starting.", "error");
      return;
    }
    if (preflightBlocksStart(preflight)) {
      onNotice("Resolve failed preflight checks before going live.", "error");
      return;
    }

    startingRef.current = true;
    setStartError(null);
    setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "start" }));
    const clientRequestId = draft.clientRequestId ?? crypto.randomUUID();
    setDraft((current) => ({ ...current, clientRequestId }));
    correlationIdRef.current = crypto.randomUUID();

    saveGoLiveLocalSettings({
      microphoneEnabled: draft.microphoneEnabled,
      microphoneDeviceId: draft.microphoneDeviceId,
      cameraEnabled: draft.cameraEnabled,
      cameraDeviceId: draft.cameraDeviceId,
      category: draft.category,
      languageCode: draft.languageCode,
    });

    try {
      setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "authorized" }));
      const started = await goLiveService.startBroadcast({
        communityId: draft.communityId,
        channelId: draft.channelId,
        clientRequestId,
        title: title.value,
        category: draft.category,
        applicationName: sanitizeGoLiveText(draft.applicationName, 120),
        description: sanitizeGoLiveText(draft.description, 2000),
        languageCode: sanitizeGoLiveText(draft.languageCode, 16),
        visibilityMode: draft.visibilityMode,
        scheduleEventId: draft.scheduleEventId,
      });
      if (!started.ok) {
        setStartPhase((phase) => reduceGoLiveStartPhase(phase, started.error.code === "LIVE_FORBIDDEN" ? { type: "permission_denied" } : { type: "fail" }));
        setStartError(started.error.message);
        onNotice(started.error.message, "error");
        return;
      }
      sessionIdRef.current = started.data.id;

      setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "connected" }));
      // Stop local preview tracks so Electron/browser can re-acquire for publish.
      stopPreviewTracks();

      const joined = await voiceService.join({
        communityId: draft.communityId,
        channelId: draft.channelId,
        communityName: draft.communityName,
        channelName: draft.channelName,
        intent: "broadcast",
        liveSessionId: started.data.id,
        muted: !draft.microphoneEnabled,
        cameraEnabled: false,
      });
      if (!joined.ok) {
        setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "fail" }));
        setStartError(joined.error.message);
        await goLiveService.abortBroadcast(started.data.id);
        sessionIdRef.current = null;
        onNotice(joined.error.message, "error");
        return;
      }

      setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "published" }));
      const published = await voiceService.startScreenShare(
        draft.sourceId,
        "balanced",
        draft.sourceLabel || title.value,
        { skipLiveRegistry: true },
      );
      if (!published.ok) {
        setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "rollback" }));
        setStartError(published.error.message);
        await voiceService.leave().catch(() => undefined);
        await goLiveService.abortBroadcast(started.data.id);
        sessionIdRef.current = null;
        onNotice(published.error.message, "error");
        loggingService.logWarn("Go Live publish failed", { correlationId: correlationIdRef.current, code: published.error.code }, "live");
        return;
      }

      if (draft.microphoneEnabled) {
        await voiceService.setMuted(false).catch(() => undefined);
      }

      const confirmed = await goLiveService.confirmBroadcast(started.data.id);
      if (!confirmed.ok) {
        setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "rollback" }));
        setStartError(confirmed.error.message);
        await voiceService.stopScreenShare().catch(() => undefined);
        await voiceService.leave().catch(() => undefined);
        await goLiveService.abortBroadcast(started.data.id);
        sessionIdRef.current = null;
        onNotice(confirmed.error.message, "error");
        return;
      }

      attachLiveScreenShareSession(confirmed.data.id, voiceService.getSnapshot().participants.length);
      setStartPhase((phase) => reduceGoLiveStartPhase(phase, { type: "confirmed" }));
      onNotice("You are live.", "success");
      onLiveStarted({
        liveSessionId: confirmed.data.id,
        communityId: draft.communityId,
        channelId: draft.channelId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the broadcast.";
      setStartPhase("failed");
      setStartError(message);
      onNotice(message, "error");
      loggingService.logWarn("Go Live start crashed", { correlationId: correlationIdRef.current }, "live");
      if (sessionIdRef.current) {
        await goLiveService.abortBroadcast(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    } finally {
      startingRef.current = false;
    }
  };

  const startingBusy = startPhase === "preparing" || startPhase === "authorizing" || startPhase === "connecting" || startPhase === "publishing";
  const systemAudioLabel = systemAudioCapabilityLabel({
    platform: platformKind(),
    sourceType: draft.sourceType,
    includeSystemAudio: draft.includeSystemAudio,
  });

  return (
    <main className="go-live" aria-labelledby="go-live-title">
      <header className="go-live__header">
        <div className="go-live__header-copy">
          <p className="go-live__eyebrow">
            <span className="go-live__eyebrow-dot" aria-hidden="true" />
            Go Live
          </p>
          <h1 id="go-live-title">Prepare your broadcast</h1>
          <p className="go-live__lede">
            Set context, capture source, and policy before anything is published to viewers.
          </p>
        </div>
        <div className="go-live__header-actions">
          <button type="button" className="go-live__ghost go-live__header-close" onClick={requestClose} aria-label="Close Go Live">
            <AppIcon name="close" size="sm" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </header>

      <nav className="go-live__steps" aria-label="Go Live steps">
        <div className="go-live__steps-meta">
          <span className="go-live__steps-eyebrow">Broadcast setup</span>
          <span className="go-live__steps-count" aria-live="polite">
            Step {GO_LIVE_STEPS.indexOf(step) + 1}
            <span className="go-live__steps-count-sep" aria-hidden="true">
              /
            </span>
            {GO_LIVE_STEPS.length}
          </span>
        </div>
        <ol>
          {GO_LIVE_STEPS.map((item, index) => {
            const current = item === step;
            const done = GO_LIVE_STEPS.indexOf(step) > index;
            const stateClass = current ? "is-current" : done ? "is-done" : "is-upcoming";
            return (
              <li key={item} aria-current={current ? "step" : undefined} className={stateClass}>
                <span className="go-live__step-index" aria-hidden="true">
                  {done ? (
                    <svg className="go-live__step-check" viewBox="0 0 16 16" width="12" height="12" focusable="false">
                      <path
                        d="M3.2 8.2 6.4 11.4 12.8 4.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="go-live__step-number">{index + 1}</span>
                  )}
                </span>
                <span className="go-live__step-label">{stepLabel(item)}</span>
                {index < GO_LIVE_STEPS.length - 1 ? (
                  <span
                    className={`go-live__step-connector${done ? " is-complete" : ""}`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="go-live__layout">
        <section className="go-live__preview" aria-label="Local broadcast preview">
          <div className="go-live__preview-chrome">
            <div className="go-live__preview-chrome-copy">
              <p className="go-live__preview-kicker">Local monitor</p>
              <h2 className="go-live__preview-title">Broadcast preview</h2>
            </div>
            <span
              className={`go-live__preview-status${previewStream ? " is-live" : " is-idle"}`}
              role="status"
            >
              <span className="go-live__preview-status-dot" aria-hidden="true" />
              {previewStream ? "Previewing" : "Waiting for source"}
            </span>
          </div>

          <div className={`go-live__preview-frame${previewStream ? " has-signal" : " is-empty-stage"}`}>
            <span className="go-live__preview-badge">
              <span className="go-live__preview-badge-dot" aria-hidden="true" />
              Preview
            </span>
            <video
              ref={previewVideoRef}
              playsInline
              muted
              autoPlay
              className={`go-live__preview-video${previewStream ? "" : " is-empty"}`}
              aria-hidden={!previewStream}
            />
            {!previewStream ? (
              <div className="go-live__preview-empty" role="status">
                <span className="go-live__preview-empty-mark" aria-hidden="true">
                  <AppIcon name="live" size="lg" aria-hidden="true" />
                </span>
                <strong>Waiting for a capture source</strong>
                <p>Choose a screen or window on the right. Local preview stays private until you start the broadcast.</p>
              </div>
            ) : null}
            {cameraStream ? (
              <video
                ref={cameraVideoRef}
                playsInline
                muted
                autoPlay
                className={`go-live__camera-pip${draft.cameraMirror ? " is-mirrored" : ""}`}
                aria-label="Camera preview"
              />
            ) : null}
          </div>

          <dl className="go-live__preview-meta">
            <div>
              <dt>Source</dt>
              <dd title={draft.sourceLabel || "Not selected"}>{draft.sourceLabel || "Not selected"}</dd>
            </div>
            <div>
              <dt>Preview</dt>
              <dd data-testid="go-live-preview-dims">
                {previewDims && previewDims.width > 0 && previewDims.height > 0
                  ? `${previewDims.width}×${previewDims.height}`
                  : previewBindError
                    ? "Not rendering"
                    : previewStream
                      ? "Connecting…"
                      : "—"}
              </dd>
            </div>
            <div>
              <dt>System audio</dt>
              <dd title={systemAudioLabel}>{systemAudioLabel}</dd>
            </div>
            <div>
              <dt>Microphone</dt>
              <dd
                data-tone={draft.microphoneEnabled ? "on" : "off"}
                title={draft.microphoneEnabled ? "On (not monitored in preview)" : "Off"}
              >
                {draft.microphoneEnabled ? "On" : "Off"}
              </dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd
                data-tone={draft.cameraEnabled ? "on" : "off"}
                title={draft.cameraEnabled ? "Local preview only until LiveKit grants camera publish" : "Off"}
              >
                {draft.cameraEnabled ? "Local only" : "Off"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="go-live__panel" aria-live="polite">
          {targetsError ? (
            <div className="go-live__error" role="alert">{targetsError}</div>
          ) : null}

          {step === "context" ? (
            <div className="go-live__form">
              <div className="go-live__form-intro">
                <p className="go-live__form-kicker">Step 1 · Context</p>
                <h2>Broadcast context</h2>
                <p>Choose a community voice channel where you can publish screen share. Permissions are re-checked on the server.</p>
              </div>
              {targetsLoading ? <p role="status">Loading eligible channels…</p> : null}
              <div className="go-live__field-stack">
                <label>
                  Community
                  <select
                    value={draft.communityId ?? ""}
                    onChange={(event) => {
                      const communityId = event.target.value || null;
                      const first = targets.find((row) => row.communityId === communityId);
                      setDraft((current) => ({
                        ...current,
                        communityId,
                        channelId: first?.channelId ?? null,
                        communityName: first?.communityName ?? "",
                        channelName: first?.channelName ?? "",
                        communityVisibility: first?.communityVisibility ?? "private",
                        channelPrivate: first?.channelPrivate ?? false,
                        canPublishAudio: first?.canPublishAudio ?? false,
                        canPublishScreen: first?.canPublishScreen ?? false,
                        visibilityMode: first ? (allowedVisibilityModes(first)[0] ?? "channel_members") : "channel_members",
                      }));
                    }}
                  >
                    <option value="">Select community</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>{community.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Voice channel
                  <select
                    value={draft.channelId ?? ""}
                    onChange={(event) => {
                      const channelId = event.target.value || null;
                      const match = targets.find((row) => row.channelId === channelId);
                      if (!match) return;
                      setDraft((current) => ({
                        ...current,
                        channelId: match.channelId,
                        communityId: match.communityId,
                        communityName: match.communityName,
                        channelName: match.channelName,
                        communityVisibility: match.communityVisibility,
                        channelPrivate: match.channelPrivate,
                        canPublishAudio: match.canPublishAudio,
                        canPublishScreen: match.canPublishScreen,
                        visibilityMode: allowedVisibilityModes(match).includes(current.visibilityMode)
                          ? current.visibilityMode
                          : allowedVisibilityModes(match)[0] ?? "channel_members",
                      }));
                    }}
                  >
                    <option value="">Select channel</option>
                    {channelsForCommunity.map((channel) => (
                      <option key={channel.channelId} value={channel.channelId}>
                        #{channel.channelName}{channel.channelPrivate ? " (private)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {scheduleOptions.length ? (
                  <label>
                    Scheduled stream (optional)
                    <select
                      value={draft.scheduleEventId ?? ""}
                      onChange={(event) => {
                        const scheduleEventId = event.target.value || null;
                        const match = scheduleOptions.find((item) => item.id === scheduleEventId);
                        setDraft((current) => ({
                          ...current,
                          scheduleEventId,
                          title: match?.title && !current.title.trim() ? match.title : current.title,
                          description: match?.description && !current.description.trim() ? match.description : current.description,
                          communityId: match?.communityId ?? current.communityId,
                          channelId: match?.channelId ?? current.channelId,
                        }));
                      }}
                      aria-label="Link scheduled livestream"
                    >
                      <option value="">No scheduled program</option>
                      {scheduleOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} · {new Date(item.startsAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {draft.communityId && draft.channelId ? (
                <div className="go-live__destination" role="status">
                  <span className="go-live__destination-label">Publishing to</span>
                  <strong>{draft.communityName || "Community"}</strong>
                  <span>#{draft.channelName || "channel"}{draft.channelPrivate ? " · private" : ""}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "source" ? (
            <div className="go-live__form">
              <div className="go-live__form-intro">
                <p className="go-live__form-kicker">Step 2 · Source</p>
                <h2>Capture source</h2>
                <p>Use the secure desktop picker or browser display picker. Camera+screen compositor is not offered until the platform supports it.</p>
              </div>

              <div className="go-live__source-block">
                <div className="go-live__source-block-head">
                  <strong>Available sources</strong>
                  <button type="button" className="go-live__source-refresh" onClick={() => void loadSources()}>
                    <AppIcon name="refresh" size="sm" aria-hidden="true" />
                    <span>Refresh</span>
                  </button>
                </div>
                {sourcesError ? <div className="go-live__error" role="alert">{sourcesError}</div> : null}
                {sources.length ? (
                  <ul className="go-live__source-list">
                    {sources.map((source) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          className={draft.sourceId === source.id ? "is-selected" : undefined}
                          onClick={() => void selectSource(source)}
                        >
                          <strong>{source.type === "window" ? "Window" : "Screen"}</strong>
                          <span>{source.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : !sourcesError ? (
                  <p className="go-live__source-empty" role="status">
                    Refresh to load screens and windows available in this Picom session.
                  </p>
                ) : null}
              </div>

              <div className="go-live__option-stack">
                <div className={`go-live__option${draft.microphoneEnabled ? " is-enabled" : ""}${!draft.canPublishAudio ? " is-disabled" : ""}`}>
                  <div className="go-live__option-main">
                    <div className="go-live__option-copy">
                      <strong>Microphone</strong>
                      <span>
                        {draft.canPublishAudio
                          ? "Enable microphone when live. Preview does not monitor mic levels."
                          : "Not permitted in this channel."}
                      </span>
                    </div>
                    <label className="go-live__option-toggle">
                      <span className="sr-only">Enable microphone when live</span>
                      <input
                        type="checkbox"
                        checked={draft.microphoneEnabled}
                        onChange={(event) => setDraft((current) => ({ ...current, microphoneEnabled: event.target.checked }))}
                        disabled={!draft.canPublishAudio}
                      />
                      <span className="go-live__option-track" aria-hidden="true" />
                    </label>
                  </div>
                </div>

                <div className={`go-live__option${draft.cameraEnabled ? " is-enabled" : ""}`}>
                  <div className="go-live__option-main">
                    <div className="go-live__option-copy">
                      <strong>Camera</strong>
                      <span>Local preview only until LiveKit grants camera publish.</span>
                    </div>
                    <label className="go-live__option-toggle">
                      <span className="sr-only">Enable local camera preview</span>
                      <input
                        type="checkbox"
                        checked={draft.cameraEnabled}
                        onChange={async (event) => {
                          const enabled = event.target.checked;
                          stopCameraTracks();
                          setDraft((current) => ({ ...current, cameraEnabled: enabled }));
                          if (!enabled) return;
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({
                              video: { deviceId: draft.cameraDeviceId !== "default" ? { exact: draft.cameraDeviceId } : undefined },
                              audio: false,
                            });
                            cameraStreamRef.current = stream;
                            setCameraStream(stream);
                          } catch {
                            setDraft((current) => ({ ...current, cameraEnabled: false }));
                            onNotice("Camera permission denied. Screen broadcast can continue without camera.", "info");
                          }
                        }}
                      />
                      <span className="go-live__option-track" aria-hidden="true" />
                    </label>
                  </div>
                  {draft.cameraEnabled ? (
                    <label className="go-live__check go-live__option-sub">
                      <input
                        type="checkbox"
                        checked={draft.cameraMirror}
                        onChange={(event) => setDraft((current) => ({ ...current, cameraMirror: event.target.checked }))}
                      />
                      Mirror camera preview
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <div className="go-live__form">
              <div className="go-live__form-intro">
                <p className="go-live__form-kicker">Step 3 · Details</p>
                <h2>Stream details</h2>
                <p>Title and metadata help viewers understand what you are broadcasting before they join.</p>
              </div>
              <div className="go-live__field-stack">
              <label>
                Title
                <input
                  value={draft.title}
                  maxLength={160}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  value={draft.description}
                  maxLength={2000}
                  rows={4}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label>
                Category
                <select
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as GoLiveDraft["category"] }))}
                >
                  {GO_LIVE_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Application / game
                <input
                  value={draft.applicationName}
                  maxLength={120}
                  onChange={(event) => setDraft((current) => ({ ...current, applicationName: event.target.value }))}
                />
              </label>
              <label>
                Language code
                <input
                  value={draft.languageCode}
                  maxLength={16}
                  placeholder="en"
                  onChange={(event) => setDraft((current) => ({ ...current, languageCode: event.target.value }))}
                />
              </label>
              </div>
            </div>
          ) : null}

          {step === "visibility" ? (
            <div className="go-live__form">
              <div className="go-live__form-intro">
                <p className="go-live__form-kicker">Step 4 · Visibility</p>
                <h2>Visibility & policy</h2>
                <p>Who can see this stream?</p>
              </div>
              <fieldset className="go-live__radios">
                {(
                  [
                    { id: "channel_members", label: "Channel members" },
                    { id: "community_members", label: "Community members" },
                    { id: "public_discovery", label: "Public discovery (public communities only)" },
                  ] as const
                ).map((option) => {
                  const enabled = visibilityOptions.includes(option.id);
                  return (
                    <label key={option.id} className={!enabled ? "is-disabled" : undefined}>
                      <input
                        type="radio"
                        name="go-live-visibility"
                        value={option.id}
                        disabled={!enabled}
                        checked={draft.visibilityMode === option.id}
                        onChange={() => setDraft((current) => ({ ...current, visibilityMode: option.id as GoLiveVisibilityMode }))}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </fieldset>
              <p className="go-live__summary" role="status">{visibilitySummary(draft)}</p>
              <div className="go-live__policy">
                <strong>Before you go live</strong>
                <ul>
                  <li>Follow community streaming rules and Picom content policy.</li>
                  <li>Do not share private credentials, personal data, or copyrighted material you do not own.</li>
                  <li>Everything on your selected screen may be visible to viewers.</li>
                </ul>
                <label className="go-live__check">
                  <input
                    type="checkbox"
                    checked={draft.policyAccepted}
                    onChange={(event) => setDraft((current) => ({ ...current, policyAccepted: event.target.checked }))}
                  />
                  I understand and accept these live streaming responsibilities.
                </label>
              </div>
            </div>
          ) : null}

          {step === "preflight" ? (
            <div className="go-live__form">
              <div className="go-live__form-intro">
                <p className="go-live__form-kicker">Step 5 · Preflight</p>
                <h2>Preflight</h2>
                <p>Real checks only — no synthetic bitrate scores.</p>
              </div>
              <ul className="go-live__preflight">
                {preflight.map((check) => (
                  <li key={check.id} data-status={check.status}>
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                  </li>
                ))}
              </ul>
              {startError ? <div className="go-live__error" role="alert">{startError}</div> : null}
              {startingBusy ? (
                <p className="go-live__starting" role="status" aria-live="assertive">
                  Starting broadcast… ({startPhase})
                </p>
              ) : null}
              <button
                type="button"
                className="go-live__primary"
                disabled={startingBusy || preflightBlocksStart(preflight)}
                onClick={() => void startLive()}
              >
                Start broadcast
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="go-live__footer">
        <button type="button" className="go-live__ghost" onClick={goBack} disabled={step === "context" || startingBusy}>
          Back
        </button>
        <div className="go-live__footer-right">
          <button type="button" className="go-live__ghost" onClick={requestClose} disabled={startingBusy}>
            Discard draft
          </button>
          {step !== "preflight" ? (
            <button type="button" className="go-live__primary" onClick={goNext}>
              Continue
            </button>
          ) : null}
        </div>
      </footer>

      {confirmClose ? (
        <div className="go-live__modal" role="dialog" aria-modal="true" aria-labelledby="go-live-close-title">
          <div className="go-live__modal-card">
            <h2 id="go-live-close-title">Cancel broadcast start?</h2>
            <p>Local preview tracks will stop and any starting session will be aborted.</p>
            <div className="go-live__modal-actions">
              <button type="button" className="go-live__ghost" onClick={() => setConfirmClose(false)}>Keep editing</button>
              <button type="button" className="go-live__danger" onClick={() => void abortAndLeave()}>Cancel start</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
