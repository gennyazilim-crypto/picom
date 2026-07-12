import { useEffect, useRef } from "react";
import { AppIcon } from "../AppIcon";
import type { VoiceScreenShare } from "../../services/voiceService";

type ScreenShareViewerProps = {
  shares: VoiceScreenShare[];
  onStop?: () => void;
};

type ScreenShareVideoProps = {
  share: VoiceScreenShare;
  onStop?: () => void;
};

function ScreenShareVideo({ share, onStop }: ScreenShareVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasRenderableVideo = share.stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (!videoRef.current || !hasRenderableVideo) return;

    videoRef.current.srcObject = share.stream;

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [hasRenderableVideo, share.stream]);

  return (
    <article className="screen-share-viewer-card">
      <div className="screen-share-video-frame">
        {hasRenderableVideo ? <video ref={videoRef} autoPlay playsInline muted={share.isLocal} /> : <div className="screen-share-video-pending" role="status"><AppIcon name="image" size="lg" /><span>Loading {share.participantName}'s shared screen...</span></div>}
      </div>
      <footer>
        <span>
          <strong>{share.participantName}</strong>
          <small>{share.sourceLabel ?? (share.isLocal ? "Your screen" : "Screen sharing")}</small>
        </span>
        {share.isLocal && onStop ? <button type="button" className="screen-share-stop-button" onClick={onStop} aria-label="Stop sharing your screen"><AppIcon name="close" size="sm" /> Stop sharing</button> : null}
      </footer>
    </article>
  );
}

export function ScreenShareViewer({ shares, onStop }: ScreenShareViewerProps) {
  if (!shares.length) {
    return (
      <section className="screen-share-viewer is-empty" aria-label="Screen share viewer">
        <span className="screen-share-viewer-empty-icon">
          <AppIcon name="image" size="lg" />
        </span>
        <div>
          <strong>No active screen share</strong>
          <small>Choose a source and start sharing after joining the room.</small>
        </div>
      </section>
    );
  }

  return (
    <section className="screen-share-viewer" aria-label="Active screen shares">
      {shares.map((share) => (
        <ScreenShareVideo key={share.id} share={share} onStop={onStop} />
      ))}
    </section>
  );
}
