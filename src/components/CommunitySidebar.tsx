import { useState } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { CommunityHeader } from "./CommunityHeader";
import { ChannelCategory } from "./ChannelCategory";
import { UserMiniCard } from "./UserMiniCard";
import { CommunityOnboardingChecklist } from "./CommunityOnboardingChecklist";
import { CommunityOwnershipTransferPanel } from "./CommunityOwnershipTransferPanel";
import { CommunityDeleteSafetyPanel } from "./CommunityDeleteSafetyPanel";
import { CommunityCategoryManagementPanel } from "./CommunityCategoryManagementPanel";
import { MessageModerationFiltersPanel } from "./MessageModerationFiltersPanel";

type CommunitySidebarProps = {
  community: Community;
  activeChannelId: string;
  currentUser: Member;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: (categoryId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void;
};

export function CommunitySidebar({ community, activeChannelId, currentUser, onSelectChannel, onCreateChannel, onOpenSettings, onLogout, onChannelContextMenu, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveChannel }: CommunitySidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(community.categories.map((category) => [category.id, Boolean(category.collapsedByDefault)])),
  );
  const currentRole = community.roles.find((role) => role.id === currentUser.roleId);
  const canViewOnboardingChecklist = Boolean(currentRole && (currentRole.name === "Owner" || currentRole.name === "Admin" || currentRole.level >= 80));
  const canReorderChannels = canViewOnboardingChecklist;

  return (
    <aside className="community-sidebar">
      <CommunityHeader community={community} onOpenMenu={onOpenSettings} />

      <div className="channel-scroll">
        {canViewOnboardingChecklist ? <CommunityOnboardingChecklist community={community} currentUserId={currentUser.userId} /> : null}
        <CommunityOwnershipTransferPanel community={community} currentUser={currentUser} />
        <CommunityDeleteSafetyPanel community={community} currentUser={currentUser} />
        <CommunityCategoryManagementPanel community={community} currentUser={currentUser} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />
        <MessageModerationFiltersPanel community={community} currentUser={currentUser} />

        {community.categories.map((category) => (
          <ChannelCategory
            key={category.id}
            category={category}
            collapsed={Boolean(collapsed[category.id])}
            activeChannelId={activeChannelId}
            onToggle={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
            onCreateChannel={onCreateChannel}
            onSelectChannel={onSelectChannel}
            onChannelContextMenu={onChannelContextMenu}
            showReorderControls={canReorderChannels}
            onMoveChannel={onMoveChannel}
          />
        ))}
      </div>

      <UserMiniCard member={currentUser} onOpenSettings={onOpenSettings} onLogout={onLogout} />
    </aside>
  );
}
