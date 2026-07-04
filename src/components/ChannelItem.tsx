import type { MouseEvent } from "react";
import type { Channel } from "../types/community";
import { formatMentionBadge, normalizeMentionCount } from "../utils/mentionUtils";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type ChannelItemProps = {
  channel: Channel;
  active: boolean;
  onSelect: (channel: Channel) => void;
  onContextMenu: (event: MouseEvent, channel: Channel) => void;
};

export function ChannelItem({ channel, active, onSelect, onContextMenu }: ChannelItemProps) {
  const icon = channel.type === "voice" ? sidebarIcons.voiceChannel : sidebarIcons.textChannel;
  const mentionCount = normalizeMentionCount(channel.mentions);
  const mentionLabel = formatMentionBadge(mentionCount);

  return (
    <button
      className={`channel-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(channel)}
      onContextMenu={(event) => onContextMenu(event, channel)}
    >
      <AppIcon name={icon} size="sm" />
      <span className="channel-name">{channel.name}</span>
      {channel.isPrivate ? <AppIcon name={sidebarIcons.privateChannel} size="xs" /> : null}
      {channel.unread ? <span className="channel-unread" aria-label="Unread channel" /> : null}
      {mentionCount ? (
        <span className="mention-badge" aria-label={`${mentionCount} mention${mentionCount === 1 ? "" : "s"}`} title={`${mentionCount} mention${mentionCount === 1 ? "" : "s"}`}>
          {mentionLabel}
        </span>
      ) : null}
    </button>
  );
}
