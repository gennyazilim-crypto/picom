import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveScreenShareSummary } from "../../types/liveScreenShare";
import { liveScreenShareService } from "../../services/live/liveScreenShareService";
import { voiceService, type VoiceServiceSnapshot } from "../../services/voiceService";
import { clipboardService } from "../../services/clipboardService";
import { LiveWatchAbout, LiveWatchInfo } from "./LiveWatchInfo";
import { LiveWatchChat } from "./LiveWatchChat";
import { LiveWatchEndedState, LiveWatchHeader, LiveWatchReportMenu } from "./LiveWatchEndedState";
import { LiveWatchPlayer } from "./LiveWatchPlayer";
import {
  LIVE_WATCH_REPORT_REASONS,
  formatWatchDuration,
  formatWatchViewerCount,
  isEndedLiveStatus,
  isWatchableLiveStatus,
  loadChatOpenPreference,
  loadWatchVolume,
  mapWatchLoadErrorMessage,
  parseLiveSessionIdParam,
  persistChatOpenPreference,
  persistWatchVolume,
  resolveWatchPlayerPhase,
  selectBroadcasterScreenShare,
  type LiveWatchReportReasonId,
} from "./liveWatchModel";
import { publisherAnalyticsService } from "../../services/live/publisherAnalyticsService";
import { localizationService } from "../../services/localizationService";
import { featureFlagService } from "../../services/featureFlagService";
import "./liveWatch.css";

const VIEWER_HEARTBEAT_MS = 25_000;
const SESSION_REFRESH_MS = 12_000;

export type LiveWatchWorkspaceProps = Readonly<{
  liveSessionId: string;
  currentUserId: string;
  participantName: string;
  followedUserIds?: readonly string[];
  canModerateCommunity?: (communityId: string) => boolean;
  onToggleFollow?: (userId: string) => void | Promise<void>;
  onBackToLiveNow: () => void;
  onOpenCommunity: (communityId: string, channelId?: string) => void;
  onOpenProfile: (userId: string) => void;
  onNotice: (message: string, kind?: "info" | "error" | "success") => void;
}>;

