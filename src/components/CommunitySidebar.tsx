import { useState } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { CommunityHeader } from "./CommunityHeader";
import { ChannelCategory } from "./ChannelCategory";
import { UserMiniCard } from "./UserMiniCard";

type CommunitySidebarProps = {
  community: Community;
  activeChannelId: string;
  currentUser: Member;
  onSelectChannel: (channel: Channel) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
};

export function CommunitySidebar({ community, activeChannelId, currentUser, onSelectChannel, onOpenSettings, onLogout, onChannelContextMenu }: CommunitySidebarProps) {
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

      <UserMiniCard member={currentUser} onOpenSettings={onOpenSettings} onLogout={onLogout} />
    </aside>
  );
}
