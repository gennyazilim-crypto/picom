import { useEffect, useRef, useState } from "react";
import type { Channel } from "../types/community";
import { resolveChannelSidebarIcon } from "../utils/channelSidebarIcon";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import "./ChatHeader.css";

const chatHeaderIcons = mvpUiIconMap.chatHeader;

type ChatHeaderProps = {
  channel: Channel;
  membersVisible: boolean;
  memberCount?: number;
  savedInChannelCount?: number;
  searchOpen: boolean;
  searchQuery: string;
  canEditTopic?: boolean;
  canInvite?: boolean;
  notificationsMuted?: boolean;
  onToggleMembers: () => void;
  onSearchOpen: () => void;
  onSearchChange: (value: string) => void;
  onEditTopic?: () => void;
  onOpenInvite?: () => void;
  onOpenSavedMessages?: () => void;
  onOpenMentionFeed?: () => void;
  onToggleNotifications?: () => void;
  announcementFollowing?: boolean;
  announcementReadOnly?: boolean;
  onToggleAnnouncementFollowing?: () => void;
};

const channelTypeLabels: Record<Channel["type"], string> = {
  text: "Text channel",
  voice: "Voice channel",
  forum: "Forum channel",
  announcement: "Announcements",
};

function getChannelDisplayName(channel: Channel) {
  if (channel.type === "text") return `#${channel.name}`;
  return channel.name;
}

export function ChatHeader({
  channel,
  membersVisible,
  memberCount,
  savedInChannelCount = 0,
  searchOpen,
  searchQuery,
  canEditTopic = false,
  canInvite = false,
  notificationsMuted = false,
  onToggleMembers,
  onSearchOpen,
  onSearchChange,
  onEditTopic,
  onOpenInvite,
  onOpenSavedMessages,
  onOpenMentionFeed,
  onToggleNotifications,
  announcementFollowing = false,
  announcementReadOnly = false,
  onToggleAnnouncementFollowing,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const channelIcon = resolveChannelSidebarIcon(channel);
  const topic = channel.topic?.trim() || "No topic set";

  useEffect(() => {
    setMenuOpen(false);
  }, [channel.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const copyChannelName = async () => {
    const label = getChannelDisplayName(channel);
    try {
      await navigator.clipboard.writeText(label);
    } catch {
      /* clipboard unavailable */
    }
    setMenuOpen(false);
  };

  return (
    <header className="chat-header">
      <div className="chat-header-inner">
        <div className="chat-header-primary">
          <span className="chat-header-icon" aria-hidden="true">
            <AppIcon name={channelIcon} size="md" />
          </span>
          <div className="chat-header-copy">
            <div className="chat-header-title-row">
              <strong>{getChannelDisplayName(channel)}</strong>
              <span className="chat-header-type-pill">{channelTypeLabels[channel.type]}</span>
            </div>
            <button
              type="button"
              className="chat-header-topic"
              title={canEditTopic ? "Edit channel topic" : topic}
              disabled={!canEditTopic || !onEditTopic}
              onClick={() => onEditTopic?.()}
            >
              {topic}
            </button>
          </div>
        </div>

        {searchOpen ? (
          <label className="chat-header-search">
            <AppIcon name="search" size="sm" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={`Search in ${getChannelDisplayName(channel)}`}
              aria-label={`Search in ${getChannelDisplayName(channel)}`}
            />
            {searchQuery ? (
              <button type="button" className="chat-header-search-clear" aria-label="Clear search" onClick={() => onSearchChange("")}>
                <AppIcon name="close" size="xs" />
              </button>
            ) : null}
          </label>
        ) : null}

        <div className="chat-header-actions">
          {channel.type === "announcement" ? (
            <button
              type="button"
              className={`chat-header-follow ${announcementFollowing ? "active" : ""}`}
              aria-pressed={announcementFollowing}
              disabled={!onToggleAnnouncementFollowing}
              title={announcementReadOnly ? "Join the community to follow announcements" : undefined}
              onClick={onToggleAnnouncementFollowing}
            >
              <AppIcon name="bell" size="sm" />
              {announcementFollowing ? "Following" : "Follow"}
            </button>
          ) : null}

          <button
            type="button"
            className={`chat-header-action ${savedInChannelCount ? "has-badge" : ""}`}
            aria-label={savedInChannelCount ? `Open ${savedInChannelCount} saved messages in this channel` : "Open saved messages"}
            title="Saved messages"
            onClick={onOpenSavedMessages}
            disabled={!onOpenSavedMessages}
          >
            <AppIcon name={chatHeaderIcons.pinned} size="sm" />
            {savedInChannelCount ? <span className="chat-header-badge">{savedInChannelCount}</span> : null}
          </button>

          <button
            type="button"
            className={`chat-header-action ${notificationsMuted ? "active" : ""}`}
            aria-label={notificationsMuted ? "Unmute channel notifications" : "Mute channel notifications"}
            aria-pressed={notificationsMuted}
            title={notificationsMuted ? "Notifications muted" : "Mute notifications"}
            onClick={onToggleNotifications}
            disabled={!onToggleNotifications}
          >
            <AppIcon name={chatHeaderIcons.notifications} size="sm" />
          </button>

          <button
            type="button"
            className="chat-header-action"
            aria-label="Open mention feed"
            title="Mention feed"
            onClick={onOpenMentionFeed}
            disabled={!onOpenMentionFeed}
          >
            <AppIcon name={chatHeaderIcons.inbox} size="sm" />
          </button>

          <button
            type="button"
            className={`chat-header-action ${membersVisible ? "active" : ""}`}
            aria-label={membersVisible ? "Hide member sidebar" : "Show member sidebar"}
            aria-pressed={membersVisible}
            title={memberCount ? `${membersVisible ? "Hide" : "Show"} members (${memberCount})` : membersVisible ? "Hide member sidebar" : "Show member sidebar"}
            onClick={onToggleMembers}
          >
            <AppIcon name={chatHeaderIcons.members} size="sm" />
          </button>

          <button
            type="button"
            className={`chat-header-action ${searchOpen ? "active" : ""}`}
            aria-label={searchOpen ? "Close channel search" : "Search this channel"}
            aria-pressed={searchOpen}
            title={searchOpen ? "Close search" : "Search channel"}
            onClick={onSearchOpen}
          >
            <AppIcon name={searchOpen ? "close" : chatHeaderIcons.search} size="sm" />
          </button>

          <div className="chat-header-menu" ref={menuRef}>
            <button
              type="button"
              className={`chat-header-action ${menuOpen ? "active" : ""}`}
              aria-label="Channel options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Channel options"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <AppIcon name={chatHeaderIcons.more} size="sm" />
            </button>
            {menuOpen ? (
              <div className="chat-header-menu-panel" role="menu">
                {canEditTopic && onEditTopic ? (
                  <button type="button" role="menuitem" onClick={() => { onEditTopic(); setMenuOpen(false); }}>
                    <AppIcon name="edit" size="sm" />
                    Edit topic
                  </button>
                ) : null}
                {canInvite && onOpenInvite ? (
                  <button type="button" role="menuitem" onClick={() => { onOpenInvite(); setMenuOpen(false); }}>
                    <AppIcon name="plus" size="sm" />
                    Create invite
                  </button>
                ) : null}
                <button type="button" role="menuitem" onClick={() => void copyChannelName()}>
                  <AppIcon name="hash" size="sm" />
                  Copy channel name
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
