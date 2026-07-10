import type { Community, Member } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { UpcomingEvent } from "../types/events";
import type { CreateCommunityEventInput, UpdateCommunityEventInput } from "../services/communityEventService";
import { CommunityOnboardingChecklist } from "./CommunityOnboardingChecklist";
import { CommunityOwnershipTransferPanel } from "./CommunityOwnershipTransferPanel";
import { CommunityDeleteSafetyPanel } from "./CommunityDeleteSafetyPanel";
import { CommunityCategoryManagementPanel } from "./CommunityCategoryManagementPanel";
import { MessageModerationFiltersPanel } from "./MessageModerationFiltersPanel";
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
  onCreateEvent: (input: CreateCommunityEventInput) => void;
  onUpdateEvent: (eventId: string, input: UpdateCommunityEventInput) => void;
  onCancelEvent: (eventId: string) => void;
};

export function CommunityAdminDeferredSection({ section, community, currentUser, access, events, onCreateCategory, onRenameCategory, onDeleteCategory, onCreateEvent, onUpdateEvent, onCancelEvent }: Props) {
  if (section === "overview") return <CommunityOnboardingChecklist community={community} currentUserId={currentUser.userId} />;
  if (section === "channels") return <CommunityCategoryManagementPanel community={community} currentUser={currentUser} onCreateCategory={onCreateCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />;
  if (section === "events") return <CommunityEventsAdminSection community={community} currentUserId={currentUser.userId} events={events} onCreate={onCreateEvent} onUpdate={onUpdateEvent} onCancel={onCancelEvent} />;
  if (section === "moderation") return <MessageModerationFiltersPanel community={community} currentUser={currentUser} />;
  if (section === "bots") return <CommunityBotsAdminSection communityId={community.id} ownerId={community.ownerId ?? currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (section === "webhooks") return <CommunityWebhooksAdminSection community={community} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageChannels")} />;
  if (section === "emojis") return <CommunityEmojisAdminSection communityId={community.id} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (section === "stickers") return <CommunityStickersAdminSection communityId={community.id} currentUserId={currentUser.userId} canManage={access.permissions.includes("manageCommunity")} />;
  if (!access.isOwner) return null;
  return <div className="community-admin-tools-stack"><CommunityOwnershipTransferPanel community={community} currentUser={currentUser} /><CommunityDeleteSafetyPanel community={community} currentUser={currentUser} /></div>;
}