function pipSupported(): boolean {
  return typeof document !== "undefined" && "pictureInPictureEnabled" in document && Boolean((document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled);
}

export function LiveWatchWorkspace({
  liveSessionId,
  currentUserId,
  participantName,
  followedUserIds = [],
  canModerateCommunity,
  onToggleFollow,
  onBackToLiveNow,
  onOpenCommunity,
  onOpenProfile,
  onNotice,
}: LiveWatchWorkspaceProps) {
  const sessionId = parseLiveSessionIdParam(liveSessionId) ?? "";
  const [session, setSession] = useState<LiveScreenShareSummary | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceServiceSnapshot>(() => voiceService.getSnapshot());
  const [chatOpen, setChatOpen] = useState(() => loadChatOpenPreference(true));
  const [volume, setVolume] = useState(() => loadWatchVolume(0.85));
  const [muted, setMuted] = useState(true);
  const [needsUnmuteGesture, setNeedsUnmuteGesture] = useState(true);
  const [objectFit, setObjectFit] = useState<"contain" | "fill">("contain");
  const [now, setNow] = useState(() => Date.now());
  const [followBusy, setFollowBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 1100 : false));
  const [reloadToken, setReloadToken] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const joinGenerationRef = useRef(0);
  const connectedRoomRef = useRef<string | null>(null);
  const joinedViewerRef = useRef(false);
  const publisherAnalyticsSessionRef = useRef<string | null>(null);
  const sessionRef = useRef<LiveScreenShareSummary | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => persistChatOpenPreference(chatOpen), [chatOpen]);
  useEffect(() => {
    if (narrow) setChatOpen(false);
  }, [narrow]);

  useEffect(() => voiceService.subscribe(setVoiceSnapshot), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("PICOM_WATCH_SMOKE") !== "1") return;
    } catch {
      return;
    }
    const target = window as Window & {
      __PICOM_WATCH_SMOKE__?: () => Readonly<{
        canSpeak: boolean;
        canShareScreen: boolean;
        canUseCamera: boolean;
        screenSharing: boolean;
        localScreenShareCount: number;
        status: string;
      }>;
    };
    target.__PICOM_WATCH_SMOKE__ = () => ({
      canSpeak: voiceSnapshot.canSpeak === true,
      canShareScreen: voiceSnapshot.canShareScreen === true,
      canUseCamera: voiceSnapshot.canUseCamera === true,
      screenSharing: voiceSnapshot.screenSharing,
      localScreenShareCount: voiceSnapshot.screenShares.filter((share) => share.isLocal).length,
      status: voiceSnapshot.status,
    });
    return () => {
      delete target.__PICOM_WATCH_SMOKE__;
    };
  }, [voiceSnapshot]);

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setLoadErrorCode("VALIDATION_ERROR");
      setLoadErrorMessage("Invalid live session id.");
      setSession(null);
      return null;
    }
    const result = await liveScreenShareService.getVisibleLiveShareById(sessionId);
    if (!result.ok) {
      setLoadErrorCode(result.error.code);
      setLoadErrorMessage(result.error.message);
      setSession(null);
      return null;
    }
    setLoadErrorCode(null);
    setLoadErrorMessage(null);
    setSession(result.data);
    return result.data;
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    void refreshSession().then((next) => {
      if (!active || !next) return;
    });
    const unsubscribe = liveScreenShareService.subscribeToLiveShareSession(sessionId, () => {
      void refreshSession();
    });
    const poll = window.setInterval(() => {
      void refreshSession();
    }, SESSION_REFRESH_MS);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [refreshSession, sessionId, reloadToken]);

  const watchable = Boolean(session && isWatchableLiveStatus(session.status));
  const watchJoinId = watchable && session ? session.id : null;

  useEffect(() => {
    if (!watchJoinId) return;

    const generation = ++joinGenerationRef.current;
    let heartbeatTimer: number | null = null;
    let cancelled = false;
    let activeSessionId = watchJoinId;
    let joinedThisGeneration = false;
    let connectedThisGeneration = false;

    const isStale = () => cancelled || generation !== joinGenerationRef.current;

    void (async () => {
      // Ensure we have the latest summary before joining LiveKit.
      const latest = sessionRef.current?.id === watchJoinId
        ? sessionRef.current
        : await liveScreenShareService.getVisibleLiveShareById(watchJoinId).then((result) => (result.ok ? result.data : null));
      if (isStale() || !latest || !isWatchableLiveStatus(latest.status)) return;

      activeSessionId = latest.id;
      const activeRoomName = latest.livekitRoomName;

      const joinPresence = await liveScreenShareService.joinAsViewer(latest.id);
      if (isStale()) {
        if (joinPresence.ok) await liveScreenShareService.leaveAsViewer(latest.id);
        return;
      }
      if (!joinPresence.ok) {
        setLoadErrorCode(joinPresence.error.code);
        setLoadErrorMessage(joinPresence.error.message);
        return;
      }
      joinedThisGeneration = true;
      joinedViewerRef.current = true;
      setSession((current) => (current ? { ...current, viewerCount: joinPresence.data } : current));

      // Publisher analytics: only when flag ON and live session is linked to a publisher_stream.
      // Merely opening a Live Now card does not reach this path — room join is required.
      if (featureFlagService.isEnabled("enablePublisherAnalytics")) {
        const resolved = await publisherAnalyticsService.resolveStreamIdForLiveSession(latest.id);
        if (!isStale() && resolved.ok && resolved.data.streamId) {
          const analyticsJoin = await publisherAnalyticsService.joinViewerSession({
            streamId: resolved.data.streamId,
            locale: localizationService.getLanguage(),
            source: "live_now",
          });
          if (!isStale() && analyticsJoin.ok) {
            publisherAnalyticsSessionRef.current = analyticsJoin.data.sessionId;
          }
        }
      }

      if (!(connectedRoomRef.current === activeRoomName && voiceService.getSnapshot().status === "connected")) {
        const join = await voiceService.join({
          communityId: latest.communityId,
          communityName: latest.communityName,
          channelId: latest.channelId,
          channelName: latest.channelName,
          participantName,
          intent: "watch",
          liveSessionId: latest.id,
          roomName: latest.livekitRoomName,
          muted: true,
          cameraEnabled: false,
        });
        if (isStale()) {
          await liveScreenShareService.leaveAsViewer(latest.id);
          joinedViewerRef.current = false;
          joinedThisGeneration = false;
          await voiceService.leave();
          connectedRoomRef.current = null;
          return;
        }
        if (!join.ok) {
          setLoadErrorCode(join.error.code);
          setLoadErrorMessage(join.error.message);
          return;
        }
        connectedThisGeneration = true;
        connectedRoomRef.current = activeRoomName;
        await voiceService.setMuted(true);
        if (voiceService.getSnapshot().cameraEnabled) {
          await voiceService.setCameraEnabled(false);
        }
        if (isStale()) {
          await liveScreenShareService.leaveAsViewer(latest.id);
          joinedViewerRef.current = false;
          await voiceService.leave();
          connectedRoomRef.current = null;
          return;
        }
      }

      if (isStale()) {
        await liveScreenShareService.leaveAsViewer(latest.id);
        joinedViewerRef.current = false;
        if (connectedThisGeneration) {
          await voiceService.leave();
          connectedRoomRef.current = null;
        }
        return;
      }

      heartbeatTimer = window.setInterval(() => {
        void liveScreenShareService.heartbeatViewer(activeSessionId).then((result) => {
          if (result.ok) {
            setSession((current) => (current ? { ...current, viewerCount: result.data } : current));
          }
        });
        const analyticsSessionId = publisherAnalyticsSessionRef.current;
        if (analyticsSessionId) {
          void publisherAnalyticsService.heartbeat(analyticsSessionId);
        }
      }, VIEWER_HEARTBEAT_MS);
    })();

    return () => {
      cancelled = true;
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      void (async () => {
        const analyticsSessionId = publisherAnalyticsSessionRef.current;
        if (analyticsSessionId) {
          publisherAnalyticsSessionRef.current = null;
          await publisherAnalyticsService.leave(analyticsSessionId).catch(() => undefined);
        }
        if (joinedThisGeneration || joinedViewerRef.current) {
          await liveScreenShareService.leaveAsViewer(activeSessionId);
          joinedViewerRef.current = false;
        }
        if (connectedThisGeneration || connectedRoomRef.current) {
          await voiceService.leave();
          connectedRoomRef.current = null;
        }
        voiceService.setFocusedScreenShare(null);
      })();
    };
  }, [watchJoinId, participantName]);

  useEffect(() => {
    if (!session || !isEndedLiveStatus(session.status)) return;
    void (async () => {
      const analyticsSessionId = publisherAnalyticsSessionRef.current;
      if (analyticsSessionId) {
        publisherAnalyticsSessionRef.current = null;
        await publisherAnalyticsService.leave(analyticsSessionId).catch(() => undefined);
      }
      if (joinedViewerRef.current) {
        await liveScreenShareService.leaveAsViewer(session.id);
        joinedViewerRef.current = false;
      }
      if (connectedRoomRef.current) {
        await voiceService.leave();
        connectedRoomRef.current = null;
      }
      voiceService.setFocusedScreenShare(null);
    })();
  }, [session?.id, session?.status]);

  const share = useMemo(
    () => (session ? selectBroadcasterScreenShare(voiceSnapshot.screenShares, session.broadcasterUserId) : null),
    [session, voiceSnapshot.screenShares],
  );

  useEffect(() => {
    if (share) voiceService.setFocusedScreenShare(share.id);
    return () => {
      voiceService.setFocusedScreenShare(null);
    };
  }, [share?.id]);

  const phase = resolveWatchPlayerPhase({
    loadErrorCode,
    session,
    voiceStatus: voiceSnapshot.status,
    hasTrack: Boolean(share),
    sessionEndedLocally: Boolean(session && isEndedLiveStatus(session.status)),
  });

  const durationLabel = session ? formatWatchDuration(session.startedAt, now) : "—";
  const viewerLabel = session ? formatWatchViewerCount(session.viewerCount) : null;
  const sessionStatusLabel =
    phase === "reconnecting" ? "RECONNECTING" : phase === "ended" ? "ENDED" : phase === "live" ? "LIVE" : "LIVE";

  const qualityLabel = useMemo(() => {
    const quality = voiceSnapshot.participants.find((participant) => participant.identity === session?.broadcasterUserId)?.connectionQuality;
    if (!quality || quality === "unknown") return null;
    return quality.toUpperCase();
  }, [voiceSnapshot.participants, session?.broadcasterUserId]);

  const isFollowing = Boolean(session && followedUserIds.includes(session.broadcasterUserId));
  const isSelf = session?.broadcasterUserId === currentUserId;

  const toggleChat = useCallback(() => setChatOpen((value) => !value), []);

  const onVolumeChange = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolume(clamped);
    persistWatchVolume(clamped);
    setMuted(clamped === 0);
    if (clamped > 0) setNeedsUnmuteGesture(false);
    voiceService.setMasterOutputVolume(clamped);
  }, []);

  const onToggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      if (wasMuted || volume === 0) {
        const next = volume > 0 ? volume : 0.85;
        setVolume(next);
        persistWatchVolume(next);
        setNeedsUnmuteGesture(false);
        voiceService.setMasterOutputVolume(next);
        return false;
      }
      return true;
    });
  }, [volume]);

  const onUnmuteGesture = useCallback(() => {
    setMuted(false);
    setNeedsUnmuteGesture(false);
    if (volume === 0) {
      setVolume(0.85);
      persistWatchVolume(0.85);
      voiceService.setMasterOutputVolume(0.85);
    }
  }, [volume]);

  const onToggleFullscreen = useCallback(async () => {
    const node = playerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      onNotice("Fullscreen is not available in this window.", "info");
    }
  }, [onNotice]);

  const onTogglePip = useCallback(async () => {
    const video = playerRef.current?.querySelector("video");
    if (!video || !pipSupported()) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      onNotice("Picture-in-picture is not available.", "info");
    }
  }, [onNotice]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        if (narrow && chatOpen) {
          setChatOpen(false);
          return;
        }
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey) return;
      if (event.key.toLowerCase() === "c") toggleChat();
      if (event.key.toLowerCase() === "m") onToggleMute();
      if (event.key.toLowerCase() === "f") void onToggleFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [narrow, chatOpen, toggleChat, onToggleMute, onToggleFullscreen]);

  const leaveWatch = useCallback(() => {
    onBackToLiveNow();
  }, [onBackToLiveNow]);

  const handleFollow = async () => {
    if (!session || !onToggleFollow || followBusy || isSelf) return;
    setFollowBusy(true);
    try {
      await onToggleFollow(session.broadcasterUserId);
    } finally {
      setFollowBusy(false);
    }
  };

  const handleShare = async () => {
    const path = `/live-now/${sessionId}`;
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    const result = await clipboardService.copyText(url);
    onNotice(result.ok ? "Stream link copied." : "Could not copy the stream link.", result.ok ? "success" : "error");
  };

  const handleReport = async (reasonId: string) => {
    if (!session || reportBusy) return;
    const reason = LIVE_WATCH_REPORT_REASONS.find((item) => item.id === (reasonId as LiveWatchReportReasonId));
    if (!reason) return;
    setReportBusy(true);
    const result = await liveScreenShareService.reportLiveShare(session.id, reason.payload);
    setReportBusy(false);
    setReportOpen(false);
    onNotice(result.ok ? "Report sent. Thanks for helping keep Picom safe." : result.error.message, result.ok ? "success" : "error");
  };

  const canModerateLive = Boolean(session?.communityId && canModerateCommunity?.(session.communityId));

  const handleForceEnd = async () => {
    if (!session || !canModerateLive) return;
    const result = await liveScreenShareService.moderatorForceEndLiveShare(session.id, "Moderator ended the live stream from Watch");
    onNotice(result.ok ? "Live stream ended by moderation." : result.error.message, result.ok ? "success" : "error");
    if (result.ok) setSession(result.data);
  };

  const handleRemoveBroadcaster = async () => {
    if (!session || !canModerateLive) return;
    const result = await liveScreenShareService.moderatorRemoveLiveBroadcaster(session.id, "Moderator removed the broadcaster from Watch");
    onNotice(result.ok ? "Broadcaster removed from the live voice session." : result.error.message, result.ok ? "success" : "error");
    if (result.ok) setSession(result.data);
  };

  const handleOpenModerationCase = async () => {
    if (!session || !canModerateLive) return;
    const result = await liveScreenShareService.moderatorOpenLiveModerationCase(session.id, "Moderator opened a live moderation case from Watch");
    onNotice(result.ok ? "Moderation case opened." : result.error.message, result.ok ? "success" : "error");
  };

  if (phase === "ended" && session) {
    return (
      <div className="live-watch-workspace">
        <LiveWatchHeader title={session.title || "Live"} onBack={leaveWatch} />
        <LiveWatchEndedState
          session={session}
          onBackToLiveNow={leaveWatch}
          onOpenCommunity={() => onOpenCommunity(session.communityId, session.channelId)}
        />
      </div>
    );
  }

  return (
    <div className={`live-watch-workspace ${chatOpen ? "has-chat" : "chat-collapsed"} ${narrow ? "is-narrow" : ""}`}>
      <LiveWatchHeader title={session?.title || "Live stream"} onBack={leaveWatch} />

      <div className="live-watch-workspace__stage">
        <div className="live-watch-workspace__main">
          <LiveWatchPlayer
            phase={phase}
            share={share}
            title={session?.title || "Live stream"}
            durationLabel={durationLabel}
            viewerLabel={viewerLabel}
            sessionStatusLabel={sessionStatusLabel}
            volume={volume}
            muted={muted}
            needsUnmuteGesture={needsUnmuteGesture}
            objectFit={objectFit}
            chatOpen={chatOpen}
            pipSupported={pipSupported()}
            qualityLabel={qualityLabel}
            errorMessage={mapWatchLoadErrorMessage(loadErrorCode, loadErrorMessage ?? "")}
            onToggleMute={onToggleMute}
            onVolumeChange={onVolumeChange}
            onUnmuteGesture={onUnmuteGesture}
            onToggleObjectFit={() => setObjectFit((value) => (value === "contain" ? "fill" : "contain"))}
            onToggleChat={toggleChat}
            onToggleFullscreen={() => void onToggleFullscreen()}
            onTogglePip={() => void onTogglePip()}
            onLeave={leaveWatch}
            onReport={() => setReportOpen(true)}
            onRetry={() => setReloadToken((value) => value + 1)}
            playerRef={playerRef}
          />

          {session && phase !== "permission_denied" && phase !== "unavailable" ? (
            <>
              <LiveWatchInfo
                session={session}
                durationLabel={durationLabel}
                isFollowing={isFollowing}
                followBusy={followBusy}
                isSelf={isSelf}
                canModerateLive={canModerateLive}
                onToggleFollow={() => void handleFollow()}
                onOpenCommunity={() => onOpenCommunity(session.communityId, session.channelId)}
                onOpenProfile={() => onOpenProfile(session.broadcasterUserId)}
                onShare={() => void handleShare()}
                onReport={() => setReportOpen(true)}
                onForceEnd={canModerateLive ? () => void handleForceEnd() : undefined}
                onRemoveBroadcaster={canModerateLive ? () => void handleRemoveBroadcaster() : undefined}
                onOpenModerationCase={canModerateLive ? () => void handleOpenModerationCase() : undefined}
              />
              <LiveWatchAbout
                session={session}
                onOpenCommunity={() => onOpenCommunity(session.communityId, session.channelId)}
                onOpenProfile={() => onOpenProfile(session.broadcasterUserId)}
              />
            </>
          ) : null}
        </div>

        {session && phase !== "permission_denied" && phase !== "unavailable" ? (
          <LiveWatchChat
            open={chatOpen}
            communityId={session.communityId}
            channelId={session.channelId}
            channelName={session.channelName}
            currentUserId={currentUserId}
            readOnly={phase === "ended"}
            onToggle={toggleChat}
            onNotice={onNotice}
          />
        ) : null}
      </div>

      {!chatOpen ? (
        <button type="button" className="live-watch-chat-fab" onClick={toggleChat} aria-label="Show chat">
          <span>Chat</span>
        </button>
      ) : null}

      <LiveWatchReportMenu
        open={reportOpen}
        reasons={LIVE_WATCH_REPORT_REASONS}
        busy={reportBusy}
        onClose={() => setReportOpen(false)}
        onSelect={(id) => void handleReport(id)}
      />
    </div>
  );
}
