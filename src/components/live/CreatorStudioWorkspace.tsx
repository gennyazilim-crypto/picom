import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "../AppIcon";
import { screenCaptureService, type ScreenCaptureSource } from "../../services/screenCaptureService";
import { creatorStudioService } from "../../services/live/creatorStudioService";
import { liveScreenShareService } from "../../services/live/liveScreenShareService";
import { notifyLocalScreenShareStopped } from "../../services/live/liveScreenShareRegistry";
import { voiceService, type VoiceServiceSnapshot } from "../../services/voiceService";
import { LiveWatchChat } from "./LiveWatchChat";
import { GO_LIVE_CATEGORIES } from "./goLiveModel";
import {
  CREATOR_STUDIO_TABS,
  activityEventLabel,
  formatMeasurable,
  formatStudioDuration,
  mapCreatorStudioHealth,
  studioTabLabel,
  validateStudioMetadata,
  type CreatorStudioActivityEvent,
  type CreatorStudioChatMode,
  type CreatorStudioHealthSnapshot,
  type CreatorStudioSession,
  type CreatorStudioSummary,
  type CreatorStudioTabId,
  type CreatorStudioViewerRow,
} from "./creatorStudioModel";
import "./creatorStudio.css";

export type CreatorStudioWorkspaceProps = Readonly<{
  liveSessionId: string;
  currentUserId: string;
  onNotice: (message: string, kind?: "info" | "error" | "success") => void;
  onEnded: () => void;
  onOpenLiveNow: () => void;
}>;

