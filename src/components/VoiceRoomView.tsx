import type { Channel, Community, Member } from "../types/community";
import type { VoiceParticipant, VoiceServiceSnapshot } from "../services/voiceService";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";
import { ScreenShareControls } from "./voice/ScreenShareControls";
import { ScreenSharePreview } from "./voice/ScreenSharePreview";
import type { ScreenShareQualityPresetId } from "../utils/screenShareQuality";

type VoiceRoomViewProps = {
  community: Community;
  channel: Channel;
  snapshot: VoiceServiceSnapshot;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onStartScreenShare?: (sourceId: string, preset: ScreenShareQualityPresetId) => void;
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
      <button type="button" onClick={onToggleMute} disabled={!connected} aria-pressed={muted}>
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

export function VoiceParticipantList({ community, participants }: { community: Community; participants: VoiceParticipant[] }) {
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

      <ScreenSharePreview shares={snapshot.screenShares} />

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
            onJoin={onJoin}
            onLeave={onLeave}
            onToggleMute={onToggleMute}
            onToggleDeafen={onToggleDeafen}
          />

          {snapshot.error ? <p className="voice-room-error">{snapshot.error}</p> : null}
          <p className="voice-room-note">LiveKit tokens are requested through the Supabase Edge Function. Secrets never enter the renderer.</p>

          <div className="voice-device-placeholder" aria-label="Audio device selection placeholder">
            <div>
              <strong>Audio devices</strong>
              <small>Selection placeholder</small>
            </div>
            <label>
              Input
              <select disabled value="system-default-input" aria-label="Microphone device placeholder">
                <option value="system-default-input">System default microphone</option>
              </select>
            </label>
            <label>
              Output
              <select disabled value="system-default-output" aria-label="Speaker device placeholder">
                <option value="system-default-output">System default speakers</option>
              </select>
            </label>
            <p>Device switching will be enabled after the native permission flow is wired safely.</p>
          </div>

          <ScreenShareControls
            connected={connected}
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

          <VoiceParticipantList community={community} participants={snapshot.participants} />
        </article>
      </div>
    </section>
  );
}
