import { useEffect, useRef, type RefObject } from "react";
import type { VoiceScreenShare } from "../../services/voiceService";
import type { LiveWatchPlayerPhase } from "./liveWatchModel";
import { AppIcon } from "../AppIcon";
import { LiveWatchControls } from "./LiveWatchControls";

export type LiveWatchPlayerProps = Readonly<{
  phase: LiveWatchPlayerPhase;
  share: VoiceScreenShare | null;
  title: string;
  durationLabel: string;
  viewerLabel: string | null;
  sessionStatusLabel: string;
  volume: number;
  muted: boolean;
  needsUnmuteGesture: boolean;
  objectFit: "contain" | "fill";
  chatOpen: boolean;
  pipSupported: boolean;
  qualityLabel: string | null;
  errorMessage: string | null;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onUnmuteGesture: () => void;
  onToggleObjectFit: () => void;
  onToggleChat: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onLeave: () => void;
  onReport: () => void;
  onRetry?: () => void;
  playerRef: RefObject<HTMLDivElement | null>;
}>;

export function LiveWatchPlayer({
  phase,
  share,
  title,
  durationLabel,
  viewerLabel,
  sessionStatusLabel,
  volume,
  muted,
  needsUnmuteGesture,
  objectFit,
  chatOpen,
  pipSupported,
  qualityLabel,
  errorMessage,
  onToggleMute,
  onVolumeChange,
  onUnmuteGesture,
  onToggleObjectFit,
  onToggleChat,
  onToggleFullscreen,
  onTogglePip,
  onLeave,
  onReport,
  onRetry,
  playerRef,
}: LiveWatchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachedStreamIdRef = useRef<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!share?.stream || phase === "ended" || phase === "permission_denied" || phase === "unavailable") {
      if (video.srcObject) video.srcObject = null;
      attachedStreamIdRef.current = null;
      return;
    }

    const streamId = share.id;
    if (attachedStreamIdRef.current !== streamId || video.srcObject !== share.stream) {
      video.srcObject = share.stream;
      attachedStreamIdRef.current = streamId;
    }

    video.volume = muted ? 0 : volume;
    video.muted = muted;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        /* autoplay rejection handled via unmute CTA */
      });
    }

    return () => {
      if (video.srcObject === share.stream) {
        video.srcObject = null;
      }
      if (attachedStreamIdRef.current === streamId) {
        attachedStreamIdRef.current = null;
      }
    };
  }, [share, phase, muted, volume]);

  const showVideo = Boolean(share) && (phase === "live" || phase === "reconnecting" || phase === "track_unavailable");

  return (
    <div className="live-watch-player" ref={playerRef} data-phase={phase}>
      <div className="live-watch-player__frame" data-fit={objectFit}>
        {showVideo ? (
          <video
            ref={videoRef}
            className="live-watch-player__video"
            playsInline
            autoPlay
            muted={muted}
            aria-label={`${title} live screen share`}
          />
        ) : (
          <div className="live-watch-player__placeholder" aria-hidden="true">
            <AppIcon name="live" size="xl" />
          </div>
        )}

        <div className="live-watch-player__chrome" aria-hidden={false}>
          <div className="live-watch-player__badges">
            <span className="live-watch-player__live-badge" aria-label={sessionStatusLabel}>
              <span className="live-watch-player__live-dot" aria-hidden="true" />
              {sessionStatusLabel}
            </span>
            {viewerLabel ? (
              <span className="live-watch-player__meta-badge" aria-label={`${viewerLabel} viewers`}>
                <AppIcon name="eye" size="xs" />
                {viewerLabel}
              </span>
            ) : null}
            <span className="live-watch-player__meta-badge">{durationLabel}</span>
            {qualityLabel ? (
              <span className="live-watch-player__meta-badge live-watch-player__meta-badge--quality">{qualityLabel}</span>
            ) : null}
          </div>
        </div>

        {phase === "loading" || phase === "connecting" ? (
          <div className="live-watch-player__overlay" role="status" aria-live="polite">
            <div className="live-watch-player__spinner" aria-hidden="true" />
            <strong>Connecting…</strong>
            <span>Joining the live room securely</span>
          </div>
        ) : null}

        {phase === "reconnecting" ? (
          <div className="live-watch-player__overlay live-watch-player__overlay--reconnect" role="alert" aria-live="assertive">
            <div className="live-watch-player__spinner" aria-hidden="true" />
            <strong>Yayıncı yeniden bağlanıyor…</strong>
            <span>The stream will continue in this session when the broadcaster returns.</span>
          </div>
        ) : null}

        {phase === "track_unavailable" ? (
          <div className="live-watch-player__overlay live-watch-player__overlay--waiting" role="status" aria-live="polite">
            <div className="live-watch-player__waiting-mark" aria-hidden="true">
              <AppIcon name="live" size="lg" />
            </div>
            <strong>Waiting for screen share</strong>
            <span>Connected to the room. The broadcaster has not published a screen share yet.</span>
          </div>
        ) : null}

        {phase === "permission_denied" || phase === "unavailable" || phase === "error" ? (
          <div className="live-watch-player__overlay live-watch-player__overlay--error" role="alert" aria-live="assertive">
            <AppIcon name="lock" size="lg" />
            <strong>{phase === "permission_denied" ? "Access denied" : "Stream unavailable"}</strong>
            <span>{errorMessage ?? "This live stream cannot be opened."}</span>
            <div className="live-watch-player__overlay-actions">
              {onRetry && phase === "error" ? (
                <button type="button" className="live-watch-btn live-watch-btn--primary" onClick={onRetry}>
                  Retry
                </button>
              ) : null}
              <button type="button" className="live-watch-btn" onClick={onLeave}>
                Back to Live Now
              </button>
            </div>
          </div>
        ) : null}

        {needsUnmuteGesture && phase === "live" ? (
          <button type="button" className="live-watch-player__unmute-cta" onClick={onUnmuteGesture}>
            <AppIcon name="volume" size="sm" />
            Yayın sesini aç
          </button>
        ) : null}

        {phase === "live" || phase === "reconnecting" || phase === "track_unavailable" ? (
          <LiveWatchControls
            muted={muted}
            volume={volume}
            objectFit={objectFit}
            chatOpen={chatOpen}
            pipSupported={pipSupported}
            onToggleMute={onToggleMute}
            onVolumeChange={onVolumeChange}
            onToggleObjectFit={onToggleObjectFit}
            onToggleChat={onToggleChat}
            onToggleFullscreen={onToggleFullscreen}
            onTogglePip={onTogglePip}
            onLeave={onLeave}
            onReport={onReport}
          />
        ) : null}
      </div>
    </div>
  );
}
