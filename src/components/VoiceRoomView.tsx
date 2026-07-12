import { useMemo, useState } from "react";
import type { Channel, Community, Member } from "../types/community";
import type { VoiceParticipant, VoiceServiceSnapshot } from "../services/voiceService";
import type { VoiceRoomOccupancy } from "../types/voiceDiscovery";
import { AppIcon } from "./AppIcon";
import { VoiceDevicePanel } from "./VoiceDevicePanel";
import { MemberAvatar } from "./MemberAvatar";
import { ScreenShareControls } from "./voice/ScreenShareControls";
import { ScreenSharePreview } from "./voice/ScreenSharePreview";
import { resolveVoiceParticipants } from "./voice/voiceParticipantsModel";
import type { ScreenShareQualityPresetId } from "../utils/screenShareQuality";
import { NoiseShieldQuickControl } from "./voice/NoiseShieldControl";
import "./VoiceRoomView.css";

type ToastTone = "info" | "error" | "success";

type VoiceRoomViewProps = {
  community: Community;
  channel: Channel;
  currentUserId: string;
  snapshot: VoiceServiceSnapshot;
  voiceOccupancy?: VoiceRoomOccupancy;
  pushToast: (message: string, tone?: ToastTone) => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  canSpeak?: boolean;
  canShareScreen?: boolean;
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

function getVoiceStageGridDensity(tileCount: number): string {
  if (tileCount <= 1) return "is-density-1";
  if (tileCount === 2) return "is-density-2";
  if (tileCount <= 4) return "is-density-4";
  if (tileCount <= 6) return "is-density-6";
  if (tileCount <= 9) return "is-density-9";
  return "is-density-many";
}

function VoiceParticipantStageTile({
  community,
  participant,
}: {
  community: Community;
  participant: VoiceParticipant;
}) {
  const member = findMemberForParticipant(community, participant);
  const displayName = member?.displayName ?? participant.name;
  const tileState = [
    "voice-room-tile",
    participant.isSpeaking ? "is-speaking" : "",
    !participant.isMicrophoneEnabled ? "is-muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={tileState} aria-label={`${displayName} in voice room`}>
      <div className="voice-room-tile__signal" aria-hidden="true">
        {participant.isSpeaking ? <AppIcon name="voice" size="xs" /> : !participant.isMicrophoneEnabled ? <AppIcon name="microphone" size="xs" /> : null}
      </div>
      <div className="voice-room-tile__avatar">
        <MemberAvatar member={member} label={displayName} size={96} />
      </div>
      <div className="voice-room-tile__shade" aria-hidden="true" />
      <div className="voice-room-tile__identity">
        <strong>{displayName}</strong>
        <small>{getParticipantStatus(participant)}</small>
      </div>
    </article>
  );
}

function VoiceRoomInviteTile({ onInvite }: { onInvite?: () => void }) {
  return (
    <article className="voice-room-tile voice-room-tile--invite" aria-label="Invite others to voice">
      <div className="voice-room-tile__invite-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="voice-room-tile__invite-actions">
        <button type="button" onClick={onInvite}>
          <AppIcon name="users" size="sm" />
          Invite to voice
        </button>
        <button type="button" disabled title="Activities are coming soon">
          <AppIcon name="maximize" size="sm" />
          Choose activity
        </button>
      </div>
    </article>
  );
}

function formatLobbyParticipantCopy(names: string[]): string {
  if (!names.length) return "Başkaları şu an bu sesli odada.";
  if (names.length === 1) return `${names[0]} şu an sesli sohbette.`;
  if (names.length === 2) return `${names[0]} ve ${names[1]} şu an sesli sohbette.`;
  if (names.length === 3) return `${names[0]}, ${names[1]} ve ${names[2]} şu an sesli sohbette.`;
  return `${names[0]}, ${names[1]} ve ${names.length - 2} kişi daha şu an sesli sohbette.`;
}

function VoiceRoomLobbyScreen({
  community,
  participants,
  joining,
  onJoin,
}: {
  community: Community;
  participants: VoiceParticipant[];
  joining: boolean;
  onJoin?: () => void;
}) {
  const preview = participants.slice(0, 6);
  const names = participants.map((participant) => findMemberForParticipant(community, participant)?.displayName ?? participant.name);

  return (
    <section className="voice-room-lobby" aria-label="Voice room lobby">
      <div className="voice-room-lobby__cards" aria-hidden={preview.length ? undefined : true}>
        {preview.map((participant, index) => {
          const member = findMemberForParticipant(community, participant);
          const displayName = member?.displayName ?? participant.name;
          return (
            <article
              key={participant.identity}
              className={`voice-room-lobby__card voice-room-lobby__card--tone-${(index % 4) + 1}`}
              aria-label={displayName}
            >
              <MemberAvatar member={member} label={displayName} size={72} />
            </article>
          );
        })}
      </div>
      <h2 className="voice-room-lobby__title">Inactive</h2>
      <p className="voice-room-lobby__copy">{formatLobbyParticipantCopy(names)}</p>
      <button type="button" className="voice-room-lobby__join" onClick={onJoin} disabled={joining}>
        {joining ? "Katılınıyor..." : "Sesli sohbete katıl"}
      </button>
    </section>
  );
}

function VoiceParticipantStageGrid({
  community,
  participants,
  connected,
  joining,
  onJoin,
  onInvite,
}: {
  community: Community;
  participants: VoiceParticipant[];
  connected: boolean;
  joining: boolean;
  onJoin?: () => void;
  onInvite?: () => void;
}) {
  if (!connected && participants.length > 0) {
    return (
      <VoiceRoomLobbyScreen
        community={community}
        participants={participants}
        joining={joining}
        onJoin={onJoin}
      />
    );
  }

  const showInviteTile = connected && participants.length > 0 && participants.length < 10;
  const tileCount = participants.length + (showInviteTile ? 1 : 0);
  const densityClass = getVoiceStageGridDensity(tileCount || 1);

  if (!participants.length) {
    return (
      <section className={`voice-room-stage-grid ${densityClass}`} aria-label="Voice room participants">
        <article className="voice-room-tile voice-room-tile--welcome">
          <div className="voice-room-tile__welcome-copy">
            <strong>{connected ? "You are alone in the room" : "Voice room is open"}</strong>
            <span>{connected ? "Invite friends or wait for others to join." : "Join the room to take a seat and start talking."}</span>
            {!connected ? (
              <button type="button" className="voice-room-tile__join" onClick={onJoin} disabled={joining}>
                <AppIcon name="voice" size="sm" />
                {joining ? "Joining..." : "Join room"}
              </button>
            ) : null}
          </div>
        </article>
        <VoiceRoomInviteTile onInvite={onInvite} />
      </section>
    );
  }

  return (
    <section className={`voice-room-stage-grid ${densityClass}`} aria-label="Voice room participants">
      {participants.map((participant) => (
        <VoiceParticipantStageTile key={participant.identity} community={community} participant={participant} />
      ))}
      {showInviteTile ? <VoiceRoomInviteTile onInvite={onInvite} /> : null}
    </section>
  );
}

export function VoiceParticipantList({ community, participants, compact = false, canMuteMembers = false, canRemoveFromVoice = false, onModerateParticipant }: { community: Community; participants: VoiceParticipant[]; compact?: boolean; canMuteMembers?: boolean; canRemoveFromVoice?: boolean; onModerateParticipant?: (participant: VoiceParticipant, action: "mute" | "remove") => void }) {
  if (!participants.length) {
    return (
      <div className={`voice-empty-panel${compact ? " voice-empty-panel--compact" : ""}`}>
        <strong>{compact ? "Henüz kimse yok" : "No one is connected yet"}</strong>
        <span>{compact ? "Odaya katılanlar burada görünür." : "Join the room to start a LiveKit voice session."}</span>
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
            <MemberAvatar member={member} label={participant.name} size={34} />
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

function VoiceRoomControlDock({
  connected,
  joining,
  disconnected,
  muted,
  deafened,
  screenSharing,
  canSpeak,
  canShareScreen,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onStopScreenShare,
  onOpenSettings,
}: {
  connected: boolean;
  joining: boolean;
  disconnected: boolean;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  canSpeak: boolean;
  canShareScreen: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onStopScreenShare?: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <footer className="voice-room-control-dock" aria-label="Voice room controls">
      <div className="voice-room-control-dock__status">
        <span className="voice-room-control-dock__timer">
          <i />
          {connected ? "Live session" : joining ? "Connecting" : "Not in room"}
        </span>
      </div>

      <div className="voice-room-control-dock__cluster">
        <button
          type="button"
          className={muted ? "is-off" : connected && canSpeak ? "is-active" : ""}
          disabled={!connected || !canSpeak}
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          onClick={onToggleMute}
        >
          <AppIcon name="microphone" size="md" />
          <span>{muted ? "Unmute" : "Mute"}</span>
        </button>
        <button
          type="button"
          className={deafened ? "is-off" : ""}
          disabled={!connected}
          aria-pressed={deafened}
          aria-label={deafened ? "Undeafen" : "Deafen"}
          onClick={onToggleDeafen}
        >
          <AppIcon name="headphones" size="md" />
          <span>{deafened ? "Undeafen" : "Deafen"}</span>
        </button>
        <button
          type="button"
          className={screenSharing ? "is-active" : ""}
          disabled={!connected || !canShareScreen}
          aria-pressed={screenSharing}
          aria-label={screenSharing ? "Stop screen share" : "Share screen"}
          onClick={screenSharing ? onStopScreenShare : onOpenSettings}
        >
          <AppIcon name="maximize" size="md" />
          <span>{screenSharing ? "Stop share" : "Share"}</span>
        </button>
        <button type="button" aria-label="Open audio and share settings" onClick={onOpenSettings}>
          <AppIcon name="settings" size="md" />
          <span>Settings</span>
        </button>
      </div>

      <div className="voice-room-control-dock__cluster voice-room-control-dock__cluster--end">
        {connected ? (
          <button type="button" className="voice-room-control-dock__leave" onClick={onLeave} disabled={joining}>
            <AppIcon name="close" size="sm" />
            Leave room
          </button>
        ) : (
          <button type="button" className="voice-room-control-dock__join" onClick={onJoin} disabled={joining}>
            <AppIcon name="voice" size="sm" />
            {joining ? "Joining..." : disconnected ? "Reconnect" : "Join room"}
          </button>
        )}
      </div>
    </footer>
  );
}

export function VoiceRoomView({
  community,
  channel,
  currentUserId,
  snapshot,
  voiceOccupancy,
  pushToast,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  canSpeak = false,
  canShareScreen = false,
  onStartScreenShare,
  onStopScreenShare,
}: VoiceRoomViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const connected = snapshot.status === "connected" || snapshot.status === "reconnecting";
  const joining = snapshot.status === "requesting_token" || snapshot.status === "connecting";
  const participants = useMemo(
    () => resolveVoiceParticipants(snapshot, channel.id, voiceOccupancy, currentUserId),
    [channel.id, currentUserId, snapshot, voiceOccupancy],
  );
  const participantCount = participants.length;
  const hasScreenShare = snapshot.screenShares.length > 0;
  const inVoiceLobby = !connected && participantCount > 0;

  const openSettings = () => setSettingsOpen((current) => !current);
  const handleInviteToVoice = () => pushToast("Voice invites from the stage are coming soon.", "info");

  return (
    <section className="voice-room-view" aria-label={`${channel.name} voice room`}>
      <header className="voice-room-top-bar">
        <div className="voice-room-top-bar__identity">
          <span className="voice-room-top-bar__mark" aria-hidden="true">
            <AppIcon name="voice" size="md" />
          </span>
          <div>
            <small>{community.name}</small>
            <strong>{channel.name}</strong>
          </div>
        </div>
        <span className="voice-room-top-bar__meta">
          <AppIcon name="users" size="xs" />
          {participantCount} connected
        </span>
        {inVoiceLobby ? (
          <span className="voice-room-top-bar__inactive">
            <AppIcon name="headphones" size="xs" />
            Inactive
          </span>
        ) : (
          <VoiceConnectionStatus status={snapshot.status} />
        )}
      </header>

      <div className={`voice-room-body${connected && settingsOpen ? " has-settings-rail" : ""}`}>
        <main className={`voice-room-stage${hasScreenShare && connected ? " has-screen-share" : ""}`}>
          {hasScreenShare && connected ? (
            <div className="voice-room-stage__share">
              <ScreenSharePreview shares={snapshot.screenShares} onStop={onStopScreenShare} />
            </div>
          ) : null}
          <VoiceParticipantStageGrid
            community={community}
            participants={participants}
            connected={connected}
            joining={joining}
            onJoin={onJoin}
            onInvite={handleInviteToVoice}
          />
        </main>

        {connected && settingsOpen ? (
        <aside className="voice-room-settings-rail" aria-label="Voice room audio and share settings">
          <header className="voice-room-settings-rail__head">
            <strong>Audio &amp; share</strong>
            <button type="button" className="voice-room-settings-rail__close" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
              <AppIcon name="close" size="sm" />
            </button>
          </header>
          <div className="voice-room-chat-rail__content voice-room-chat-rail__content--settings">
              <div className="voice-room-settings-panel">
                <section className="voice-room-settings-card" aria-labelledby="voice-room-audio-heading">
                  <header className="voice-room-settings-card__head">
                    <span className="voice-room-settings-card__icon" aria-hidden="true">
                      <AppIcon name="microphone" size="sm" />
                    </span>
                    <div>
                      <h3 id="voice-room-audio-heading">Audio devices</h3>
                      <p>Microphone and speaker routing for this room.</p>
                    </div>
                  </header>
                  <VoiceDevicePanel />
                </section>

                <section className="voice-room-settings-card" aria-labelledby="voice-room-shield-heading">
                  <header className="voice-room-settings-card__head">
                    <span className="voice-room-settings-card__icon voice-room-settings-card__icon--shield" aria-hidden="true">
                      <AppIcon name="voice" size="sm" />
                    </span>
                    <div>
                      <h3 id="voice-room-shield-heading">Noise shield</h3>
                      <p>Suppress background noise without touching shared audio.</p>
                    </div>
                  </header>
                  <NoiseShieldQuickControl connected={connected && canSpeak} variant="card" />
                </section>

                <section className="voice-room-settings-card" aria-labelledby="voice-room-share-heading">
                  <header className="voice-room-settings-card__head">
                    <span className="voice-room-settings-card__icon voice-room-settings-card__icon--share" aria-hidden="true">
                      <AppIcon name="maximize" size="sm" />
                    </span>
                    <div>
                      <h3 id="voice-room-share-heading">Screen share</h3>
                      <p>Pick a source only when you are ready to broadcast.</p>
                    </div>
                  </header>
                  <ScreenShareControls
                    variant="rail"
                    connected={connected && canShareScreen}
                    screenSharing={snapshot.screenSharing}
                    onStart={onStartScreenShare}
                    onStop={onStopScreenShare}
                  />
                </section>

                {snapshot.error ? <p className="voice-room-error" role="alert">{snapshot.error}</p> : null}

                <details className="voice-room-settings-footnote">
                  <summary>Connection details</summary>
                  <p>LiveKit tokens are requested through the Supabase Edge Function. Secrets never enter the renderer.</p>
                </details>
              </div>
          </div>
        </aside>
        ) : null}
      </div>

      <VoiceRoomControlDock
        connected={connected}
        joining={joining}
        disconnected={snapshot.status === "disconnected"}
        muted={snapshot.muted}
        deafened={snapshot.deafened}
        screenSharing={snapshot.screenSharing}
        canSpeak={canSpeak}
        canShareScreen={canShareScreen}
        onJoin={onJoin}
        onLeave={onLeave}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onStopScreenShare={onStopScreenShare}
        onOpenSettings={openSettings}
      />
    </section>
  );
}
