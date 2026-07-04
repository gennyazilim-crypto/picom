import type { MouseEvent } from "react";
import type { Channel, ChannelCategory as ChannelCategoryType } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type ChannelCategoryProps = {
  category: ChannelCategoryType;
  collapsed: boolean;
  activeChannelId: string;
  onToggle: () => void;
  onSelectChannel: (channel: Channel) => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
};

export function ChannelCategory({
  category,
  collapsed,
  activeChannelId,
  onToggle,
  onSelectChannel,
  onChannelContextMenu,
}: ChannelCategoryProps) {
  return (
    <section className="channel-category">
      <button className="category-header" onClick={onToggle} aria-expanded={!collapsed}>
        <AppIcon name={collapsed ? sidebarIcons.collapse : sidebarIcons.expand} size="xs" />
        <strong>{category.name}</strong>
        <em>{category.channels.length}</em>
      </button>
      {!collapsed
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
  );
}
