import type { Channel, Community, Member } from "../types/community";
import type { VoiceParticipant, VoiceServiceSnapshot } from "../services/voiceService";
import { AppIcon } from "./AppIcon";
import { VoiceDevicePanel } from "./VoiceDevicePanel";
import { MemberAvatar } from "./MemberAvatar";
import { ScreenShareControls } from "./voice/ScreenShareControls";
import { ScreenSharePreview } from "./voice/ScreenSharePreview";
import type { ScreenShareQualityPresetId } from "../utils/screenShareQuality";
import { NoiseShieldQuickControl } from "./voice/NoiseShieldControl";

type VoiceRoomViewProps = {
  community: Community;
  channel: Channel;
  snapshot: VoiceServiceSnapshot;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  canSpeak?: boolean;
  canShareScreen?: boolean;
  canMuteMembers?: boolean;
  canRemoveFromVoice?: boolean;
  onModerateParticipant?: (participant: VoiceParticipant, action: "mute" | "remove") => void;
  onStartScreenShare?: (sourceId: string, preset: ScreenShareQualityPresetId, sourceLabel?: string) => void;
  onStopScreenShare?: () => void;
};

const statusLabels: Record<VoiceServiceSnapshot["status"], string> = {
  idle: "Ready",
  requesting_token: "Requesting token",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  permission_denied: "Permission needed",
  token_error: "Token error",
  error: "Connection error",
  disconnected: "Disconnected",
};

function findMemberForParticipant(community: Community, participant: VoiceParticipant): Member | undefined {
  return community.members.find((member) => member.userId === participant.identity || member.displayName === participant.name);
}

function getParticipantStatus(participant: VoiceParticipant): string {
  if (!participant.isMicrophoneEnabled) {
    return participant.isLocal ? "You - muted" : "Muted";
  }

  if (participant.isSpeaking) {
    return "Speaking";
  }

  return participant.isLocal ? "You" : "Connected";
}

