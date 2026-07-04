import { useState } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const sidebarIcons = mvpUiIconMap.communitySidebar;
const avatarPalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"];
const hash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

function MiniAvatar({ member, size = 38 }: { member: Member; size?: number }) {
  const color = avatarPalette[hash(member.displayName) % avatarPalette.length];
  const initials = member.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className="generated-avatar"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))` }}
    >
      {initials}
    </span>
  );
}

type CommunitySidebarProps = {
  community: Community;
  activeChannelId: string;
  currentUser: Member;
  onSelectChannel: (channel: Channel) => void;
  onOpenSettings: () => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
};

export function CommunitySidebar({ community, activeChannelId, currentUser, onSelectChannel, onOpenSettings, onChannelContextMenu }: CommunitySidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(community.categories.map((category) => [category.id, Boolean(category.collapsedByDefault)])),
  );

  return (
    <aside className="community-sidebar">
      <header className="community-header">
        <div className="community-mark" style={{ background: community.accentColor }}>{community.icon}</div>
        <div>
          <strong>{community.name}</strong>
          <span>Desktop community</span>
        </div>
        <button className="icon-button" aria-label="Community menu">
          <AppIcon name={sidebarIcons.expand} size="sm" />
        </button>
      </header>

      <div className="channel-scroll">
        {community.categories.map((category) => (
          <section className="channel-category" key={category.id}>
            <button
              className="category-header"
              onClick={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
            >
              <AppIcon name={collapsed[category.id] ? sidebarIcons.collapse : sidebarIcons.expand} size="xs" />
              <strong>{category.name}</strong>
              <em>{category.channels.length}</em>
            </button>
            {!collapsed[category.id]
              ? category.channels.map((channel) => (
                  <button
                    key={channel.id}
                    className={`channel-item ${channel.id === activeChannelId ? "active" : ""}`}
                    onClick={() => onSelectChannel(channel)}
                    onContextMenu={(event) => onChannelContextMenu(event, channel)}
                  >
                    <AppIcon name={channel.type === "voice" ? sidebarIcons.voiceChannel : sidebarIcons.textChannel} size="sm" />
                    <span className="channel-name">{channel.name}</span>
                    {channel.isPrivate ? <AppIcon name={sidebarIcons.privateChannel} size="xs" /> : null}
                    {channel.unread ? <span className="channel-unread" /> : null}
                    {channel.mentions ? <span className="mention-badge">{channel.mentions}</span> : null}
                  </button>
                ))
              : null}
          </section>
        ))}
      </div>

      <footer className="user-mini-card">
        <MiniAvatar member={currentUser} size={38} />
        <button className="user-mini-main" onClick={onOpenSettings}>
          <strong>{currentUser.displayName}</strong>
          <span>{currentUser.statusText}</span>
        </button>
        <button className="mini-action" aria-label="Mute">
          <AppIcon name={sidebarIcons.mute} size="sm" />
        </button>
        <button className="mini-action" aria-label="Deafen">
          <AppIcon name={sidebarIcons.deafen} size="sm" />
        </button>
        <button className="mini-action" aria-label="Settings" onClick={onOpenSettings}>
          <AppIcon name={sidebarIcons.settings} size="sm" />
        </button>
      </footer>
    </aside>
  );
}