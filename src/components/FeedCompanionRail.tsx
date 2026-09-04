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
import { useProfileDisplayName, useProfileUsername } from "./ProfileDisplayName";
import { AudioMiniPlayer } from "./audio/AudioMiniPlayer";
import { NoiseShieldCompactStatus } from "./voice/NoiseShieldControl";
import { isV1FeatureEnabled } from "../config/v1ReleaseScope";
import { useProfileMedia } from "../hooks/useProfileMedia";
import { FriendRecommendationsRail } from "./FriendRecommendationsRail";

type FeedCompanionRailProps = {
  voiceState: VoiceServiceSnapshot;
  activeVoiceRooms: ActiveVoiceRoomSummary[];
  friends: FriendConnection[];
  currentUserId: string;
  pendingFriendRequestCount: number;
  events: UpcomingEvent[];
  communities: Community[];
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenScreenShare: () => void;
  onOpenFriendProfile: (member: Member) => void;
  onFriendContextMenu: (event: MouseEvent, member: Member) => void;
  onOpenFriends: () => void;
  onSendFriendRequest: (userId: string) => boolean | Promise<boolean>;
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
  if (!isV1FeatureEnabled("voiceRooms") || (voiceState.status !== "connected" && voiceState.status !== "reconnecting")) return null;

  return (
    <section className="voice-mini-card" aria-label="Current voice room controls">
      <header>
        <span className="voice-mini-icon">
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
          Live
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
        <button type="button" aria-label={voiceState.screenSharing ? "Open active screen share controls" : "Open screen share controls"} aria-pressed={voiceState.screenSharing} onClick={onOpenScreenShare}>
          <AppIcon name="image" size="sm" />
        </button>
        <button type="button" className="voice-mini-leave" aria-label="Leave voice room" onClick={onLeaveVoice}>
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </section>
  );
}

function toFriendMember(friend: FriendConnection, member?: Member): Member {
  const avatarUrl = [friend.avatarUrl, member?.avatarUrl].find((value) => typeof value === "string" && value.trim().length > 0);
  if (member) {
    return {
      ...member,
      displayName: friend.displayName || member.displayName,
      username: friend.username || member.username,
      avatarUrl,
      status: friend.status,
      statusText: friend.statusText || member.statusText,
    };
  }
  return {
    id: friend.id ?? `friend-${friend.userId}`,
    userId: friend.userId,
    displayName: friend.displayName,
    username: friend.username,
    avatarSeed: friend.username,
    avatarUrl,
    status: friend.status,
    statusText: friend.statusText,
    roleId: "member",
  };
}

function FriendStatusRow({
  friend,
  member,
  onOpenFriendProfile,
  onFriendContextMenu,
}: {
  friend: FriendConnection;
  member?: Member;
  onOpenFriendProfile: (member: Member) => void;
  onFriendContextMenu: (event: MouseEvent, member: Member) => void;
}) {
  const displayName = useProfileDisplayName(friend.userId, friend.displayName);
  const username = useProfileUsername(friend.userId, friend.username);
  const profileMedia = useProfileMedia(friend.userId);
  const fallbackMember = toFriendMember(friend, member);
  const avatarUrl = profileMedia.record?.avatar.thumbnailUrl ?? profileMedia.record?.avatar.url ?? fallbackMember.avatarUrl;
  const displayMember = { ...fallbackMember, displayName, username, avatarUrl };

  return (
    <button
      className="feed-friend-row"
      type="button"
      onClick={() => onOpenFriendProfile(displayMember)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onFriendContextMenu(event, displayMember);
      }}
      title={`Open ${displayName} profile`}
      aria-label={`Open ${displayName} profile`}
    >
      <span className="feed-friend-avatar">
        <MemberAvatar
          member={displayMember}
          userId={friend.userId}
          label={displayName}
          avatarUrl={displayMember.avatarUrl}
          size={32}
        />
        <i className={`status-dot ${friend.status}`} />
      </span>
      <span className="feed-friend-copy">
        <strong>{displayName}</strong>
        <small>{friend.statusText || getStatusLabel(friend.status)}</small>
      </span>
    </button>
  );
}

