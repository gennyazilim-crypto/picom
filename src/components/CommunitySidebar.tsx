import { useState } from "react";
import type { MouseEvent } from "react";
import { lazy, Suspense } from "react";
import { useEffect } from "react";
import type { Channel, Community, Member } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { CommunityRulesAcceptanceInput } from "../types/communityRules";
import { canManageChannels } from "../services/permissions/communityPermissions";
import { CommunityHeader } from "./CommunityHeader";
import { ChannelCategory } from "./ChannelCategory";
import { UserMiniCard } from "./UserMiniCard";
import { CommunityAdminPanel, CommunityJoinModal, CommunityLeaveModal, CommunityMemberPanel, CommunityModeratorPanel, CommunityVisitorPanel } from "./CommunityMenu";
import type { CreateCommunityEventInput, UpdateCommunityEventInput } from "../services/communityEventService";
import type { UpcomingEvent } from "../types/events";
import { InvitePeopleModal, JoinWithInviteModal } from "./CommunityInviteModals";
import type { InviteAcceptanceStatus } from "../services/community/communityInviteService";
import { ReportModal } from "./ReportModal";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import { AppIcon } from "./AppIcon";
import { CommunityOwnershipTransferPanel } from "./CommunityOwnershipTransferPanel";
import { getCommunityKindInviteSummary } from "../services/community/communityJoinRoutingService";

const CommunityAdminDeferredSection = lazy(() => import("./CommunityAdminDeferredSection").then((module) => ({ default: module.CommunityAdminDeferredSection })));