export function CreatorStudioWorkspace({
  liveSessionId,
  currentUserId,
  onNotice,
  onEnded,
  onOpenLiveNow,
}: CreatorStudioWorkspaceProps) {
  const [session, setSession] = useState<CreatorStudioSession | null>(null);
  const [voice, setVoice] = useState<VoiceServiceSnapshot>(() => voiceService.getSnapshot());
  const [tab, setTab] = useState<CreatorStudioTabId>("chat");
  const [health, setHealth] = useState<CreatorStudioHealthSnapshot>(() => mapCreatorStudioHealth({
    status: voiceService.getSnapshot().status,
    connectionQuality: voiceService.getSnapshot().connectionQuality ?? "unknown",
    screenPublishing: voiceService.getSnapshot().screenSharing,
    microphoneEnabled: !voiceService.getSnapshot().muted,
    cameraEnabled: Boolean(voiceService.getSnapshot().cameraEnabled),
    reconnectCount: 0,
  }));
  const [activity, setActivity] = useState<readonly CreatorStudioActivityEvent[]>([]);
  const [viewers, setViewers] = useState<readonly CreatorStudioViewerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("other");
  const [chatModeDraft, setChatModeDraft] = useState<CreatorStudioChatMode>("everyone");
  const [sources, setSources] = useState<readonly ScreenCaptureSource[]>([]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [previewFit, setPreviewFit] = useState<"contain" | "cover">("contain");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const endingRef = useRef(false);
  const lastStatusRef = useRef<string>("");

  const localShare = useMemo(
    () => voice.screenShares.find((share) => share.isLocal) ?? null,
    [voice.screenShares],
  );

  const reloadStudio = useCallback(async () => {
    const result = await creatorStudioService.authorizeStudio(liveSessionId);
    if (!result.ok) {
      setError(result.error.message);
      setSession(null);
      return;
    }
    setError(null);
    setSession(result.data);
    setTitleDraft(result.data.title);
    setDescriptionDraft(result.data.description);
    setCategoryDraft(result.data.category);
    setChatModeDraft(result.data.chatMode);
    if (result.data.status === "ended" || result.data.status === "terminated") {
      const endedSummary = await creatorStudioService.getSummary(liveSessionId);
      if (endedSummary.ok) setSummary(endedSummary.data);
    }
  }, [liveSessionId]);

  const reloadPanels = useCallback(async () => {
    const [activityResult, viewersResult] = await Promise.all([
      creatorStudioService.listActivity(liveSessionId),
      creatorStudioService.listViewers(liveSessionId),
    ]);
    if (activityResult.ok) setActivity(activityResult.data);
    if (viewersResult.ok) setViewers(viewersResult.data);
  }, [liveSessionId]);

  useEffect(() => {
    void reloadStudio();
    void reloadPanels();
    const unsubscribeSession = liveScreenShareService.subscribeToLiveShareSession(liveSessionId, () => {
      void reloadStudio();
      void reloadPanels();
    });
    return unsubscribeSession;
  }, [liveSessionId, reloadPanels, reloadStudio]);

  useEffect(() => {
    setVoice(voiceService.getSnapshot());
    return voiceService.subscribe((snapshot) => {
      setVoice(snapshot);
      if (snapshot.status === "reconnecting" && lastStatusRef.current === "connected") {
        void creatorStudioService.bumpReconnect(liveSessionId).then(() => void reloadStudio());
      }
      lastStatusRef.current = snapshot.status;
    });
  }, [liveSessionId, reloadStudio]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshHealth = async () => {
      const stats = await voiceService.collectLocalPublishStats();
      if (cancelled) return;
      setHealth(mapCreatorStudioHealth({
        status: voice.status,
        connectionQuality: voice.connectionQuality ?? "unknown",
        screenPublishing: voice.screenSharing,
        microphoneEnabled: !voice.muted && Boolean(voice.canSpeak),
        cameraEnabled: Boolean(voice.cameraEnabled),
        reconnectCount: session?.reconnectCount ?? 0,
        stats,
      }));
    };
    void refreshHealth();
    const timer = window.setInterval(() => {
      void refreshHealth();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.reconnectCount, voice.cameraEnabled, voice.canSpeak, voice.connectionQuality, voice.muted, voice.screenSharing, voice.status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = localShare?.stream ?? null;
    video.muted = true;
    if (localShare?.stream) void video.play().catch(() => undefined);
  }, [localShare]);

  const durationSeconds = useMemo(() => {
    if (!session?.startedAt) return 0;
    const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
    return Math.max(0, Math.floor((end - Date.parse(session.startedAt)) / 1000));
  }, [nowMs, session?.endedAt, session?.startedAt]);

  const loadSources = async () => {
    const listed = await screenCaptureService.listSources();
    if (!listed.ok) {
      onNotice(listed.message, "error");
      return;
    }
    setSources(listed.sources);
  };

  const saveMetadata = async () => {
    if (!session?.isOwner || metadataBusy) return;
    const gate = validateStudioMetadata({
      title: titleDraft,
      description: descriptionDraft,
      category: categoryDraft,
      chatMode: chatModeDraft,
    });
    if (!gate.ok) {
      onNotice(gate.message, "error");
      return;
    }
    setMetadataBusy(true);
    try {
      const updated = await creatorStudioService.updateMetadata(liveSessionId, {
        title: titleDraft,
        description: descriptionDraft,
        category: categoryDraft as CreatorStudioSession["category"],
        chatMode: chatModeDraft,
      });
      if (!updated.ok) {
        onNotice(updated.error.message, "error");
        return;
      }
      setSession((current) => {
        if (!current) return updated.data;
        return {
          ...updated.data,
          communityName: current.communityName || updated.data.communityName,
          channelName: current.channelName || updated.data.channelName,
          canModerate: current.canModerate || updated.data.canModerate,
        };
      });
      onNotice("Broadcast details updated.", "success");
      void reloadPanels();
    } finally {
      setMetadataBusy(false);
    }
  };

  const changeSource = async (source: ScreenCaptureSource) => {
    if (!session?.isOwner || sourceBusy) return;
    setSourceBusy(true);
    try {
      const validated = await screenCaptureService.listSources();
      if (!validated.ok) {
        onNotice(validated.message, "error");
        return;
      }
      const selected = await screenCaptureService.selectSource(validated.requestId, source.id);
      if (!selected.ok) {
        onNotice(selected.message, "error");
        return;
      }
      const replaced = await voiceService.replaceScreenShareSource(
        selected.source.id,
        "balanced",
        selected.source.name,
      );
      if (!replaced.ok) {
        onNotice(replaced.error.message, "error");
        return;
      }
      onNotice("Screen source switched.", "success");
      void reloadPanels();
    } finally {
      setSourceBusy(false);
    }
  };

  const endStream = async () => {
    if (endingRef.current || ending) return;
    endingRef.current = true;
    setEnding(true);
    setConfirmEnd(false);
    try {
      await voiceService.stopScreenShare().catch(() => undefined);
      notifyLocalScreenShareStopped(liveSessionId);
      await liveScreenShareService.endLiveShare(liveSessionId, "ended").catch(() => undefined);
      await voiceService.leave().catch(() => undefined);
      const endedSummary = await creatorStudioService.getSummary(liveSessionId);
      if (endedSummary.ok) {
        setSummary(endedSummary.data);
        setSession((current) => current ? { ...current, status: "ended", endedAt: new Date().toISOString() } : current);
        onNotice("Broadcast ended.", "success");
        return;
      }
      onNotice("Broadcast ended.", "success");
      onEnded();
    } finally {
      endingRef.current = false;
      setEnding(false);
    }
  };

  if (summary) {
    return (
      <main className="creator-studio" aria-label="Creator Studio summary">
        <section className="creator-studio__summary">
          <p className="creator-studio__eyebrow">Creator Studio</p>
          <h1>{summary.title}</h1>
          <p>Broadcast ended. Summary uses backend-authoritative counters only.</p>
          <dl>
            <div>
              <dt>Duration</dt>
              <dd>{formatStudioDuration(summary.durationSeconds)}</dd>
            </div>
            <div>
              <dt>Peak viewers</dt>
              <dd>{summary.peakConcurrentViewers}</dd>
            </div>
            <div>
              <dt>Unique viewers</dt>
              <dd>{summary.uniqueViewerCount}</dd>
            </div>
            <div>
              <dt>Chat messages</dt>
              <dd>{summary.chatMessageCount}</dd>
            </div>
            <div>
              <dt>Reconnects</dt>
              <dd>{summary.reconnectCount}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{summary.status}</dd>
            </div>
          </dl>
          <div className="creator-studio__modal-actions">
            <button type="button" className="creator-studio__ghost" onClick={onOpenLiveNow}>Open Live Now</button>
            <button type="button" className="creator-studio__btn" onClick={onEnded}>Done</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="creator-studio" aria-label={`Creator Studio — ${session?.title || "Live broadcast"}`}>
      <header className="creator-studio__header">
        <div>
          <p className="creator-studio__eyebrow">Creator Studio</p>
          <h1>{session?.title || "Live broadcast"}</h1>
          <p className="creator-studio__live-meta" role="status">
            <span className="creator-studio__live-dot" aria-hidden="true" />
            <strong>LIVE</strong>
            <strong>{formatStudioDuration(durationSeconds)}</strong>
            <span>{session?.communityName || "Community"} · #{session?.channelName || "channel"}</span>
          </p>
        </div>
        <button type="button" className="creator-studio__ghost" onClick={onOpenLiveNow}>Live Now</button>
      </header>

      {error ? <div className="creator-studio__error" role="alert">{error}</div> : null}

      <div className="creator-studio__stage">
        <section className="creator-studio__preview-wrap" aria-label="Live preview">
          <div className="creator-studio__preview-frame">
            <span className="creator-studio__badge">Preview</span>
            {localShare ? (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ objectFit: previewFit }}
                aria-label={localShare.sourceLabel || "Local screen share preview"}
              />
            ) : (
              <div className="creator-studio__preview-empty" role="status">
                <AppIcon name="live" size="xl" aria-hidden="true" />
                <p>Waiting for a published local screen track.</p>
              </div>
            )}
            {voice.status === "reconnecting" ? (
              <div className="creator-studio__overlay" role="status" aria-live="assertive">Reconnecting…</div>
            ) : null}
            {health.level === "failed" ? (
              <div className="creator-studio__overlay" role="alert">Connection failed</div>
            ) : null}
          </div>
          <div className="creator-studio__stats" aria-live="polite">
            <div className="creator-studio__stat">
              <strong>{session?.viewerCount ?? 0}</strong>
              <span>viewers</span>
            </div>
            <div className="creator-studio__stat">
              <strong>{formatStudioDuration(durationSeconds)}</strong>
              <span>live</span>
            </div>
            <div className="creator-studio__stat" data-health={health.level}>
              <strong>{health.label}</strong>
              <span>stream health</span>
            </div>
            <div className="creator-studio__stat">
              <strong>{localShare?.sourceLabel || "No source"}</strong>
              <span>source</span>
            </div>
          </div>
        </section>

        <aside className="creator-studio__dock" aria-label="Creator tools">
          <div className="creator-studio__tabs" role="tablist" aria-label="Creator tools">
            {CREATOR_STUDIO_TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
              >
                {studioTabLabel(item)}
              </button>
            ))}
          </div>
          <div className="creator-studio__tab-panel" role="tabpanel">
            {tab === "chat" && session ? (
              <LiveWatchChat
                open
                communityId={session.communityId}
                channelId={session.channelId}
                channelName={session.channelName || "live"}
                currentUserId={currentUserId}
                readOnly={session.chatMode === "disabled"}
                onToggle={() => undefined}
                onNotice={onNotice}
              />
            ) : null}

            {tab === "activity" ? (
              <ul className="creator-studio__list">
                {activity.length === 0 ? <li><small>No activity events yet.</small></li> : null}
                {activity.map((event) => (
                  <li key={event.id}>
                    <strong>{activityEventLabel(event.eventType)}</strong>
                    <div>{event.actorDisplayName || "System"}</div>
                    <small>{new Date(event.createdAt).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "viewers" ? (
              <ul className="creator-studio__list">
                <li><strong>{session?.viewerCount ?? 0}</strong> concurrent · <strong>{session?.uniqueViewerCount ?? 0}</strong> unique</li>
                {viewers.length === 0 ? <li><small>No authenticated viewers currently present.</small></li> : null}
                {viewers.map((viewer) => (
                  <li key={viewer.viewerUserId}>
                    <strong>{viewer.displayName || viewer.username || "Viewer"}</strong>
                    <div>@{viewer.username || "unknown"}</div>
                    <small>Joined {new Date(viewer.joinedAt).toLocaleTimeString()}</small>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "moderation" ? (
              <div className="creator-studio__form">
                <p>Moderation uses existing Watch/community RPCs. Owner chat controls are in metadata; moderator force-end is available when permitted.</p>
                {session?.canModerate ? (
                  <button
                    type="button"
                    className="creator-studio__danger"
                    onClick={() => {
                      void liveScreenShareService.moderatorForceEndLiveShare(liveSessionId).then((result) => {
                        if (!result.ok) {
                          onNotice(result.error.message, "error");
                          return;
                        }
                        onNotice("Moderator ended the stream.", "success");
                        void reloadStudio();
                      });
                    }}
                  >
                    Force end stream
                  </button>
                ) : (
                  <small>Moderator-only actions appear when your role allows them.</small>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <section className="creator-studio__controls" aria-label="Stream controls">
        <button
          type="button"
          className={`creator-studio__btn${!voice.muted ? " is-active" : ""}`}
          disabled={!session?.isOwner}
          onClick={() => void voiceService.setMuted(!voice.muted)}
        >
          {voice.muted ? "Unmute mic" : "Mute mic"}
        </button>
        <button
          type="button"
          className={`creator-studio__btn${voice.cameraEnabled ? " is-active" : ""}`}
          disabled={!session?.isOwner || !voice.canUseCamera}
          onClick={() => void voiceService.setCameraEnabled(!voice.cameraEnabled)}
        >
          {voice.cameraEnabled ? "Camera on" : "Camera off"}
        </button>
        <button type="button" className="creator-studio__btn" disabled={!session?.isOwner || sourceBusy} onClick={() => void loadSources()}>
          Refresh sources
        </button>
        <button type="button" className="creator-studio__btn" onClick={() => setPreviewFit((current) => current === "contain" ? "cover" : "contain")}>
          Fit: {previewFit}
        </button>
        <div className="creator-studio__controls-spacer" />
        {session?.isOwner ? (
          <button type="button" className="creator-studio__danger" disabled={ending} onClick={() => setConfirmEnd(true)}>
            End stream
          </button>
        ) : null}
      </section>

      {session?.isOwner ? (
        <section className="creator-studio__diagnostics" aria-label="Broadcast details and diagnostics">
          <div className="creator-studio__form" style={{ flex: "1 1 420px" }}>
            <label>
              Title
              <input value={titleDraft} maxLength={160} onChange={(event) => setTitleDraft(event.target.value)} />
            </label>
            <label>
              Description
              <textarea value={descriptionDraft} maxLength={2000} rows={2} onChange={(event) => setDescriptionDraft(event.target.value)} />
            </label>
            <label>
              Category
              <select value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)}>
                {GO_LIVE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>
            <label>
              Chat mode
              <select value={chatModeDraft} onChange={(event) => setChatModeDraft(event.target.value as CreatorStudioChatMode)}>
                <option value="everyone">Everyone</option>
                <option value="subscribers">Subscribers</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <button type="button" className="creator-studio__btn" disabled={metadataBusy} onClick={() => void saveMetadata()}>
              Save details
            </button>
            {sources.length > 0 ? (
              <ul className="creator-studio__list">
                {sources.slice(0, 8).map((source) => (
                  <li key={source.id}>
                    <button type="button" className="creator-studio__ghost" disabled={sourceBusy} onClick={() => void changeSource(source)}>
                      Switch to {source.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <div>RTT {formatMeasurable(health.rttMs, "ms")}</div>
            <div>Loss {formatMeasurable(health.packetLossPct, "%")}</div>
            <div>Bitrate {formatMeasurable(health.bitrateKbps, "kbps")}</div>
            <div>FPS {formatMeasurable(health.fps, "fps")}</div>
            <div>Resolution {health.width && health.height ? `${health.width}×${health.height}` : "Not measurable"}</div>
            <div>Dropped {formatMeasurable(health.droppedFramesPct, "%")}</div>
            <div>Reconnects {health.reconnectCount}</div>
            <div>Screen {health.screenPublishing ? "publishing" : "not publishing"}</div>
          </div>
        </section>
      ) : null}

      {confirmEnd ? (
        <div className="creator-studio__modal" role="dialog" aria-modal="true" aria-labelledby="creator-studio-end-title">
          <div className="creator-studio__modal-card">
            <h2 id="creator-studio-end-title">End this broadcast?</h2>
            <p>Viewers will see the ended state and Live Now will remove this stream.</p>
            <div className="creator-studio__modal-actions">
              <button type="button" className="creator-studio__ghost" onClick={() => setConfirmEnd(false)}>Keep live</button>
              <button type="button" className="creator-studio__danger" disabled={ending} onClick={() => void endStream()}>End stream</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
