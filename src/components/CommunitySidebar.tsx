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
import type { VoiceRoomOccupancy } from "../types/voiceDiscovery";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import { InvitePeopleModal, JoinWithInviteModal } from "./CommunityInviteModals";
import type { InviteAcceptanceStatus } from "../services/community/communityInviteService";
import type { ReportRecord } from "../types/reports";
import { isV1ChannelTypeEnabled } from "../config/v1ReleaseScope";
import { ReportModal } from "./ReportModal";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import { AppIcon } from "./AppIcon";
import { SidebarVoiceConnectionBar } from "./SidebarVoiceConnectionBar";
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
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (channel: Channel) => void;
  onOpenSettings: () => void;
  onLogout: () => void | Promise<void>;
  onChannelContextMenu: (event: MouseEvent, channel: Channel) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveCategory: (categoryId: string, direction: "up" | "down") => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void;
  onJoinCommunity: (acceptance: CommunityRulesAcceptanceInput | null) => Promise<boolean>;
  onLeaveCommunity: () => void | Promise<void>;
  pendingInviteCode?: string | null;
  onClearPendingInviteCode: () => void;
  onInviteAccepted: (communityId: string, member: Member, status: InviteAcceptanceStatus, preview: import("../services/community/communityInviteService").CommunityInvitePreview) => void | Promise<void>;
  onMemberRolesChanged: (memberId: string, roleIds: string[], primaryRoleId: string) => void;
  onCommunityMembersChanged: (members: Member[]) => void;
  onOpenModerationSource: (report: ReportRecord) => void;
  onCommunityRolesChanged: (roles: Community["roles"]) => void;
  onCommunityUpdated: (community: import("../services/communityService").CommunitySummary) => void;
  onPlaceholderAction: (message: string) => void;
  events: UpcomingEvent[];
  onCreateEvent: (input: CreateCommunityEventInput) => void;
  onUpdateEvent: (eventId: string, input: UpdateCommunityEventInput) => void;
  onCancelEvent: (eventId: string) => void;
  voiceOccupancyByChannelId?: Readonly<Record<string, VoiceRoomOccupancy>>;
  voiceState: VoiceServiceSnapshot;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onToggleVoiceCamera: () => void;
  onOpenVoiceRoom: () => void;
  onOpenVoiceScreenShare: () => void;
  onLeaveVoice: () => void;
  canUseVoiceCamera?: boolean;
  canShareVoiceScreen?: boolean;
  onOpenMicrophoneSettings: () => void;
  onOpenHeadphoneSettings: () => void;
  onReloadChannels?: () => void;
};

type OpenCommunityPanel = "admin" | "moderator" | "member" | "visitor" | "join" | "leave" | "invite" | "joinInvite" | "report" | null;

