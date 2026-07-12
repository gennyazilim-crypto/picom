import type { Channel, Community, Member, Role, UserId } from "./community";

import type { CommunityKind } from "./community";

export type CommunityMembershipStatus = "owner" | "admin" | "moderator" | "member" | "visitor";
export type CommunityVisibility = "public" | "private";
export type CommunityPermissionKey =
  | "manageCommunity"
  | "manageChannels"
  | "manageCategories"
  | "managePermissionOverrides"
  | "manageRoles"
  | "manageMembers"
  | "moderateMembers"
  | "moderateMessages"
  | "deleteAnyMessage"
  | "viewChannel"
  | "sendMessages"
  | "sendAnnouncements"
  | "uploadAttachments"
  | "addReactions"
  | "viewVoiceRoom"
  | "joinVoiceRoom"
  | "joinVoice"
  | "speak"
  | "speakInVoice"
  | "shareScreen"
  | "muteMembers"
  | "removeFromVoice"
  | "manageVoiceRoom"
  | "createMeeting"
  | "manageMeeting"
  | "joinMeeting"
  | "publishAudio"
  | "publishVideo"
  | "admitGuests"
  | "manageParticipants"
  | "manageStage"
  | "viewMeetingHistory"
  | "enableCaptions"
  | "manageTextCommunity"
  | "viewRadioContent"
  | "listenRadio"
  | "hostRadio"
  | "manageRadioCommunity"
  | "manageRadioSchedule"
  | "manageRadioPrograms"
  | "manageRadioHosts"
  | "publishRadioAnnouncements"
  | "moderateRadioComments"
  | "viewPodcastContent"
  | "listenPodcasts"
  | "createPodcastDrafts"
  | "publishPodcasts"
  | "editPodcastMetadata"
  | "archivePodcastEpisodes"
  | "moderatePodcastEpisodes"
  | "managePodcastSeries"
  | "commentOnPodcasts"
  | "reactToPodcasts"
  | "moderatePodcastComments"
  | "managePodcastCommunity"
  | "viewPrivateChannels"
  | "createInvites"
  | "viewInsights"
  | "viewAuditLog";

export type CommunityPermissionScopeType = "category" | "channel" | "radio_program" | "podcast_series";
export type CommunityPermissionOverrideEffect = "allow" | "deny";
export type CommunityPermissionScope = Readonly<{ type: CommunityPermissionScopeType; id: string }>;
export type CommunityPermissionOverride = Readonly<{
  roleId: string;
  permission: CommunityPermissionKey;
  scope: CommunityPermissionScope;
  effect: CommunityPermissionOverrideEffect;
}>;

export type CommunityAccess = {
  userId: UserId;
  communityKind: CommunityKind;
  status: CommunityMembershipStatus;
  visibility: CommunityVisibility;
  publicReadEnabled: boolean;
  member?: Member;
  role?: Role;
  permissions: CommunityPermissionKey[];
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isMember: boolean;
  isActiveMember: boolean;
  isVisitor: boolean;
  canOpenAdminPanel: boolean;
  canOpenModeratorPanel: boolean;
  canJoin: boolean;
  canLeave: boolean;
  canViewPublicContent: boolean;
  canViewMemberList: boolean;
  readonlyReason?: string;
};

export type CommunityMenuActionId =
  | "community-settings"
  | "admin-panel"
  | "moderator-panel"
  | "manage-channels"
  | "manage-roles"
  | "manage-members"
  | "invite-people"
  | "audit-log"
  | "transfer-ownership"
  | "delete-community"
  | "community-info"
  | "notification-settings"
  | "copy-community-link"
  | "leave-community"
  | "report-community"
  | "join-community";

export type CommunityMenuItemDescriptor = {
  id: CommunityMenuActionId;
  label: string;
  description?: string;
  tone?: "normal" | "danger";
  disabled?: boolean;
  permission?: CommunityPermissionKey;
};

export type ChannelAccessDecision = {
  canView: boolean;
  canSend: boolean;
  reason?: string;
  channel: Channel;
};
