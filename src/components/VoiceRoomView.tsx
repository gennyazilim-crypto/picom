import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import type { FriendConnection } from "../types/friends";
import type { MeetingReactionKind } from "../types/meeting";
import type { VoiceCameraTrack, VoiceParticipant, VoiceScreenShare, VoiceServiceSnapshot } from "../services/voiceService";
import type { VoiceRoomOccupancy } from "../types/voiceDiscovery";
import { MEETING_REACTION_OPTIONS } from "../services/meeting/meetingReactionCatalog";
import { voiceStageSignalService } from "../services/voice/voiceStageSignalService";
import { userBlockingService } from "../services/userBlockingService";
import { AppIcon } from "./AppIcon";
import { VoiceDevicePanel } from "./VoiceDevicePanel";
import { MemberAvatar } from "./MemberAvatar";
import { ScreenShareControls } from "./voice/ScreenShareControls";
import { ScreenSharePickerModal } from "./voice/ScreenSharePickerModal";
import { resolveVoiceParticipants } from "./voice/voiceParticipantsModel";
import type { ScreenShareQualityPresetId } from "../utils/screenShareQuality";
import { NoiseShieldQuickControl } from "./voice/NoiseShieldControl";
import { VoiceInvitePicker } from "./voice/VoiceInvitePicker";
import { voiceCallInviteService } from "../services/voice/voiceCallInviteService";
import "./VoiceRoomView.css";

type ToastTone = "info" | "error" | "success";

function friendToInviteMember(friend: FriendConnection): Member {
  return {
    id: friend.id ?? `friend-${friend.userId}`,
    userId: friend.userId,
    displayName: friend.displayName,
    username: friend.username,
    avatarSeed: friend.username,
    avatarUrl: friend.avatarUrl,
    status: friend.status,
    statusText: friend.statusText,
    roleId: "member",
  };
}

function statusInviteRank(status: Member["status"]): number {
  if (status === "online") return 0;
  if (status === "idle") return 1;
  if (status === "dnd") return 2;
  return 3;
}

function formatSessionElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type VoiceRoomViewProps = {
  community: Community;
  channel: Channel;
  currentUserId: string;
  snapshot: VoiceServiceSnapshot;
  voiceOccupancy?: VoiceRoomOccupancy;
  friends?: readonly FriendConnection[];
  pushToast: (message: string, tone?: ToastTone) => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  canSpeak?: boolean;
  canShareScreen?: boolean;
  onStartScreenShare?: (sourceId: string, preset: ScreenShareQualityPresetId, sourceLabel?: string) => void;
  onStopScreenShare?: () => void;
  onOpenProfile?: (event: MouseEvent, member: Member) => void;
  onParticipantContextMenu?: (event: MouseEvent, member: Member, participant: VoiceParticipant) => void;
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

function normalizeParticipantLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findMemberForParticipant(community: Community, participant: VoiceParticipant): Member | undefined {
  const identity = participant.identity.trim();
  const participantName = normalizeParticipantLabel(participant.name);

  return community.members.find((member) => {
    if (member.userId === identity || member.id === identity) {
      return true;
    }
    if (!participantName) {
      return false;
    }
    return (
      normalizeParticipantLabel(member.displayName) === participantName ||
      normalizeParticipantLabel(member.username) === participantName
    );
  });
}

function resolveMemberForParticipant(community: Community, participant: VoiceParticipant): Member {
  const found = findMemberForParticipant(community, participant);
  if (found) {
    return found;
  }

  const displayName = participant.name?.trim() || "Participant";
  const defaultRoleId =
    community.roles.find((role) => role.name === "Member")?.id ?? community.roles[0]?.id ?? "";

  return {
    id: `voice-${participant.identity}`,
    userId: participant.identity,
    displayName,
    username: displayName.toLowerCase().replace(/\s+/g, "."),
    avatarSeed: participant.identity,
    status: "online",
    statusText: "In voice",
    roleId: defaultRoleId,
  };
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
        {connected ? "Disconnect" : joining ? "Joining..." : disconnected ? "Reconnect" : "Join room"}
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

function VoiceParticipantCamera({
  stream,
  isLocal,
  label,
}: {
  stream: MediaStream;
  isLocal: boolean;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    node.srcObject = stream;
    return () => {
      node.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={`voice-room-tile__video${isLocal ? " is-mirrored" : ""}`}
      autoPlay
      muted
      playsInline
      aria-label={`${label} camera`}
    />
  );
}

function VoiceParticipantScreenShare({
  stream,
  isLocal,
  label,
}: {
  stream: MediaStream;
  isLocal: boolean;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    node.srcObject = stream;
    return () => {
      node.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className="voice-room-tile__screen"
      autoPlay
      playsInline
      muted={isLocal}
      aria-label={`${label} screen share`}
    />
  );
}

type VoiceShareLayoutMode = "tile" | "wide" | "fullscreen";

function VoiceStageSignalOverlay({
  community,
  participants,
}: {
  community: Community;
  participants: readonly VoiceParticipant[];
}) {
  const signals = useSyncExternalStore(
    voiceStageSignalService.subscribe,
    voiceStageSignalService.getSnapshot,
    voiceStageSignalService.getSnapshot,
  );
  const [clock, setClock] = useState(() => Date.now());

  const nameByIdentity = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participants) {
      map.set(participant.identity, findMemberForParticipant(community, participant)?.displayName ?? participant.name);
    }
    return map;
  }, [community, participants]);

  const raisedHands = useMemo(
    () =>
      Object.entries(signals.raisedHands)
        .filter(([, raised]) => raised)
        .map(([identity]) => ({
          identity,
          name: nameByIdentity.get(identity) ?? identity,
        })),
    [nameByIdentity, signals.raisedHands],
  );

  const activeReactions = useMemo(
    () =>
      signals.reactions
        .filter((reaction) => Date.parse(reaction.expiresAt) > clock)
        .slice(-8)
        .map((reaction) => {
          const option = MEETING_REACTION_OPTIONS.find((entry) => entry.kind === reaction.kind) ?? MEETING_REACTION_OPTIONS[0];
          return {
            ...reaction,
            emoji: option.emoji,
            label: option.label,
            name: nameByIdentity.get(reaction.senderIdentity) ?? reaction.senderIdentity,
          };
        }),
    [clock, nameByIdentity, signals.reactions],
  );

  useEffect(() => {
    const expiry = signals.reactions.reduce(
      (nearest, reaction) => Math.min(nearest, Date.parse(reaction.expiresAt)),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(expiry) || expiry <= clock) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(16, expiry - Date.now() + 16));
    return () => window.clearTimeout(timer);
  }, [clock, signals.reactions]);

  if (!raisedHands.length && !activeReactions.length) return null;

  return (
    <div className="voice-room-stage-signals" aria-live="polite" aria-label="Voice room reactions">
      {raisedHands.map((hand) => (
        <div className="voice-room-stage-signals__item voice-room-stage-signals__item--hand" key={`hand:${hand.identity}`}>
          <span className="voice-room-stage-signals__emoji" aria-hidden="true">✋</span>
          <span className="voice-room-stage-signals__meta">
            <strong>{hand.name}</strong>
            <small>Hand raised</small>
          </span>
        </div>
      ))}
      {activeReactions.map((reaction) => (
        <div
          className="voice-room-stage-signals__item voice-room-stage-signals__item--reaction"
          key={reaction.id}
          title={`${reaction.name}: ${reaction.label}`}
        >
          <span className="voice-room-stage-signals__emoji" aria-hidden="true">{reaction.emoji}</span>
          <span className="voice-room-stage-signals__meta">
            <strong>{reaction.name}</strong>
            <small>{reaction.label}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function VoiceParticipantStageTile({
  community,
  participant,
  cameraTrack,
  screenShare,
  shareLayout = "tile",
  onShareLayoutChange,
  onStopScreenShare,
  onOpenProfile,
  onParticipantContextMenu,
}: {
  community: Community;
  participant: VoiceParticipant;
  cameraTrack?: VoiceCameraTrack;
  screenShare?: VoiceScreenShare;
  shareLayout?: VoiceShareLayoutMode;
  onShareLayoutChange?: (mode: VoiceShareLayoutMode) => void;
  onStopScreenShare?: () => void;
  onOpenProfile?: (event: MouseEvent, member: Member) => void;
  onParticipantContextMenu?: (event: MouseEvent, member: Member, participant: VoiceParticipant) => void;
}) {
  const tileRef = useRef<HTMLElement>(null);
  const signals = useSyncExternalStore(
    voiceStageSignalService.subscribe,
    voiceStageSignalService.getSnapshot,
    voiceStageSignalService.getSnapshot,
  );
  const member = resolveMemberForParticipant(community, participant);
  const displayName = member.displayName;
  const handRaised = signals.raisedHands[participant.identity] === true;
  const tileReactions = signals.reactions
    .filter((reaction) => reaction.senderIdentity === participant.identity && Date.parse(reaction.expiresAt) > Date.now())
    .slice(-3)
    .map((reaction) => {
      const option = MEETING_REACTION_OPTIONS.find((entry) => entry.kind === reaction.kind) ?? MEETING_REACTION_OPTIONS[0];
      return { id: reaction.id, emoji: option.emoji, label: option.label };
    });
  const liveScreen = Boolean(screenShare?.stream);
  const liveCamera = !liveScreen && Boolean(cameraTrack?.stream);
  const interactive = Boolean(onOpenProfile || onParticipantContextMenu);
  const tileState = [
    "voice-room-tile",
    interactive && !liveScreen ? "is-interactive" : "",
    participant.isSpeaking ? "is-speaking" : "",
    !participant.isMicrophoneEnabled ? "is-muted" : "",
    handRaised ? "is-hand-raised" : "",
    liveCamera ? "has-camera" : "",
    liveScreen ? "has-screen-share" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enterNativeFullscreen = () => {
    const node = tileRef.current;
    if (!node) return;
    const request = node.requestFullscreen?.bind(node);
    if (request) void request().catch(() => undefined);
  };

  return (
    <article
      ref={tileRef}
      className={tileState}
      aria-label={`${displayName} in voice room${handRaised ? ", hand raised" : ""}${liveScreen ? ", sharing screen" : liveCamera ? ", camera on" : ", camera off"}`}
      role={interactive && !liveScreen ? "button" : undefined}
      tabIndex={interactive && !liveScreen ? 0 : undefined}
      onClick={onOpenProfile && !liveScreen ? (event) => onOpenProfile(event, member) : undefined}
      onContextMenu={
        onParticipantContextMenu
          ? (event) => {
              event.preventDefault();
              onParticipantContextMenu(event, member, participant);
            }
          : undefined
      }
      onKeyDown={
        onOpenProfile && !liveScreen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenProfile(event as unknown as MouseEvent, member);
              }
            }
          : undefined
      }
    >
      <div className="voice-room-tile__signal" aria-hidden="true">
        {participant.isSpeaking ? (
          <AppIcon name="voice" size="xs" />
        ) : !participant.isMicrophoneEnabled ? (
          <AppIcon name="volumeOff" size="xs" />
        ) : (
          <AppIcon name="microphone" size="xs" />
        )}
      </div>
      {handRaised ? (
        <div className="voice-room-tile__hand" title={`${displayName} raised their hand`}>
          <span className="voice-room-tile__hand-emoji" aria-hidden="true">✋</span>
        </div>
      ) : null}
      <div className="voice-room-tile__media">
        {liveScreen && screenShare ? (
          <VoiceParticipantScreenShare stream={screenShare.stream} isLocal={screenShare.isLocal} label={displayName} />
        ) : liveCamera && cameraTrack ? (
          <VoiceParticipantCamera stream={cameraTrack.stream} isLocal={participant.isLocal} label={displayName} />
        ) : (
          <div className="voice-room-tile__avatar">
            <MemberAvatar member={member} label={displayName} size={96} />
          </div>
        )}
      </div>
      {liveScreen ? (
        <div className="voice-room-tile__share-controls" role="toolbar" aria-label="Screen share view controls">
          <button
            type="button"
            className={shareLayout === "wide" ? "is-active" : ""}
            aria-pressed={shareLayout === "wide"}
            aria-label={shareLayout === "wide" ? "Exit wide screen" : "Wide screen"}
            onClick={(event) => {
              event.stopPropagation();
              onShareLayoutChange?.(shareLayout === "wide" ? "tile" : "wide");
            }}
          >
            <AppIcon name="maximize" size="xs" />
            <span>Wide</span>
          </button>
          <button
            type="button"
            className={shareLayout === "fullscreen" ? "is-active" : ""}
            aria-pressed={shareLayout === "fullscreen"}
            aria-label={shareLayout === "fullscreen" ? "Exit full screen" : "Full screen"}
            onClick={(event) => {
              event.stopPropagation();
              if (shareLayout === "fullscreen") {
                if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
                onShareLayoutChange?.("tile");
                return;
              }
              onShareLayoutChange?.("fullscreen");
              enterNativeFullscreen();
            }}
          >
            <AppIcon name="maximize" size="xs" />
            <span>Full screen</span>
          </button>
          {screenShare?.isLocal && onStopScreenShare ? (
            <button
              type="button"
              className="is-stop"
              aria-label="Stop sharing"
              onClick={(event) => {
                event.stopPropagation();
                onStopScreenShare();
              }}
            >
              <AppIcon name="close" size="xs" />
              <span>Stop</span>
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="voice-room-tile__shade" aria-hidden="true" />
      {tileReactions.length ? (
        <div className="voice-room-tile__reactions" aria-live="polite" aria-label={`${displayName} reactions`}>
          {tileReactions.map((reaction) => (
            <span className="voice-room-tile__reaction" key={reaction.id} title={reaction.label}>
              {reaction.emoji}
            </span>
          ))}
        </div>
      ) : null}
      <div className="voice-room-tile__identity">
        <strong>{displayName}{participant.isLocal ? " (you)" : ""}</strong>
        <small>
          {getParticipantStatus(participant)}
          {liveScreen ? ` · Sharing${screenShare?.sourceLabel ? ` · ${screenShare.sourceLabel}` : ""}` : ""}
          {!liveScreen && !liveCamera ? " · Camera off" : ""}
        </small>
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
  const names = participants.map((participant) => resolveMemberForParticipant(community, participant).displayName);

  return (
    <section className="voice-room-lobby" aria-label="Voice room lobby">
      <div className="voice-room-lobby__cards" aria-hidden={preview.length ? undefined : true}>
        {preview.map((participant, index) => {
          const member = resolveMemberForParticipant(community, participant);
          const displayName = member.displayName;
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

function VoiceRoomWelcomeTile({
  community,
  currentUserId,
  connected,
  joining,
  onJoin,
}: {
  community: Community;
  currentUserId: string;
  connected: boolean;
  joining: boolean;
  onJoin?: () => void;
}) {
  const member = community.members.find((entry) => entry.userId === currentUserId);
  const displayName = member?.displayName ?? "You";

  return (
    <article className="voice-room-tile voice-room-tile--welcome" aria-label="Your voice seat">
      <div className="voice-room-tile__signal" aria-hidden="true">
        <AppIcon name="headphones" size="xs" />
      </div>
      <div className="voice-room-tile__avatar">
        <MemberAvatar member={member} label={displayName} size={96} />
      </div>
      <div className="voice-room-tile__shade" aria-hidden="true" />
      <div className="voice-room-tile__identity">
        <strong>{connected ? "You are alone in the room" : displayName}</strong>
        <small>{connected ? "Invite friends or wait for others to join." : "Voice room is open"}</small>
        {!connected ? (
          <button type="button" className="voice-room-tile__join" onClick={onJoin} disabled={joining}>
            <AppIcon name="voice" size="sm" />
            {joining ? "Joining..." : "Join room"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function VoiceParticipantStageGrid({
  community,
  currentUserId,
  participants,
  connected,
  joining,
  cameraTracks = [],
  screenShares = [],
  shareLayout = "tile",
  onShareLayoutChange,
  onStopScreenShare,
  onJoin,
  onInvite,
  onOpenProfile,
  onParticipantContextMenu,
}: {
  community: Community;
  currentUserId: string;
  participants: VoiceParticipant[];
  connected: boolean;
  joining: boolean;
  cameraTracks?: readonly VoiceCameraTrack[];
  screenShares?: readonly VoiceScreenShare[];
  shareLayout?: VoiceShareLayoutMode;
  onShareLayoutChange?: (mode: VoiceShareLayoutMode) => void;
  onStopScreenShare?: () => void;
  onJoin?: () => void;
  onInvite?: () => void;
  onOpenProfile?: (event: MouseEvent, member: Member) => void;
  onParticipantContextMenu?: (event: MouseEvent, member: Member, participant: VoiceParticipant) => void;
}) {
  const cameraByIdentity = useMemo(() => {
    const map = new Map<string, VoiceCameraTrack>();
    for (const track of cameraTracks) {
      map.set(track.participantIdentity, track);
    }
    return map;
  }, [cameraTracks]);

  const shareByIdentity = useMemo(() => {
    const map = new Map<string, VoiceScreenShare>();
    for (const share of screenShares) {
      map.set(share.participantIdentity, share);
    }
    return map;
  }, [screenShares]);

  const orderedParticipants = useMemo(() => {
    if (!screenShares.length) return participants;
    const sharing = participants.filter((participant) => shareByIdentity.has(participant.identity));
    const others = participants.filter((participant) => !shareByIdentity.has(participant.identity));
    return [...sharing, ...others];
  }, [participants, screenShares.length, shareByIdentity]);

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

  // Empty: welcome + invite. Connected: one box per participant (solo = single large tile).
  const showInviteTile = !connected;
  const densityClass = getVoiceStageGridDensity(
    connected ? Math.max(participants.length, 1) : participants.length ? participants.length : 2,
  );
  const shareLayoutClass = shareLayout === "tile" ? "" : `is-share-${shareLayout}`;

  if (!participants.length) {
    return (
      <section className={`voice-room-stage-grid ${densityClass}`} aria-label="Voice room participants">
        <VoiceRoomWelcomeTile
          community={community}
          currentUserId={currentUserId}
          connected={connected}
          joining={joining}
          onJoin={onJoin}
        />
        {showInviteTile ? <VoiceRoomInviteTile onInvite={onInvite} /> : null}
      </section>
    );
  }

  return (
    <section className={`voice-room-stage-grid ${densityClass} ${shareLayoutClass}`.trim()} aria-label="Voice room participants">
      {orderedParticipants.map((participant) => (
        <VoiceParticipantStageTile
          key={participant.identity}
          community={community}
          participant={participant}
          cameraTrack={cameraByIdentity.get(participant.identity)}
          screenShare={shareByIdentity.get(participant.identity)}
          shareLayout={shareLayout}
          onShareLayoutChange={onShareLayoutChange}
          onStopScreenShare={onStopScreenShare}
          onOpenProfile={onOpenProfile}
          onParticipantContextMenu={onParticipantContextMenu}
        />
      ))}
    </section>
  );
}

export function VoiceParticipantList({
  community,
  participants,
  compact = false,
  canMuteMembers = false,
  canRemoveFromVoice = false,
  onModerateParticipant,
  onOpenProfile,
  onParticipantContextMenu,
}: {
  community: Community;
  participants: VoiceParticipant[];
  compact?: boolean;
  canMuteMembers?: boolean;
  canRemoveFromVoice?: boolean;
  onModerateParticipant?: (participant: VoiceParticipant, action: "mute" | "remove") => void;
  onOpenProfile?: (event: MouseEvent, member: Member) => void;
  onParticipantContextMenu?: (event: MouseEvent, member: Member, participant: VoiceParticipant) => void;
}) {
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
        const member = resolveMemberForParticipant(community, participant);
        const interactive = Boolean(onOpenProfile || onParticipantContextMenu);
        const rowState = [
          "voice-participant-row",
          interactive ? "is-interactive" : "",
          participant.isSpeaking ? "is-speaking" : "",
          !participant.isMicrophoneEnabled ? "is-muted" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            className={rowState}
            key={participant.identity}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${member.displayName} in voice`}
            onClick={
              onOpenProfile
                ? (event) => {
                    if ((event.target as HTMLElement).closest(".voice-participant-actions")) return;
                    onOpenProfile(event, member);
                  }
                : undefined
            }
            onContextMenu={
              onParticipantContextMenu
                ? (event) => {
                    event.preventDefault();
                    onParticipantContextMenu(event, member, participant);
                  }
                : undefined
            }
            onKeyDown={
              onOpenProfile
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenProfile(event as unknown as MouseEvent, member);
                    }
                  }
                : undefined
            }
          >
            <MemberAvatar member={member} label={member.displayName} size={34} />
            <span>
              <strong>{member.displayName}</strong>
              <small>
                {getParticipantStatus(participant)}
                <SpeakingIndicator participant={participant} />
              </small>
            </span>
            {!participant.isLocal && community.ownerId !== participant.identity && (canMuteMembers || canRemoveFromVoice) ? (
              <div className="voice-participant-actions">
                {canMuteMembers ? (
                  <button
                    type="button"
                    aria-label={`Mute ${member.displayName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onModerateParticipant?.(participant, "mute");
                    }}
                  >
                    <AppIcon name="microphone" size="xs" />
                  </button>
                ) : null}
                {canRemoveFromVoice ? (
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Remove ${member.displayName} from voice`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onModerateParticipant?.(participant, "remove");
                    }}
                  >
                    <AppIcon name="close" size="xs" />
                  </button>
                ) : null}
              </div>
            ) : null}
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
  handRaised = false,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onStopScreenShare,
  onOpenSharePicker,
  onOpenSettings,
  onInvite,
  onToggleHand,
  onSendReaction,
  settingsOpen = false,
}: {
  connected: boolean;
  joining: boolean;
  disconnected: boolean;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  canSpeak: boolean;
  canShareScreen: boolean;
  handRaised?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onStopScreenShare?: () => void;
  onOpenSharePicker?: () => void;
  onOpenSettings: () => void;
  onInvite?: () => void;
  onToggleHand?: () => void;
  onSendReaction?: (kind: MeetingReactionKind) => void;
  settingsOpen?: boolean;
}) {
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reactionsOpen, setReactionsOpen] = useState(false);

  useEffect(() => {
    if (!connected) {
      setConnectedAt(null);
      setReactionsOpen(false);
      return;
    }
    setConnectedAt((current) => current ?? Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  const sessionLabel = connected && connectedAt
    ? formatSessionElapsed(now - connectedAt)
    : joining
      ? "Connecting"
      : "Not in room";

  return (
    <footer className={`voice-room-control-dock${connected ? " is-connected" : " is-lobby"}`} aria-label="Voice room controls">
      <div className="voice-room-control-dock__status">
        <span className="voice-room-control-dock__timer" aria-live="polite">
          <i />
          {sessionLabel}
        </span>
      </div>

      {connected ? (
        <div className="voice-room-control-dock__cluster">
          <button
            type="button"
            className={muted ? "is-off" : canSpeak ? "is-active" : ""}
            disabled={!canSpeak}
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
            disabled={!canShareScreen}
            aria-pressed={screenSharing}
            aria-label={screenSharing ? "Stop screen share" : "Share screen"}
            onClick={screenSharing ? onStopScreenShare : onOpenSharePicker}
          >
            <AppIcon name="maximize" size="md" />
            <span>{screenSharing ? "Stop share" : "Share"}</span>
          </button>
          <button
            type="button"
            className={handRaised ? "is-active" : ""}
            aria-pressed={handRaised}
            aria-label={handRaised ? "Lower hand" : "Raise hand"}
            onClick={onToggleHand}
          >
            <span className="voice-room-control-dock__emoji" aria-hidden="true">✋</span>
            <span>{handRaised ? "Lower" : "Hand"}</span>
          </button>
          <div className="voice-room-control-dock__reactions">
            <button
              type="button"
              className={reactionsOpen ? "is-active" : ""}
              aria-pressed={reactionsOpen}
              aria-expanded={reactionsOpen}
              aria-haspopup="menu"
              aria-label="Open reactions"
              onClick={() => setReactionsOpen((open) => !open)}
            >
              <AppIcon name="smile" size="md" />
              <span>React</span>
            </button>
            {reactionsOpen ? (
              <div className="voice-room-control-dock__reaction-menu" role="menu" aria-label="Voice reactions">
                {MEETING_REACTION_OPTIONS.map((reaction) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={reaction.kind}
                    aria-label={reaction.label}
                    onClick={() => {
                      onSendReaction?.(reaction.kind);
                      setReactionsOpen(false);
                    }}
                  >
                    <span aria-hidden="true">{reaction.emoji}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Invite to voice"
            onClick={onInvite}
          >
            <AppIcon name="users" size="md" />
            <span>Invite</span>
          </button>
          <button
            type="button"
            className={settingsOpen ? "is-active" : ""}
            aria-label="Open audio and share settings"
            aria-pressed={settingsOpen}
            onClick={onOpenSettings}
          >
            <AppIcon name="settings" size="md" />
            <span>Settings</span>
          </button>
        </div>
      ) : (
        <div className="voice-room-control-dock__cluster" aria-hidden="true" />
      )}

      <div className="voice-room-control-dock__cluster voice-room-control-dock__cluster--end">
        {connected ? (
          <button type="button" className="voice-room-control-dock__leave" onClick={onLeave} disabled={joining} aria-label="Disconnect">
            <AppIcon name="close" size="sm" />
            Disconnect
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
  friends = [],
  pushToast,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  canSpeak = false,
  canShareScreen = false,
  onStartScreenShare,
  onStopScreenShare,
  onOpenProfile,
  onParticipantContextMenu,
}: VoiceRoomViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invitePickerOpen, setInvitePickerOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [shareLayout, setShareLayout] = useState<VoiceShareLayoutMode>("tile");
  // Communities are independent: this view reflects the live session ONLY when the session
  // belongs to THIS community's channel. Without this scoping, being connected anywhere showed
  // "Connected" and the same participants in every community's voice room view.
  const sessionHere = snapshot.roomContext?.communityId === community.id && snapshot.roomContext?.channelId === channel.id;
  const connected = sessionHere && (snapshot.status === "connected" || snapshot.status === "reconnecting");
  const joining = sessionHere && (snapshot.status === "requesting_token" || snapshot.status === "connecting");
  const participants = useMemo(
    () => resolveVoiceParticipants(snapshot, channel.id, voiceOccupancy, currentUserId),
    [channel.id, currentUserId, snapshot, voiceOccupancy],
  );
  const inviteCandidates = useMemo(() => {
    const inVoice = new Set(
      participants.flatMap((participant) => {
        const ids = [participant.identity.trim()];
        const member = findMemberForParticipant(community, participant);
        if (member) ids.push(member.userId, member.id);
        return ids.filter(Boolean);
      }),
    );
    const byUserId = new Map<string, Member>();
    for (const member of community.members) {
      if (member.userId === currentUserId || member.isBot || userBlockingService.isBlocked(member.userId)) continue;
      if (inVoice.has(member.userId) || inVoice.has(member.id)) continue;
      byUserId.set(member.userId, member);
    }
    for (const friend of friends) {
      if (friend.userId === currentUserId || userBlockingService.isBlocked(friend.userId)) continue;
      if (inVoice.has(friend.userId) || byUserId.has(friend.userId)) continue;
      byUserId.set(friend.userId, friendToInviteMember(friend));
    }
    return [...byUserId.values()].sort((left, right) => {
      const rank = statusInviteRank(left.status) - statusInviteRank(right.status);
      if (rank !== 0) return rank;
      return left.displayName.localeCompare(right.displayName);
    });
  }, [community, currentUserId, friends, participants]);
  const participantCount = participants.length;
  const hasScreenShare = connected && snapshot.screenShares.length > 0;
  const inVoiceLobby = !connected && participantCount > 0;
  const stageSignals = useSyncExternalStore(
    voiceStageSignalService.subscribe,
    voiceStageSignalService.getSnapshot,
    voiceStageSignalService.getSnapshot,
  );
  const localHandRaised = stageSignals.raisedHands[currentUserId] === true;
  const cameraTracks = snapshot.cameraTracks ?? [];

  useEffect(() => {
    if (!connected) {
      setSettingsOpen(false);
      setInvitePickerOpen(false);
      setSharePickerOpen(false);
      setShareLayout("tile");
    }
  }, [connected]);

  useEffect(() => {
    if (!hasScreenShare) {
      setShareLayout("tile");
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }
  }, [hasScreenShare]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && shareLayout === "fullscreen") {
        setShareLayout("tile");
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [shareLayout]);

  const openSettings = () => setSettingsOpen((current) => !current);
  const handleInviteToVoice = () => setInvitePickerOpen(true);
  const handleSelectInvitee = (member: Member) => {
    setInvitePickerOpen(false);
    void voiceCallInviteService
      .invite(
        { id: member.userId, name: member.displayName, avatarUrl: member.avatarUrl },
        { kind: "community", communityId: community.id, communityName: community.name, channelId: channel.id, channelName: channel.name },
      )
      .then((call) => {
        pushToast(
          call && call.status !== "failed"
            ? `Ringing ${member.displayName}…`
            : call?.failureMessage || "Could not ring this member.",
          call && call.status !== "failed" ? "info" : "error",
        );
      });
  };
  const handleToggleHand = () => {
    void voiceStageSignalService.toggleHand(currentUserId).then((result) => {
      if (!result.ok) pushToast(result.message, "error");
    });
  };
  const handleSendReaction = (kind: MeetingReactionKind) => {
    void voiceStageSignalService.sendReaction(currentUserId, kind).then((result) => {
      if (!result.ok) pushToast(result.message, "error");
    });
  };

  return (
    <section className="voice-room-view" aria-label={`${channel.name} voice room`}>
      {invitePickerOpen ? (
        <VoiceInvitePicker
          members={inviteCandidates}
          currentUserId={currentUserId}
          onSelect={handleSelectInvitee}
          onClose={() => setInvitePickerOpen(false)}
        />
      ) : null}
      {sharePickerOpen ? (
        <ScreenSharePickerModal
          connected={connected && canShareScreen}
          onStart={(sourceId, preset, sourceLabel) => {
            onStartScreenShare?.(sourceId, preset, sourceLabel);
            setSharePickerOpen(false);
          }}
          onClose={() => setSharePickerOpen(false)}
        />
      ) : null}
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

      <div className={`voice-room-body${settingsOpen ? " has-settings-rail" : ""}`}>
        <main className={`voice-room-stage${hasScreenShare && connected ? ` has-in-tile-share is-share-${shareLayout}` : ""}`}>
          {connected ? <VoiceStageSignalOverlay community={community} participants={participants} /> : null}
          <VoiceParticipantStageGrid
            community={community}
            currentUserId={currentUserId}
            participants={participants}
            connected={connected}
            joining={joining}
            cameraTracks={cameraTracks}
            screenShares={connected ? snapshot.screenShares : []}
            shareLayout={shareLayout}
            onShareLayoutChange={setShareLayout}
            onStopScreenShare={onStopScreenShare}
            onJoin={onJoin}
            onInvite={handleInviteToVoice}
            onOpenProfile={onOpenProfile}
            onParticipantContextMenu={onParticipantContextMenu}
          />
        </main>

        {settingsOpen ? (
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
                      <p>Use Share in the control bar to pick a screen. Advanced quality lives here.</p>
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
        handRaised={localHandRaised}
        onJoin={onJoin}
        onLeave={onLeave}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onStopScreenShare={onStopScreenShare}
        onOpenSharePicker={() => setSharePickerOpen(true)}
        onOpenSettings={openSettings}
        onInvite={handleInviteToVoice}
        onToggleHand={handleToggleHand}
        onSendReaction={handleSendReaction}
        settingsOpen={settingsOpen}
      />
    </section>
  );
}