type CommunitySidebarProps = {
  community: Community;
  communities: Community[];
  access: CommunityAccess;
  activeChannelId: string;
  currentUser: Member;
  isAuthenticated: boolean;
  onSelectChannel: (channel: Channel) => void;
  audioActive: boolean;
  onOpenAudio: () => void;
  onCreateChannel: (categoryId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void;
  onJoinCommunity: (acceptance: CommunityRulesAcceptanceInput | null) => Promise<boolean>;
  onLeaveCommunity: () => void | Promise<void>;
  pendingInviteCode?: string | null;
  onClearPendingInviteCode: () => void;
  onInviteAccepted: (communityId: string, member: Member, status: InviteAcceptanceStatus, preview: import("../services/community/communityInviteService").CommunityInvitePreview) => void | Promise<void>;
  onAssignMemberRole: (memberId: string, roleId: string) => void;
  onCommunityUpdated: (community: import("../services/communityService").CommunitySummary) => void;
  onPlaceholderAction: (message: string) => void;
  events: UpcomingEvent[];
  onCreateEvent: (input: CreateCommunityEventInput) => void;
  onUpdateEvent: (eventId: string, input: UpdateCommunityEventInput) => void;
  onCancelEvent: (eventId: string) => void;
};

type OpenCommunityPanel = "admin" | "moderator" | "member" | "visitor" | "join" | "leave" | "invite" | "joinInvite" | "report" | null;

export function CommunitySidebar({ community, communities, access, activeChannelId, currentUser, isAuthenticated, onSelectChannel, audioActive, onOpenAudio, onCreateChannel, onOpenSettings, onLogout, onChannelContextMenu, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveChannel, onJoinCommunity, onLeaveCommunity, pendingInviteCode, onClearPendingInviteCode, onInviteAccepted, onAssignMemberRole, onCommunityUpdated, onPlaceholderAction, events, onCreateEvent, onUpdateEvent, onCancelEvent }: CommunitySidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(community.categories.map((category) => [category.id, Boolean(category.collapsedByDefault)])),
  );
  const [openPanel, setOpenPanel] = useState<OpenCommunityPanel>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const kindSummary = getCommunityKindInviteSummary(community.kind);
  useEffect(() => { if (pendingInviteCode) setOpenPanel("joinInvite"); }, [pendingInviteCode]);
  const canReorderChannels = canManageChannels(access);
  const deferredAdminSection = (section: import("./CommunityAdminDeferredSection").CommunityAdminDeferredSectionId) => (
    <Suspense fallback={<div className="empty-state compact" role="status">Opening admin tools...</div>}>
      <CommunityAdminDeferredSection section={section} community={community} currentUser={currentUser} access={access} events={events} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} onCreateEvent={onCreateEvent} onUpdateEvent={onUpdateEvent} onCancelEvent={onCancelEvent} />
    </Suspense>
  );
  const adminSectionTools = {
    overview: deferredAdminSection("overview"),
    channels: deferredAdminSection("channels"),
    events: deferredAdminSection("events"),
    moderation: deferredAdminSection("moderation"),
    bots: deferredAdminSection("bots"),
    webhooks: deferredAdminSection("webhooks"),
    emojis: deferredAdminSection("emojis"),
    stickers: deferredAdminSection("stickers"),
    "danger-zone": access.isOwner ? (
      <div className="community-danger-zone-tools">
        {deferredAdminSection("danger-zone")}
        <CommunityOwnershipTransferPanel community={community} currentUser={currentUser} />
      </div>
    ) : null,
  };

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
        {community.kind !== "text" ? <button type="button" className={`community-audio-entry ${audioActive ? "active" : ""}`} aria-current={audioActive ? "page" : undefined} onClick={onOpenAudio}>
          <span className="community-audio-entry-icon" aria-hidden="true"><AppIcon name="headphones" size="md" /></span>
          <span><strong>{community.kind === "podcast" ? "Podcast" : "Audio"}</strong><small>{community.kind === "podcast" ? "Shows and episodes" : "Community audio"}</small></span>
        </button> : null}
        {access.isVisitor ? (
          <div className="community-readonly-notice">
            <strong>Viewing public {kindSummary.label.toLowerCase()}</strong>
            <span>{kindSummary.visitorCopy}</span>
          </div>
        ) : null}

        {community.categories.length ? community.categories.map((category) => (
          <ChannelCategory
            key={category.id}
            category={category}
            communityId={community.id}
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
        )) : <div className="empty-state compact">{community.kind === "text" ? "No public channels are visible." : `Open ${kindSummary.landingLabel} to explore this ${kindSummary.label.toLowerCase()}.`}</div>}
      </div>

      <UserMiniCard member={currentUser} onOpenSettings={onOpenSettings} onLogout={onLogout} />

      {openPanel === "admin" ? <CommunityAdminPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} onOpenGuidelines={() => setGuidelinesOpen(true)} onCreateChannel={onCreateChannel} onAssignMemberRole={onAssignMemberRole} onCommunityUpdated={onCommunityUpdated} onPlaceholderAction={onPlaceholderAction} sectionTools={adminSectionTools} /> : null}
      {openPanel === "moderator" ? <CommunityModeratorPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} onOpenGuidelines={() => setGuidelinesOpen(true)} /> : null}
      {openPanel === "member" ? <CommunityMemberPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenLeave={() => setOpenPanel("leave")} onOpenInvite={() => setOpenPanel("invite")} onOpenGuidelines={() => setGuidelinesOpen(true)} onReport={() => setOpenPanel("report")} /> : null}
      {openPanel === "visitor" ? <CommunityVisitorPanel community={community} access={access} isAuthenticated={isAuthenticated} onClose={() => setOpenPanel(null)} onOpenJoin={() => setOpenPanel("join")} onOpenJoinWithInvite={() => setOpenPanel("joinInvite")} onOpenGuidelines={() => setGuidelinesOpen(true)} onReport={() => setOpenPanel("report")} /> : null}
      {openPanel === "join" ? <CommunityJoinModal community={community} currentUserId={currentUser.userId} isAuthenticated={isAuthenticated} onClose={() => setOpenPanel(null)} onConfirm={async (acceptance) => { const joined = await onJoinCommunity(acceptance); if (joined) setOpenPanel(null); return joined; }} /> : null}
      {openPanel === "leave" ? <CommunityLeaveModal community={community} access={access} onClose={() => setOpenPanel(null)} onConfirm={async () => { await onLeaveCommunity(); setOpenPanel(null); }} /> : null}
      {openPanel === "invite" ? <InvitePeopleModal community={community} currentUserId={currentUser.userId} canCreate={access.permissions.includes("createInvites")} onClose={() => setOpenPanel(null)} /> : null}
      {openPanel === "joinInvite" ? <JoinWithInviteModal initialCode={pendingInviteCode ?? ""} isAuthenticated={isAuthenticated} communities={communities} currentUser={currentUser} onClose={() => { setOpenPanel(null); onClearPendingInviteCode(); }} onAccepted={onInviteAccepted} /> : null}
      {openPanel === "report" ? <ReportModal target={{ targetType: "community", targetId: community.id, communityId: community.id, label: community.name }} reporterId={currentUser.userId} onClose={() => setOpenPanel(null)} onResult={(message, ok) => onPlaceholderAction(`${ok ? "Success" : "Error"}: ${message}`)} /> : null}
      {guidelinesOpen ? <LegalDocumentModal documentId="guidelines" onClose={() => setGuidelinesOpen(false)} /> : null}
    </aside>
  );
}
