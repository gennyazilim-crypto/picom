import type { MouseEvent } from "react";
import type { Community, Member, UserStatus } from "../types/community";
import type { UpcomingEvent, UpcomingEventType } from "../types/events";
import type { FriendConnection } from "../types/friends";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import { dateTimeService } from "../services/dateTimeService";
import type { ActiveVoiceRoomSummary } from "../types/voiceDiscovery";
import type { AudioPlayableItem } from "../types/audio";
import { AppIcon, type IconName } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";
import { AudioMiniPlayer } from "./audio/AudioMiniPlayer";

type FeedCompanionRailProps = {
  voiceState: VoiceServiceSnapshot;
  activeVoiceRooms: ActiveVoiceRoomSummary[];
  friends: FriendConnection[];
  events: UpcomingEvent[];
  communities: Community[];
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenVoiceRoom: (room: ActiveVoiceRoomSummary) => void;
  onOpenScreenShare: () => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenEventCommunity: (communityId: string) => void;
  onEventDetails: (event: UpcomingEvent) => void;
  onToggleEventReminder: (event: UpcomingEvent) => void;
  audioItem?: AudioPlayableItem | null;
  onCloseAudio: () => void;
};

function findMember(communities: Community[], userId: string) {
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function getCommunityName(communities: Community[], communityId: string) {
  return communities.find((community) => community.id === communityId)?.name ?? "Picom community";
}

function getStatusLabel(status: UserStatus) {
  if (status === "dnd") return "Busy";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getEventIcon(type: UpcomingEventType): IconName {
  if (type === "voice") return "voice";
  if (type === "release") return "send";
  if (type === "review") return "eye";
  if (type === "social") return "users";
  return "bell";
}

function VoiceMiniControlCard({
  voiceState,
  onToggleMute,
  onToggleDeafen,
  onLeaveVoice,
  onOpenScreenShare,
}: Pick<FeedCompanionRailProps, "voiceState" | "onToggleMute" | "onToggleDeafen" | "onLeaveVoice" | "onOpenScreenShare">) {
  if (voiceState.status !== "connected" && voiceState.status !== "reconnecting") return null;

  return (
    <section className="voice-mini-card" aria-label="Current voice room controls">
      <header>
        <span className="voice-mini-icon">
          <AppIcon name="voice" size="lg" />
        </span>
        <div>
          <p className="eyebrow">Connected Voice</p>
          <strong>{voiceState.roomContext?.channelName ?? voiceState.roomName ?? "Voice room"}</strong>
          <small>{voiceState.status === "reconnecting" ? "Restoring connection..." : "LiveKit connected"}</small>
        </div>
      </header>
      <div className="voice-mini-meta">
        <span>
          <i />
          Live
        </span>
        <span>{voiceState.participants.length} listening</span>
      </div>
      <div className="voice-mini-controls">
        <button type="button" aria-label={voiceState.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={voiceState.muted} onClick={onToggleMute}>
          <AppIcon name="microphone" size="sm" />
        </button>
        <button type="button" aria-label={voiceState.deafened ? "Undeafen audio" : "Deafen audio"} aria-pressed={voiceState.deafened} onClick={onToggleDeafen}>
          <AppIcon name="headphones" size="sm" />
        </button>
        <button type="button" aria-label="Open screen share controls" aria-pressed={voiceState.screenSharing} onClick={onOpenScreenShare}>
          <AppIcon name="image" size="sm" />
        </button>
        <button type="button" className="voice-mini-leave" aria-label="Leave voice room" onClick={onLeaveVoice}>
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </section>
  );
}

function FriendStatusRow({
  friend,
  member,
  onOpenProfile,
}: {
  friend: FriendConnection;
  member?: Member;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
}) {
  const displayMember: Member = member ?? {
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

  return (
    <button
      className="feed-friend-row"
      type="button"
      onClick={(event) => onOpenProfile(event, displayMember)}
      title={`Open ${friend.displayName} profile`}
    >
      <span className="feed-friend-avatar">
        <MemberAvatar member={displayMember} size={32} />
        <i className={`status-dot ${friend.status}`} />
      </span>
      <span className="feed-friend-copy">
        <strong>{friend.displayName}</strong>
        <small>{friend.statusText || getStatusLabel(friend.status)}</small>
      </span>
    </button>
  );
}

function FriendsStatusSection({
  friends,
  communities,
  onOpenProfile,
}: Pick<FeedCompanionRailProps, "friends" | "communities" | "onOpenProfile">) {
  const onlineFriends = friends.filter((friend) => friend.status !== "offline");
  const offlineFriends = friends.filter((friend) => friend.status === "offline");

  return (
    <section className="feed-rail-card friends-status-section" aria-label="Friend status">
      <header className="feed-rail-section-header">
        <div>
          <p className="eyebrow">Friends</p>
          <strong>{onlineFriends.length} online</strong>
        </div>
        <span>{offlineFriends.length} offline</span>
      </header>
      <div className="feed-friend-group">
        <small>Online</small>
        {onlineFriends.slice(0, 8).map((friend) => (
          <FriendStatusRow key={`online-${friend.userId}`} friend={friend} member={findMember(communities, friend.userId)} onOpenProfile={onOpenProfile} />
        ))}
      </div>
      <div className="feed-friend-group">
        <small>Offline</small>
        {offlineFriends.slice(0, 6).map((friend) => (
          <FriendStatusRow key={`offline-${friend.userId}`} friend={friend} member={findMember(communities, friend.userId)} onOpenProfile={onOpenProfile} />
        ))}
      </div>
    </section>
  );
}

function ActiveVoiceRoomsSection({ rooms, onOpenVoiceRoom }: { rooms: ActiveVoiceRoomSummary[]; onOpenVoiceRoom: (room: ActiveVoiceRoomSummary) => void }) {
  if (!rooms.length) return null;

  return (
    <section className="feed-rail-card" aria-label="Active voice rooms">
      <header className="feed-rail-section-header">
        <div><p className="eyebrow">Live now</p><strong>Active voice rooms</strong></div>
        <span>{rooms.length}</span>
      </header>
      <div className="upcoming-events-list">
        {rooms.slice(0, 5).map((room) => (
          <article className="upcoming-event-mini-card" key={`${room.communityId}:${room.channelId}`}>
            <span className="event-mini-icon"><AppIcon name={room.isPrivate ? "lock" : "voice"} size="sm" /></span>
            <div>
              <strong>{room.channelName}</strong>
              <small>{room.communityName} · {room.participantCount} connected</small>
              {room.participantNames.length ? <small>{room.participantNames.join(", ")}</small> : null}
            </div>
            <button className="event-mini-action" type="button" disabled={!room.canJoin} aria-label={room.canJoin ? `Open ${room.channelName} voice room` : room.joinBlockedReason} title={room.joinBlockedReason} onClick={() => onOpenVoiceRoom(room)}>
              <AppIcon name={room.canJoin ? "chevronRight" : "lock"} size="sm" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function UpcomingEventMiniCard({
  event,
  communityName,
  onOpenCommunity,
  onEventDetails,
  onToggleEventReminder,
}: {
  event: UpcomingEvent;
  communityName: string;
  onOpenCommunity: (communityId: string) => void;
  onEventDetails: (event: UpcomingEvent) => void;
  onToggleEventReminder: (event: UpcomingEvent) => void;
}) {
  return (
    <article className="upcoming-event-mini-card">
      <span className="event-mini-icon">
        <AppIcon name={event.source === "radio" ? "microphone" : getEventIcon(event.type)} size="sm" />
      </span>
      <div>
        <strong>{event.title}</strong>
        <button type="button" onClick={() => onOpenCommunity(event.communityId)}>
          {communityName}
        </button>
        <small>{dateTimeService.formatCompactDateTime(event.startsAt)} - {event.attendeeCount ?? 0} interested</small>
      </div>
      <span className="event-mini-actions">
        {event.source === "radio" ? <button className="event-mini-reminder" type="button" aria-label={event.reminderSet ? `Remove reminder for ${event.title}` : `Remind me about ${event.title}`} aria-pressed={event.reminderSet} onClick={() => onToggleEventReminder(event)}><AppIcon name="bell" size="sm" /></button> : null}
        <button className="event-mini-action" type="button" aria-label={`Open ${event.title} details`} onClick={() => onEventDetails(event)}>
          <AppIcon name="chevronRight" size="sm" />
        </button>
      </span>
    </article>
  );
}

function UpcomingEventsSection({
  events,
  communities,
  onOpenEventCommunity,
  onEventDetails,
  onToggleEventReminder,
}: Pick<FeedCompanionRailProps, "events" | "communities" | "onOpenEventCommunity" | "onEventDetails" | "onToggleEventReminder">) {
  return (
    <section className="feed-rail-card upcoming-events-section" aria-label="Upcoming events">
      <header className="feed-rail-section-header">
        <div>
          <p className="eyebrow">Upcoming</p>
          <strong>Events</strong>
        </div>
        <span>{events.length}</span>
      </header>
      <div className="upcoming-events-list">
        {events.map((event) => (
          <UpcomingEventMiniCard
            key={event.id}
            event={event}
            communityName={getCommunityName(communities, event.communityId)}
            onOpenCommunity={onOpenEventCommunity}
            onEventDetails={onEventDetails}
            onToggleEventReminder={onToggleEventReminder}
          />
        ))}
      </div>
    </section>
  );
}

export function FeedCompanionRail({
  voiceState,
  activeVoiceRooms,
  friends,
  events,
  communities,
  onToggleMute,
  onToggleDeafen,
  onLeaveVoice,
  onOpenVoiceRoom,
  onOpenScreenShare,
  onOpenProfile,
  onOpenEventCommunity,
  onEventDetails,
  onToggleEventReminder,
  audioItem,
  onCloseAudio,
}: FeedCompanionRailProps) {
  return (
    <aside className="feed-companion-rail" aria-label="Feed companion rail">
      <div className="feed-rail-sticky-stack">
        <AudioMiniPlayer item={audioItem ?? undefined} onClose={onCloseAudio} />
        <VoiceMiniControlCard
          voiceState={voiceState}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
          onLeaveVoice={onLeaveVoice}
          onOpenScreenShare={onOpenScreenShare}
        />
      </div>
      <ActiveVoiceRoomsSection rooms={activeVoiceRooms} onOpenVoiceRoom={onOpenVoiceRoom} />
      <FriendsStatusSection friends={friends} communities={communities} onOpenProfile={onOpenProfile} />
      <UpcomingEventsSection events={events} communities={communities} onOpenEventCommunity={onOpenEventCommunity} onEventDetails={onEventDetails} onToggleEventReminder={onToggleEventReminder} />
    </aside>
  );
}