function FriendsStatusSection({
  friends,
  pendingFriendRequestCount,
  communities,
  onOpenFriendProfile,
  onFriendContextMenu,
  onOpenFriends,
}: Pick<FeedCompanionRailProps, "friends" | "pendingFriendRequestCount" | "communities" | "onOpenFriendProfile" | "onFriendContextMenu" | "onOpenFriends">) {
  const onlineFriends = friends.filter((friend) => friend.status !== "offline");
  const offlineFriends = friends.filter((friend) => friend.status === "offline");

  return (
    <section className="feed-rail-card friends-status-section" aria-label="Friend status">
      <header className="feed-rail-section-header">
        <div>
          <p className="eyebrow">Friends</p>
        </div>
        <span>{onlineFriends.length} online</span>
      </header>
      {friends.length ? (
        <>
          <div className="feed-friend-group">
            <small>Online</small>
            {onlineFriends.slice(0, 8).map((friend) => (
              <FriendStatusRow key={`online-${friend.userId}`} friend={friend} member={findMember(communities, friend.userId)} onOpenFriendProfile={onOpenFriendProfile} onFriendContextMenu={onFriendContextMenu} />
            ))}
          </div>
          <div className="feed-friend-group">
            <small>Offline</small>
            {offlineFriends.slice(0, 6).map((friend) => (
              <FriendStatusRow key={`offline-${friend.userId}`} friend={friend} member={findMember(communities, friend.userId)} onOpenFriendProfile={onOpenFriendProfile} onFriendContextMenu={onFriendContextMenu} />
            ))}
          </div>
        </>
      ) : (
        <div className="feed-friend-empty">
          <p>{pendingFriendRequestCount > 0 ? `${pendingFriendRequestCount} friend request${pendingFriendRequestCount === 1 ? "" : "s"} waiting.` : "No accepted friends yet."}</p>
          <button type="button" onClick={onOpenFriends}>{pendingFriendRequestCount > 0 ? "Review requests" : "Open Friends"}</button>
        </div>
      )}
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
  currentUserId,
  pendingFriendRequestCount,
  events,
  communities,
  onToggleMute,
  onToggleDeafen,
  onLeaveVoice,
  onOpenScreenShare,
  onOpenFriendProfile,
  onFriendContextMenu,
  onOpenFriends,
  onSendFriendRequest,
  onOpenEventCommunity,
  onEventDetails,
  onToggleEventReminder,
  audioItem,
  onCloseAudio,
}: FeedCompanionRailProps) {
  // Connected Voice sticky follows LiveKit session status. Do not gate on discovery
  // occupancy or roomContext presence — both can lag after join/hydration.
  const voiceConnected = isV1FeatureEnabled("voiceRooms")
    && (voiceState.status === "connected" || voiceState.status === "reconnecting");
  const showStickyStack = Boolean(audioItem) || voiceConnected;
  void activeVoiceRooms;

  return (
    <aside className="feed-companion-rail" aria-label="Feed companion rail">
      <FriendsStatusSection friends={friends} pendingFriendRequestCount={pendingFriendRequestCount} communities={communities} onOpenFriendProfile={onOpenFriendProfile} onFriendContextMenu={onFriendContextMenu} onOpenFriends={onOpenFriends} />
      <FriendRecommendationsRail currentUserId={currentUserId} friends={friends} pendingFriendRequestCount={pendingFriendRequestCount} onOpenProfile={onOpenFriendProfile} onSendFriendRequest={onSendFriendRequest} />
      <UpcomingEventsSection events={events} communities={communities} onOpenEventCommunity={onOpenEventCommunity} onEventDetails={onEventDetails} onToggleEventReminder={onToggleEventReminder} />
      {showStickyStack ? (
        <div className="feed-rail-sticky-stack">
          <AudioMiniPlayer item={audioItem ?? undefined} onClose={onCloseAudio} />
          {voiceConnected ? (
            <VoiceMiniControlCard
              voiceState={voiceState}
              onToggleMute={onToggleMute}
              onToggleDeafen={onToggleDeafen}
              onLeaveVoice={onLeaveVoice}
              onOpenScreenShare={onOpenScreenShare}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
