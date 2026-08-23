import type { VoiceServiceSnapshot } from "../services/voiceService";
import { AppIcon } from "./AppIcon";
import { isV1FeatureEnabled } from "../config/v1ReleaseScope";
import { useTranslation } from "../i18n";
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
  const { t } = useTranslation("voice");
  const isLiveConnection =
    (voiceState.status === "connected" || voiceState.status === "reconnecting")
    && Boolean(voiceState.roomContext?.channelId);

  if (!isV1FeatureEnabled("voiceRooms") || !isLiveConnection) {
    return null;
  }

  const communityName = voiceState.roomContext?.communityName ?? t("bar.communityFallback");
  const channelName = voiceState.roomContext?.channelName ?? voiceState.roomName ?? t("bar.channelFallback");
  const statusCopy = voiceState.status === "reconnecting"
    ? t("bar.reconnecting")
    : voiceState.screenSharing
      ? t("bar.screenSharing")
      : t("bar.connected", { community: communityName });

  return (
    <section className="sidebar-voice-connection" aria-label={t("bar.aria")}>
      <button
        type="button"
        className="sidebar-voice-connection-copy"
        aria-label={t("bar.openAria", { channel: channelName })}
        onClick={onOpenVoiceRoom}
      >
        <span className="sidebar-voice-connection-icon" aria-hidden="true">
          <AppIcon name="voice" size="md" />
        </span>
        <div className="sidebar-voice-connection-text">
          <strong>{t("bar.title")}</strong>
          <small title={channelName}>{statusCopy}</small>
        </div>
      </button>

      <div className="sidebar-voice-connection-controls">
        <button
          type="button"
          className="sidebar-voice-control"
          aria-label={voiceState.muted ? t("bar.unmute") : t("bar.mute")}
          aria-pressed={voiceState.muted}
          onClick={onToggleMute}
        >
          <AppIcon name="microphone" size="sm" />
        </button>
        <button
          type="button"
          className="sidebar-voice-control"
          aria-label={voiceState.deafened ? t("bar.undeafen") : t("bar.deafen")}
          aria-pressed={voiceState.deafened}
          onClick={onToggleDeafen}
        >
          <AppIcon name="headphones" size="sm" />
        </button>
        {canUseCamera ? (
          <button
            type="button"
            className="sidebar-voice-control"
            aria-label={voiceState.cameraEnabled ? t("bar.cameraOff") : t("bar.cameraOn")}
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
            aria-label={voiceState.screenSharing ? t("bar.manageScreenShare") : t("bar.shareScreen")}
            aria-pressed={voiceState.screenSharing}
            onClick={onOpenScreenShare}
          >
            <AppIcon name="maximize" size="sm" />
          </button>
        ) : null}
        <button
          type="button"
          className="sidebar-voice-control sidebar-voice-control-disconnect"
          aria-label={t("bar.leave")}
          onClick={onLeaveVoice}
        >
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </section>
  );
}
