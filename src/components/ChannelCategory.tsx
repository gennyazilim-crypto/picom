import type { MouseEvent } from "react";
import type { Channel, ChannelCategory as ChannelCategoryType } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { ChannelItem } from "./ChannelItem";

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
            <ChannelItem
              key={channel.id}
              channel={channel}
              active={channel.id === activeChannelId}
              onSelect={onSelectChannel}
              onContextMenu={onChannelContextMenu}
            />
          ))
        : null}
    </section>
  );
}