export function VoiceConnectionStatus({ status }: { status: VoiceServiceSnapshot["status"] }) {
  return (
    <span className={`voice-status-pill ${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}

export function SpeakingIndicator({ participant }: { participant: VoiceParticipant }) {
  return participant.isSpeaking ? <AppIcon name="voice" size="xs" /> : null;
}

export function VoiceControls({
  connected,
  joining,
  disconnected,
  muted,
  deafened,
  canSpeak,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
}: {
  connected: boolean;
  joining: boolean;
  disconnected: boolean;
  muted: boolean;
  deafened: boolean;
  canSpeak: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
}) {
  return (
    <div className="voice-control-row">
      <button className="voice-primary-action" type="button" onClick={connected ? onLeave : onJoin} disabled={joining}>
        <AppIcon name={connected ? "close" : "voice"} size="sm" />
        {connected ? "Leave room" : joining ? "Joining..." : disconnected ? "Reconnect" : "Join room"}
      </button>
      <button type="button" onClick={onToggleMute} disabled={!connected || !canSpeak} aria-pressed={muted}>
        <AppIcon name="microphone" size="sm" />
        {muted ? "Unmute" : "Mute"}
      </button>
      <button type="button" onClick={onToggleDeafen} disabled={!connected} aria-pressed={deafened}>
        <AppIcon name="headphones" size="sm" />
        {deafened ? "Undeafen" : "Deafen"}
      </button>
    </div>
  );
}

export function VoiceParticipantList({ community, participants, canMuteMembers = false, canRemoveFromVoice = false, onModerateParticipant }: { community: Community; participants: VoiceParticipant[]; canMuteMembers?: boolean; canRemoveFromVoice?: boolean; onModerateParticipant?: (participant: VoiceParticipant, action: "mute" | "remove") => void }) {
  if (!participants.length) {
    return (
      <div className="voice-empty-panel">
        <strong>No one is connected yet</strong>
        <span>Join the room to start a LiveKit voice session.</span>
      </div>
    );
  }

  return (
    <div className="voice-participant-list">
      {participants.map((participant) => {
        const member = findMemberForParticipant(community, participant);
        const rowState = [
          "voice-participant-row",
          participant.isSpeaking ? "is-speaking" : "",
          !participant.isMicrophoneEnabled ? "is-muted" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div className={rowState} key={participant.identity}>
            <MemberAvatar member={member} label={participant.name} size={38} />
            <span>
              <strong>{member?.displayName ?? participant.name}</strong>
              <small>
                {getParticipantStatus(participant)}
                <SpeakingIndicator participant={participant} />
              </small>
            </span>
            {!participant.isLocal && community.ownerId !== participant.identity && (canMuteMembers || canRemoveFromVoice) ? <div className="voice-participant-actions">
              {canMuteMembers ? <button type="button" aria-label={`Mute ${member?.displayName ?? participant.name}`} onClick={() => onModerateParticipant?.(participant, "mute")}><AppIcon name="microphone" size="xs" /></button> : null}
              {canRemoveFromVoice ? <button type="button" className="danger" aria-label={`Remove ${member?.displayName ?? participant.name} from voice`} onClick={() => onModerateParticipant?.(participant, "remove")}><AppIcon name="close" size="xs" /></button> : null}
            </div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function VoiceRoomView({
  community,
  channel,
  snapshot,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  canSpeak = false,
  canShareScreen = false,
  canMuteMembers = false,
  canRemoveFromVoice = false,
  onModerateParticipant,
  onStartScreenShare,
  onStopScreenShare,
}: VoiceRoomViewProps) {
  const connected = snapshot.status === "connected" || snapshot.status === "reconnecting";
  const joining = snapshot.status === "requesting_token" || snapshot.status === "connecting";
  const participantCount = snapshot.participants.length;

  return (
    <section className="voice-room-view" aria-label={`${channel.name} voice room`}>
      <div className="voice-room-hero">
        <span className="voice-room-orb">
          <AppIcon name="voice" size="xl" />
        </span>
        <div className="voice-room-heading">
          <span className="eyebrow">Voice room</span>
          <h2>{channel.name}</h2>
          <p>{channel.topic || `${community.name} members can join this room when LiveKit is configured.`}</p>
        </div>
        <VoiceConnectionStatus status={snapshot.status} />
      </div>

      <ScreenSharePreview shares={snapshot.screenShares} onStop={onStopScreenShare} />

      <div className="voice-room-grid">
        <article className="voice-room-card">
          <header>
            <div>
              <span className="eyebrow">Controls</span>
              <h3>Room controls</h3>
            </div>
            <small>{participantCount} participant{participantCount === 1 ? "" : "s"}</small>
          </header>

          <VoiceControls
            connected={connected}
            joining={joining}
            disconnected={snapshot.status === "disconnected"}
            muted={snapshot.muted}
            deafened={snapshot.deafened}
            canSpeak={canSpeak}
            onJoin={onJoin}
            onLeave={onLeave}
            onToggleMute={onToggleMute}
            onToggleDeafen={onToggleDeafen}
          />
          <NoiseShieldQuickControl connected={connected && canSpeak} />

          {snapshot.error ? <p className="voice-room-error">{snapshot.error}</p> : null}
          <p className="voice-room-note">LiveKit tokens are requested through the Supabase Edge Function. Secrets never enter the renderer.</p>

          <VoiceDevicePanel />

          <ScreenShareControls
            connected={connected && canShareScreen}
            screenSharing={snapshot.screenSharing}
            onStart={onStartScreenShare}
            onStop={onStopScreenShare}
          />
        </article>

        <article className="voice-room-card">
          <header>
            <div>
              <span className="eyebrow">Participants</span>
              <h3>Connected users</h3>
            </div>
            <AppIcon name="users" size="lg" />
          </header>

          <VoiceParticipantList community={community} participants={snapshot.participants} canMuteMembers={canMuteMembers} canRemoveFromVoice={canRemoveFromVoice} onModerateParticipant={onModerateParticipant} />
        </article>
      </div>
    </section>
  );
}
