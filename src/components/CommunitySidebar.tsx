import { useState } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";
import { CommunityHeader } from "./CommunityHeader";
import { ChannelCategory } from "./ChannelCategory";

const sidebarIcons = mvpUiIconMap.communitySidebar;
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
      <CommunityHeader community={community} onOpenMenu={onOpenSettings} />

      <div className="channel-scroll">
        {community.categories.map((category) => (
          <ChannelCategory
            key={category.id}
            category={category}
            collapsed={Boolean(collapsed[category.id])}
            activeChannelId={activeChannelId}
            onToggle={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
            onSelectChannel={onSelectChannel}
            onChannelContextMenu={onChannelContextMenu}
          />
        ))}
      </div>

      <footer className="user-mini-card">
        <MemberAvatar member={currentUser} size={38} />
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
