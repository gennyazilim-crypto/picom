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
  onCreateChannel: (categoryId: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
  showReorderControls?: boolean;
  onMoveChannel?: (categoryId: string, channelId: string, direction: "up" | "down") => void;
};

export function ChannelCategory({
  category,
  collapsed,
  activeChannelId,
  onToggle,
  onCreateChannel,
  onSelectChannel,
  onChannelContextMenu,
  showReorderControls = false,
  onMoveChannel,
}: ChannelCategoryProps) {
  return (
    <section className="channel-category">
      <div className="category-header-row">
        <button className="category-header" onClick={onToggle} aria-expanded={!collapsed}>
          <AppIcon name={collapsed ? sidebarIcons.collapse : sidebarIcons.expand} size="xs" />
          <strong>{category.name}</strong>
          <em>{category.channels.length}</em>
        </button>
        <button className="category-add-button" type="button" aria-label={`Create channel in ${category.name}`} onClick={() => onCreateChannel(category.id)}>
          <AppIcon name="plus" size="xs" />
        </button>
      </div>
      {!collapsed
        ? category.channels.map((channel, index) => (
            <div className="channel-reorder-row" key={channel.id}>
              <ChannelItem
                channel={channel}
                active={channel.id === activeChannelId}
                onSelect={onSelectChannel}
                onContextMenu={onChannelContextMenu}
              />
              {showReorderControls ? (
                <span className="channel-reorder-controls" aria-label={`Reorder ${channel.name}`}>
                  <button className="channel-reorder-up" type="button" disabled={index === 0} onClick={() => onMoveChannel?.(category.id, channel.id, "up")} aria-label={`Move ${channel.name} up`}>
                    <AppIcon name="chevronDown" size="xs" />
                  </button>
                  <button className="channel-reorder-down" type="button" disabled={index === category.channels.length - 1} onClick={() => onMoveChannel?.(category.id, channel.id, "down")} aria-label={`Move ${channel.name} down`}>
                    <AppIcon name="chevronDown" size="xs" />
                  </button>
                </span>
              ) : null}
            </div>
          ))
        : null}
    </section>
  );
}
