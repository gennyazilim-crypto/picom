import type { Channel, Community, Member } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { UpcomingEvent } from "../types/events";
import type { CreateCommunityEventInput, UpdateCommunityEventInput } from "../services/communityEventService";
import { CommunityOnboardingChecklist } from "./CommunityOnboardingChecklist";
import { CommunityOwnershipTransferPanel } from "./CommunityOwnershipTransferPanel";
import { CommunityDeleteSafetyPanel } from "./CommunityDeleteSafetyPanel";
import { CommunityStructureManagementPanel } from "./CommunityStructureManagementPanel";
import type { ReportRecord } from "../types/reports";
import { CommunityModerationCenter } from "./community/CommunityModerationCenter";
import { CommunityEventsAdminSection } from "./CommunityEventsAdminSection";
import { CommunityBotsAdminSection } from "./CommunityBotsAdminSection";
import { CommunityWebhooksAdminSection } from "./CommunityWebhooksAdminSection";
import { CommunityEmojisAdminSection } from "./CommunityEmojisAdminSection";
import { CommunityStickersAdminSection } from "./CommunityStickersAdminSection";

export type CommunityAdminDeferredSectionId = "overview" | "channels" | "events" | "moderation" | "bots" | "webhooks" | "emojis" | "stickers" | "danger-zone";
type Props = {
  section: CommunityAdminDeferredSectionId;
  community: Community;
  currentUser: Member;
  access: CommunityAccess;
  events: UpcomingEvent[];
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveCategory: (categoryId: string, direction: "up" | "down") => void;
  onCreateChannel: (categoryId: string) => void;
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (channel: Channel) => void;
  onMoveChannel: (categoryId: string, channelId: string, direction: "up" | "down") => void;
  onCommunityMembersChanged: (members: Member[]) => void;
  onOpenModerationSource: (report: ReportRecord) => void;
  onCreateEvent: (input: CreateCommunityEventInput) => void;
  onUpdateEvent: (eventId: string, input: UpdateCommunityEventInput) => void;
  onCancelEvent: (eventId: string) => void;
};

export function CommunityAdminDeferredSection({ section, community, currentUser, access, events, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveCategory, onCreateChannel, onEditChannel, onDeleteChannel, onMoveChannel, onCommunityMembersChanged, onOpenModerationSource, onCreateEvent, onUpdateEvent, onCancelEvent }: Props) {
  if (section === "overview") return <CommunityOnboardingChecklist community={community} currentUserId={currentUser.userId} />;
  if (section === "channels") return <CommunityStructureManagementPanel community={community} currentUser={currentUser} access={access} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} onMoveCategory={onMoveCategory} onCreateChannel={onCreateChannel} onEditChannel={onEditChannel} onDeleteChannel={onDeleteChannel} onMoveChannel={onMoveChannel} />;
  if (section === "events") return <CommunityEventsAdminSection community={community} currentUserId={currentUser.userId} events={events} onCreate={onCreateEvent} onUpdate={onUpdateEvent} onCancel={onCancelEvent} />;
  if (section === "moderation") return <CommunityModerationCenter community={community} access={access} mode="all" onMembersChanged={onCommunityMembersChanged} onOpenSource={onOpenModerationSource} />;
  if (section === "bots") return <CommunityBotsAdminSection communityId={community.id} ownerId={community.ownerId ?? currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (section === "webhooks") return <CommunityWebhooksAdminSection community={community} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageChannels")} />;
  if (section === "emojis") return <CommunityEmojisAdminSection communityId={community.id} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (section === "stickers") return <CommunityStickersAdminSection communityId={community.id} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (!access.isOwner) return null;
  return <div className="community-admin-tools-stack"><CommunityOwnershipTransferPanel community={community} currentUser={currentUser} /><CommunityDeleteSafetyPanel community={community} currentUser={currentUser} /></div>;
}
