import type { Channel, Community, Member } from "../types/community";
import type { VoiceParticipant, VoiceServiceSnapshot } from "../services/voiceService";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type VoiceRoomViewProps = {
  community: Community;
  channel: Channel;
  snapshot: VoiceServiceSnapshot;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
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
    return participant.isLocal ? "You · muted" : "Muted";
  }

  if (participant.isSpeaking) {
    return "Speaking";
  }

  return participant.isLocal ? "You" : "Connected";
}

export function VoiceRoomView({
  community,
  channel,
  snapshot,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
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
        <span className={`voice-status-pill ${snapshot.status}`}>
          <i />
          {statusLabels[snapshot.status]}
        </span>
      </div>

      <div className="voice-room-grid">
        <article className="voice-room-card">
          <header>
            <div>
              <span className="eyebrow">Controls</span>
              <h3>Room controls</h3>
            </div>
            <small>{participantCount} participant{participantCount === 1 ? "" : "s"}</small>
          </header>

          <div className="voice-control-row">
            <button className="voice-primary-action" type="button" onClick={connected ? onLeave : onJoin} disabled={joining}>
              <AppIcon name={connected ? "close" : "voice"} size="sm" />
              {connected ? "Leave room" : joining ? "Joining..." : "Join room"}
            </button>
            <button type="button" onClick={onToggleMute} disabled={!connected} aria-pressed={snapshot.muted}>
              <AppIcon name="microphone" size="sm" />
              {snapshot.muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={onToggleDeafen} disabled={!connected} aria-pressed={snapshot.deafened}>
              <AppIcon name="headphones" size="sm" />
              {snapshot.deafened ? "Undeafen" : "Deafen"}
            </button>
          </div>

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
        </article>

        <article className="voice-room-card">
          <header>
            <div>
              <span className="eyebrow">Participants</span>
              <h3>Connected users</h3>
            </div>
            <AppIcon name="users" size="lg" />
          </header>

          {snapshot.participants.length ? (
            <div className="voice-participant-list">
              {snapshot.participants.map((participant) => {
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
                      <small>{getParticipantStatus(participant)}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="voice-empty-panel">
              <strong>No one is connected yet</strong>
              <span>Join the room to start a LiveKit voice session.</span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
