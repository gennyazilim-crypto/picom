import { useState } from "react";
import type { MouseEvent } from "react";
import { useEffect } from "react";
import type { Channel, Community, Member } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import { canManageChannels } from "../services/permissions/communityPermissions";
import { CommunityHeader } from "./CommunityHeader";
import { ChannelCategory } from "./ChannelCategory";
import { UserMiniCard } from "./UserMiniCard";
import { CommunityOnboardingChecklist } from "./CommunityOnboardingChecklist";
import { CommunityOwnershipTransferPanel } from "./CommunityOwnershipTransferPanel";
import { CommunityDeleteSafetyPanel } from "./CommunityDeleteSafetyPanel";
import { CommunityCategoryManagementPanel } from "./CommunityCategoryManagementPanel";
import { MessageModerationFiltersPanel } from "./MessageModerationFiltersPanel";
import { CommunityAdminPanel, CommunityJoinModal, CommunityLeaveModal, CommunityMemberPanel, CommunityModeratorPanel, CommunityVisitorPanel } from "./CommunityMenu";
import { InvitePeopleModal, JoinWithInviteModal } from "./CommunityInviteModals";

type CommunitySidebarProps = {
  community: Community;
  communities: Community[];
  access: CommunityAccess;
  activeChannelId: string;
  currentUser: Member;
  isAuthenticated: boolean;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: (categoryId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void;
  onJoinCommunity: () => void | Promise<void>;
  onLeaveCommunity: () => void | Promise<void>;
  pendingInviteCode?: string | null;
  onClearPendingInviteCode: () => void;
  onInviteAccepted: (communityId: string, member: Member) => void;
  onPlaceholderAction: (message: string) => void;
};

type OpenCommunityPanel = "admin" | "moderator" | "member" | "visitor" | "join" | "leave" | "invite" | "joinInvite" | null;

export function CommunitySidebar({ community, communities, access, activeChannelId, currentUser, isAuthenticated, onSelectChannel, onCreateChannel, onOpenSettings, onLogout, onChannelContextMenu, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveChannel, onJoinCommunity, onLeaveCommunity, pendingInviteCode, onClearPendingInviteCode, onInviteAccepted, onPlaceholderAction }: CommunitySidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(community.categories.map((category) => [category.id, Boolean(category.collapsedByDefault)])),
  );
  const [openPanel, setOpenPanel] = useState<OpenCommunityPanel>(null);
  useEffect(() => { if (pendingInviteCode) setOpenPanel("joinInvite"); }, [pendingInviteCode]);
  const canReorderChannels = canManageChannels(access);
  const adminTools = (
    <div className="community-admin-tools-stack">
      <CommunityOnboardingChecklist community={community} currentUserId={currentUser.userId} />
      <CommunityCategoryManagementPanel community={community} currentUser={currentUser} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />
      <MessageModerationFiltersPanel community={community} currentUser={currentUser} />
      {access.isOwner ? <CommunityOwnershipTransferPanel community={community} currentUser={currentUser} /> : null}
      {access.isOwner ? <CommunityDeleteSafetyPanel community={community} currentUser={currentUser} /> : null}
    </div>
  );

  return (
    <aside className="community-sidebar">
      <CommunityHeader
        community={community}
        access={access}
        onOpenAdminPanel={() => setOpenPanel("admin")}
        onOpenModeratorPanel={() => setOpenPanel("moderator")}
        onOpenMemberPanel={() => setOpenPanel(access.isVisitor ? "visitor" : "member")}
        onOpenVisitorPanel={() => setOpenPanel("visitor")}
        onOpenJoinCommunity={() => setOpenPanel("join")}
        onOpenLeaveCommunity={() => setOpenPanel("leave")}
        onPlaceholderAction={onPlaceholderAction}
      />

      <div className="channel-scroll">
        {access.isVisitor ? (
          <div className="community-readonly-notice">
            <strong>Viewing public content</strong>
            <span>Join this community to send messages, react, upload, and see member-only spaces.</span>
          </div>
        ) : null}

        {community.categories.length ? community.categories.map((category) => (
          <ChannelCategory
            key={category.id}
            category={category}
            collapsed={Boolean(collapsed[category.id])}
            activeChannelId={activeChannelId}
            onToggle={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
            onCreateChannel={onCreateChannel}
            onSelectChannel={onSelectChannel}
            onChannelContextMenu={onChannelContextMenu}
            canCreateChannel={canReorderChannels}
            showReorderControls={canReorderChannels}
            onMoveChannel={onMoveChannel}
          />
        )) : <div className="empty-state compact">No public channels are visible.</div>}
      </div>

      <UserMiniCard member={currentUser} onOpenSettings={onOpenSettings} onLogout={onLogout} />

      {openPanel === "admin" ? <CommunityAdminPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} adminTools={adminTools} /> : null}
      {openPanel === "moderator" ? <CommunityModeratorPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} /> : null}
      {openPanel === "member" ? <CommunityMemberPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenLeave={() => setOpenPanel("leave")} onOpenInvite={() => setOpenPanel("invite")} /> : null}
      {openPanel === "visitor" ? <CommunityVisitorPanel community={community} access={access} isAuthenticated={isAuthenticated} onClose={() => setOpenPanel(null)} onOpenJoin={() => setOpenPanel("join")} onOpenJoinWithInvite={() => setOpenPanel("joinInvite")} /> : null}
      {openPanel === "join" ? <CommunityJoinModal community={community} isAuthenticated={isAuthenticated} onClose={() => setOpenPanel(null)} onConfirm={async () => { await onJoinCommunity(); setOpenPanel(null); }} /> : null}
      {openPanel === "leave" ? <CommunityLeaveModal community={community} access={access} onClose={() => setOpenPanel(null)} onConfirm={async () => { await onLeaveCommunity(); setOpenPanel(null); }} /> : null}
      {openPanel === "invite" ? <InvitePeopleModal community={community} currentUserId={currentUser.userId} canCreate={access.permissions.includes("createInvites")} onClose={() => setOpenPanel(null)} /> : null}
      {openPanel === "joinInvite" ? <JoinWithInviteModal initialCode={pendingInviteCode ?? ""} isAuthenticated={isAuthenticated} communities={communities} currentUser={currentUser} onClose={() => { setOpenPanel(null); onClearPendingInviteCode(); }} onAccepted={onInviteAccepted} /> : null}
    </aside>
  );
}
