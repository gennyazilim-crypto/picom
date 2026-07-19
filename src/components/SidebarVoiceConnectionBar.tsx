import type { VoiceServiceSnapshot } from "../services/voiceService";
import { AppIcon } from "./AppIcon";
import { isV1FeatureEnabled } from "../config/v1ReleaseScope";
import "./SidebarVoiceConnectionBar.css";

type SidebarVoiceConnectionBarProps = {
  voiceState: VoiceServiceSnapshot;
  onOpenVoiceRoom: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onOpenScreenShare: () => void;
  onLeaveVoice: () => void;
  canUseCamera?: boolean;
  canShareScreen?: boolean;
};

export function SidebarVoiceConnectionBar({
  voiceState,
  onOpenVoiceRoom,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onOpenScreenShare,
  onLeaveVoice,
  canUseCamera = true,
  canShareScreen = true,
}: SidebarVoiceConnectionBarProps) {
  const isLiveConnection =
    (voiceState.status === "connected" || voiceState.status === "reconnecting")
    && Boolean(voiceState.roomContext?.channelId);

  if (!isV1FeatureEnabled("voiceRooms") || !isLiveConnection) {
    return null;
  }

  const communityName = voiceState.roomContext?.communityName ?? "Picom community";
  const channelName = voiceState.roomContext?.channelName ?? voiceState.roomName ?? "Voice room";
  const statusCopy = voiceState.status === "reconnecting"
    ? "Bağlantı yenileniyor…"
    : voiceState.screenSharing
      ? "Ekran paylaşımı aktif"
      : `Ses bağlantısı · ${communityName}`;

  return (
    <section className="sidebar-voice-connection" aria-label="Active voice connection">
      <button
        type="button"
        className="sidebar-voice-connection-copy"
        aria-label={`${channelName} sesli odasına git`}
        onClick={onOpenVoiceRoom}
      >
        <span className="sidebar-voice-connection-icon" aria-hidden="true">
          <AppIcon name="voice" size="md" />
        </span>
        <div className="sidebar-voice-connection-text">
          <strong>Sesli oda</strong>
          <small title={channelName}>{statusCopy}</small>
        </div>
      </button>

      <div className="sidebar-voice-connection-controls">
        <button
          type="button"
          className="sidebar-voice-control"
          aria-label={voiceState.muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
          aria-pressed={voiceState.muted}
          onClick={onToggleMute}
        >
          <AppIcon name="microphone" size="sm" />
        </button>
        <button
          type="button"
          className="sidebar-voice-control"
          aria-label={voiceState.deafened ? "Sesi aç" : "Sesi kapat"}
          aria-pressed={voiceState.deafened}
          onClick={onToggleDeafen}
        >
          <AppIcon name="headphones" size="sm" />
        </button>
        {canUseCamera ? (
          <button
            type="button"
            className="sidebar-voice-control"
            aria-label={voiceState.cameraEnabled ? "Kamerayı kapat" : "Kamerayı aç"}
            aria-pressed={Boolean(voiceState.cameraEnabled)}
            onClick={onToggleCamera}
          >
            <AppIcon name="eye" size="sm" />
          </button>
        ) : null}
        {canShareScreen ? (
          <button
            type="button"
            className="sidebar-voice-control"
            aria-label={voiceState.screenSharing ? "Ekran paylaşımını yönet" : "Ekran paylaş"}
            aria-pressed={voiceState.screenSharing}
            onClick={onOpenScreenShare}
          >
            <AppIcon name="maximize" size="sm" />
          </button>
        ) : null}
        <button
          type="button"
          className="sidebar-voice-control sidebar-voice-control-disconnect"
          aria-label="Sesli odadan ayrıl"
          onClick={onLeaveVoice}
        >
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </section>
  );
}