export function CommunitySidebar({ community, communities, access, activeChannelId, currentUser, isAuthenticated, onSelectChannel, audioActive, onOpenAudio, onCreateChannel, onEditChannel, onDeleteChannel, onChannelContextMenu, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveCategory, onMoveChannel, onJoinCommunity, onLeaveCommunity, pendingInviteCode, onClearPendingInviteCode, onInviteAccepted, onMemberRolesChanged, onCommunityMembersChanged, onOpenModerationSource, onCommunityRolesChanged, onCommunityUpdated, onPlaceholderAction, events, onCreateEvent, onUpdateEvent, onCancelEvent, voiceOccupancyByChannelId = {}, voiceState, onToggleVoiceMute, onToggleVoiceDeafen, onToggleVoiceCamera, onOpenVoiceRoom, onOpenVoiceScreenShare, onLeaveVoice, canUseVoiceCamera = true, canShareVoiceScreen = true, onOpenMicrophoneSettings, onOpenHeadphoneSettings, onReloadChannels }: CommunitySidebarProps) {
  const canReorderChannels = canManageChannels(access);
  const visibleCategories = community.categories
    .map((category) => ({ ...category, channels: category.channels.filter((channel) => isV1ChannelTypeEnabled(channel.type)) }))
    // Managers still need empty category rows so "+" / create channel stays reachable.
    .filter((category) => category.channels.length > 0 || canReorderChannels);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(community.categories.map((category) => [category.id, Boolean(category.collapsedByDefault)])),
  );
  const [openPanel, setOpenPanel] = useState<OpenCommunityPanel>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const kindSummary = getCommunityKindInviteSummary(community.kind);
  useEffect(() => { if (pendingInviteCode) setOpenPanel("joinInvite"); }, [pendingInviteCode]);
  const deferredAdminSection = (section: import("./CommunityAdminDeferredSection").CommunityAdminDeferredSectionId) => (
    <Suspense fallback={<div className="empty-state compact" role="status">Opening admin tools...</div>}>
      <CommunityAdminDeferredSection section={section} community={community} currentUser={currentUser} access={access} events={events} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} onMoveCategory={onMoveCategory} onCreateChannel={onCreateChannel} onEditChannel={onEditChannel} onDeleteChannel={onDeleteChannel} onMoveChannel={onMoveChannel} onCommunityMembersChanged={onCommunityMembersChanged} onOpenModerationSource={(report) => { setOpenPanel(null); onOpenModerationSource(report); }} onCreateEvent={onCreateEvent} onUpdateEvent={onUpdateEvent} onCancelEvent={onCancelEvent} />
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
    "danger-zone": access.isOwner ? deferredAdminSection("danger-zone") : null,
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
        {access.isVisitor && visibleCategories.length ? (
          <div className="community-readonly-notice" role="status">
            <span className="community-readonly-notice-icon" aria-hidden="true">
              <AppIcon name="eye" size="sm" />
            </span>
            <div className="community-readonly-notice-copy">
              <strong>Public preview</strong>
              <span>{kindSummary.visitorCopy}</span>
            </div>
            {access.canJoin ? (
              <button type="button" className="channel-sidebar-action channel-sidebar-action--primary" onClick={() => setOpenPanel("join")}>
                Join community
              </button>
            ) : null}
          </div>
        ) : null}

        {visibleCategories.length ? (
          <div className="channel-list">
            {visibleCategories.map((category) => (
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
                voiceOccupancyByChannelId={voiceOccupancyByChannelId}
              />
            ))}
          </div>
        ) : community.kind === "text" ? (
          <div className="channel-sidebar-empty" role="status">
            <span className="channel-sidebar-empty-icon" aria-hidden="true">
              <AppIcon name={canReorderChannels ? "plus" : access.isVisitor ? "eye" : "hash"} size="lg" />
            </span>
            <strong>
              {canReorderChannels
                ? "No channels yet"
                : access.isVisitor
                  ? "No public channels yet"
                  : "No channels visible"}
            </strong>
            <span>
              {canReorderChannels
                ? "Create a category, then add text or voice channels so members have a place to talk."
                : access.isVisitor
                  ? kindSummary.visitorCopy
                  : "Channels appear here when they are created and you have permission to view them."}
            </span>
            <div className="channel-sidebar-empty-actions">
              {canReorderChannels ? (
                <>
                  <button type="button" className="channel-sidebar-action channel-sidebar-action--primary" onClick={() => setOpenPanel("admin")}>
                    <AppIcon name="settings" size="sm" />
                    Manage channels
                  </button>
                  <button type="button" className="channel-sidebar-action" onClick={() => onCreateCategory("Text channels")}>
                    <AppIcon name="plus" size="sm" />
                    Create category
                  </button>
                </>
              ) : null}
              {access.isVisitor && access.canJoin ? (
                <button type="button" className="channel-sidebar-action channel-sidebar-action--primary" onClick={() => setOpenPanel("join")}>
                  <AppIcon name="users" size="sm" />
                  Join community
                </button>
              ) : null}
              {access.isVisitor ? (
                <button type="button" className="channel-sidebar-action" onClick={() => setOpenPanel("joinInvite")}>
                  <AppIcon name="lock" size="sm" />
                  Have an invite?
                </button>
              ) : null}
              {!canReorderChannels && !access.isVisitor ? (
                <button type="button" className="channel-sidebar-action" onClick={() => setOpenPanel("member")}>
                  <AppIcon name="users" size="sm" />
                  Community info
                </button>
              ) : null}
              {onReloadChannels ? (
                <button type="button" className="channel-sidebar-action" onClick={onReloadChannels}>
                  Reload channels
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="channel-sidebar-empty" role="status">
            <span className="channel-sidebar-empty-icon" aria-hidden="true">
              <AppIcon name="headphones" size="lg" />
            </span>
            <strong>Explore {kindSummary.label.toLowerCase()}</strong>
            <span>Channels stay light here. Open {kindSummary.landingLabel} to browse this {kindSummary.label.toLowerCase()}.</span>
            <div className="channel-sidebar-empty-actions">
              <button type="button" className="channel-sidebar-action channel-sidebar-action--primary" onClick={onOpenAudio}>
                <AppIcon name="headphones" size="sm" />
                Open {kindSummary.landingLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="community-sidebar-footer">
        <SidebarVoiceConnectionBar
          voiceState={voiceState}
          onOpenVoiceRoom={onOpenVoiceRoom}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onToggleCamera={onToggleVoiceCamera}
          onOpenScreenShare={onOpenVoiceScreenShare}
          onLeaveVoice={onLeaveVoice}
          canUseCamera={canUseVoiceCamera}
          canShareScreen={canShareVoiceScreen}
        />
        <UserMiniCard member={currentUser} onOpenMicrophoneSettings={onOpenMicrophoneSettings} onOpenHeadphoneSettings={onOpenHeadphoneSettings} />
      </div>

      {openPanel === "admin" ? <CommunityAdminPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} onOpenGuidelines={() => setGuidelinesOpen(true)} onCreateChannel={onCreateChannel} onMemberRolesChanged={onMemberRolesChanged} onCommunityRolesChanged={onCommunityRolesChanged} onCommunityUpdated={onCommunityUpdated} onPlaceholderAction={onPlaceholderAction} sectionTools={adminSectionTools} /> : null}
      {openPanel === "moderator" ? <CommunityModeratorPanel community={community} access={access} onClose={() => setOpenPanel(null)} onOpenInvite={() => setOpenPanel("invite")} onOpenGuidelines={() => setGuidelinesOpen(true)} onMembersChanged={onCommunityMembersChanged} onOpenModerationSource={(report) => { setOpenPanel(null); onOpenModerationSource(report); }} /> : null}
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
