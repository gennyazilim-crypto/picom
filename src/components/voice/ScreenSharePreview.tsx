import type { VoiceScreenShare } from "../../services/voiceService";
import { ScreenShareViewer } from "./ScreenShareViewer";
import "./ScreenSharePreview.css";

type ScreenSharePreviewProps = {
  shares: VoiceScreenShare[];
  focusedShareId?: string | null;
  onSelectShare?: (shareId: string) => void;
  onStop?: () => void;
};

export function ScreenSharePreview({ shares, focusedShareId, onSelectShare, onStop }: ScreenSharePreviewProps) {
  const focusedShare = shares.find((share) => share.id === focusedShareId) ?? shares[0] ?? null;

  return (
    <section className="screen-share-preview" aria-label="Voice room screen shares">
      {shares.length > 1 ? (
        <div className="screen-share-switcher" role="tablist" aria-label="Choose active screen share">
          {shares.map((share) => (
            <button
              key={share.id}
              type="button"
              role="tab"
              aria-selected={focusedShare?.id === share.id}
              className={focusedShare?.id === share.id ? "is-active" : ""}
              onClick={() => onSelectShare?.(share.id)}
            >
              <span>{share.participantName}</span>
              <small>{share.isLocal ? "You" : share.stream.getVideoTracks().length ? "Live" : "Select to load"}</small>
            </button>
          ))}
        </div>
      ) : null}
      <ScreenShareViewer shares={focusedShare ? [focusedShare] : []} onStop={onStop} />
    </section>
  );
}
