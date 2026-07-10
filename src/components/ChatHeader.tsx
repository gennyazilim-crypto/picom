import type { Channel } from "../types/community";
import type { RealtimeConnectionStatus } from "../hooks/useSupabaseMessageRealtime";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const chatHeaderIcons = mvpUiIconMap.chatHeader;
const channelIcons = mvpUiIconMap.communitySidebar;

type ChatHeaderProps = {
  channel: Channel;
  realtimeStatus: RealtimeConnectionStatus;
  membersVisible: boolean;
  onToggleMembers: () => void;
  announcementFollowing?: boolean;
  announcementReadOnly?: boolean;
  onToggleAnnouncementFollowing?: () => void;
};

const realtimeLabels: Record<RealtimeConnectionStatus, string> = {
  idle: "Realtime idle",
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

export function ChatHeader({ channel, realtimeStatus, membersVisible, onToggleMembers, announcementFollowing = false, announcementReadOnly = false, onToggleAnnouncementFollowing }: ChatHeaderProps) {
  const channelIcon = channel.type === "voice" ? channelIcons.voiceChannel : channel.type === "announcement" ? "bell" : channel.type === "forum" ? "inbox" : channelIcons.textChannel;
  return (
    <header className="chat-header">
      <div className="chat-title">
        <AppIcon name={channelIcon} size="lg" />
        <div>
          <strong>{channel.name}</strong>
          <span>{channel.topic ?? "Picom desktop channel"}</span>
        </div>
      </div>
      <div className="chat-actions">
        {channel.type === "announcement" ? <button type="button" className={`announcement-follow-button ${announcementFollowing ? "active" : ""}`} aria-pressed={announcementFollowing} disabled={!onToggleAnnouncementFollowing} title={announcementReadOnly ? "Join the community to follow announcements" : undefined} onClick={onToggleAnnouncementFollowing}><AppIcon name="bell" size="sm" />{announcementFollowing ? "Following" : "Follow"}</button> : null}
        <span className={`realtime-pill ${realtimeStatus}`} title={`Realtime status: ${realtimeLabels[realtimeStatus]}`}>
          <span aria-hidden="true" />
          {realtimeLabels[realtimeStatus]}
        </span>
        <button className="icon-button" aria-label="Pinned">
          <AppIcon name={chatHeaderIcons.pinned} />
        </button>
        <button className="icon-button" aria-label="Notifications">
          <AppIcon name={chatHeaderIcons.notifications} />
        </button>
        <button className="icon-button" aria-label="Inbox">
          <AppIcon name={chatHeaderIcons.inbox} />
        </button>
        <button
          className={`icon-button ${membersVisible ? "active" : ""}`}
          aria-label={membersVisible ? "Hide member sidebar" : "Show member sidebar"}
          aria-pressed={membersVisible}
          title={membersVisible ? "Hide member sidebar" : "Show member sidebar"}
          onClick={onToggleMembers}
        >
          <AppIcon name={chatHeaderIcons.members} />
        </button>
        <button className="icon-button" aria-label="Search">
          <AppIcon name={chatHeaderIcons.search} />
        </button>
        <button className="icon-button" aria-label="More">
          <AppIcon name={chatHeaderIcons.more} />
        </button>
      </div>
    </header>
  );
}
