import type { VoiceServiceSnapshot } from "../../services/voiceService";
import { isV1FeatureEnabled } from "../../config/v1ReleaseScope";
import { AppIcon } from "../AppIcon";
import { NoiseShieldCompactStatus } from "./NoiseShieldControl";

export type ConnectedVoiceCardProps = Readonly<{
  voiceState: VoiceServiceSnapshot;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenVoiceRoom: () => void;
  onOpenScreenShare?: () => void;
  className?: string;
}>;

export function ConnectedVoiceCard({
  voiceState,
  onToggleMute,
  onToggleDeafen,
  onLeaveVoice,
  onOpenVoiceRoom,
  onOpenScreenShare,
  className,
}: ConnectedVoiceCardProps) {
  const voiceVisible = isV1FeatureEnabled("voiceRooms");
  const screenShareVisible = isV1FeatureEnabled("screenShare") && Boolean(onOpenScreenShare);
  if (!voiceVisible || (voiceState.status !== "connected" && voiceState.status !== "reconnecting")) return null;

  return (
    <section className={`voice-mini-card${className ? ` ${className}` : ""}`} aria-label="Current voice room controls">
      <header>
        <span className="voice-mini-icon" aria-hidden="true">
          <AppIcon name="voice" size="lg" />
        </span>
        <div>
          <p className="eyebrow">Connected Voice</p>
          <strong>{voiceState.roomContext?.channelName ?? voiceState.roomName ?? "Voice room"}</strong>
          <small>{voiceState.screenSharing ? "Screen sharing active" : voiceState.status === "reconnecting" ? "Restoring connection..." : "LiveKit connected"}</small>
        </div>
      </header>
      <div className="voice-mini-meta">
        <span>
          <i />
          {voiceState.status === "reconnecting" ? "Reconnecting" : "Live"}
        </span>
        <span>{voiceState.participants.length} listening</span>
        <NoiseShieldCompactStatus interactive />
      </div>
      <div className="voice-mini-controls">
        <button type="button" aria-label={voiceState.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={voiceState.muted} onClick={onToggleMute}>
          <AppIcon name="microphone" size="sm" />
        </button>
        <button type="button" aria-label={voiceState.deafened ? "Undeafen audio" : "Deafen audio"} aria-pressed={voiceState.deafened} onClick={onToggleDeafen}>
          <AppIcon name="headphones" size="sm" />
        </button>
        <button type="button" aria-label="Return to connected voice room" onClick={onOpenVoiceRoom}>
          <AppIcon name="voice" size="sm" />
        </button>
        {screenShareVisible ? (
          <button type="button" aria-label={voiceState.screenSharing ? "Open active screen share controls" : "Open screen share controls"} aria-pressed={voiceState.screenSharing} onClick={onOpenScreenShare}>
            <AppIcon name="image" size="sm" />
          </button>
        ) : null}
        <button type="button" className="voice-mini-leave" aria-label="Leave voice room" onClick={onLeaveVoice}>
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </section>
  );
}
