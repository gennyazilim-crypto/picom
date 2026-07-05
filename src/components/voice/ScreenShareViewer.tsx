import { useEffect, useRef } from "react";
import { AppIcon } from "../AppIcon";
import type { VoiceScreenShare } from "../../services/voiceService";

type ScreenShareViewerProps = {
  shares: VoiceScreenShare[];
};

type ScreenShareVideoProps = {
  share: VoiceScreenShare;
};

function ScreenShareVideo({ share }: ScreenShareVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.srcObject = share.stream;

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [share.stream]);

  return (
    <article className="screen-share-viewer-card">
      <div className="screen-share-video-frame">
        <video ref={videoRef} autoPlay playsInline muted={share.isLocal} />
      </div>
      <footer>
        <span>
          <strong>{share.participantName}</strong>
          <small>{share.isLocal ? "Your screen" : "Screen sharing"}</small>
        </span>
      </footer>
    </article>
  );
}

export function ScreenShareViewer({ shares }: ScreenShareViewerProps) {
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
        <ScreenShareVideo key={share.id} share={share} />
      ))}
    </section>
  );
}
