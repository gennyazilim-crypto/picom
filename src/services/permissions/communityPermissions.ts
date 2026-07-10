import type { Channel, ChannelCategory, Community, Member, Role, UserId } from "../../types/community";
import type { CommunityAccess, CommunityMembershipStatus, CommunityPermissionKey, CommunityVisibility } from "../../types/communityAccess";

const OWNER_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageChannels",
  "manageRoles",
  "manageMembers",
  "moderateMessages",
  "deleteAnyMessage",
  "sendMessages",
  "sendAnnouncements",
  "viewPrivateChannels",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const ADMIN_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageChannels",
  "manageRoles",
  "manageMembers",
  "moderateMessages",
  "deleteAnyMessage",
  "sendMessages",
  "sendAnnouncements",
  "viewPrivateChannels",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const MODERATOR_PERMISSIONS: CommunityPermissionKey[] = [
  "moderateMessages",
  "deleteAnyMessage",
  "sendMessages",
  "createInvites",
];

const MEMBER_PERMISSIONS: CommunityPermissionKey[] = ["sendMessages"];

export function getCommunityVisibility(community: Community): CommunityVisibility {
  return community.visibility ?? "private";
}

export function isCommunityPublic(community: Community): boolean {
  return getCommunityVisibility(community) === "public";
}

export function isCommunityPublicReadEnabled(community: Community): boolean {
  return community.publicReadEnabled ?? false;
}

export function getUserCommunityRole(userId: UserId, community: Community): { member?: Member; role?: Role } {
  const member = community.members.find((candidate) => candidate.userId === userId);
  const role = member ? community.roles.find((candidate) => candidate.id === member.roleId) : undefined;
  return { member, role };
}

export function isCommunityOwner(userId: UserId, community: Community): boolean {
  const { role } = getUserCommunityRole(userId, community);
  return community.ownerId === userId || role?.name === "Owner" || role?.level === 100;
}

function getStatus(role?: Role, isOwner = false): CommunityMembershipStatus {
  if (isOwner) return "owner";
  if (!role) return "visitor";
  if (role.name === "Admin" || role.level >= 80) return "admin";
  if (role.name === "Moderator" || role.level >= 60) return "moderator";
  return "member";
}

function getRolePermissions(status: CommunityMembershipStatus): CommunityPermissionKey[] {
  if (status === "owner") return OWNER_PERMISSIONS;
  if (status === "admin") return ADMIN_PERMISSIONS;
  if (status === "moderator") return MODERATOR_PERMISSIONS;
  if (status === "member") return MEMBER_PERMISSIONS;
  return [];
}

export function getCommunityAccess(userId: UserId, community: Community): CommunityAccess {
  const { member, role } = getUserCommunityRole(userId, community);
  const owner = isCommunityOwner(userId, community);
  const status = getStatus(role, owner);
  const visibility = getCommunityVisibility(community);
  const publicReadEnabled = isCommunityPublicReadEnabled(community);
  const permissions = getRolePermissions(status);
  const isVisitor = status === "visitor";
  const canViewPublicContent = visibility === "public" && publicReadEnabled;

  return {
    userId,
    status,
    visibility,
    publicReadEnabled,
    member,
    role,
    permissions,
    isOwner: status === "owner",
    isAdmin: status === "admin",
    isModerator: status === "moderator",
    isMember: !isVisitor,
    isVisitor,
    canOpenAdminPanel: status === "owner" || status === "admin",
    canOpenModeratorPanel: status === "owner" || status === "admin" || status === "moderator",
    canJoin: isVisitor && visibility === "public",
    canLeave: !isVisitor && status !== "owner",
    canViewPublicContent,
    canViewMemberList: !isVisitor,
    readonlyReason: isVisitor ? "Viewing public content. Join to participate." : undefined,
  };
}

export function hasCommunityPermission(access: CommunityAccess, permission: CommunityPermissionKey): boolean {
  return access.permissions.includes(permission);
}

export function canManageCommunity(access: CommunityAccess): boolean {
  return hasCommunityPermission(access, "manageCommunity");
}

export function canManageChannels(access: CommunityAccess): boolean {
  return hasCommunityPermission(access, "manageChannels");
}

export function canManageMembers(access: CommunityAccess): boolean {
  return hasCommunityPermission(access, "manageMembers");
}

export function canModerateMessages(access: CommunityAccess): boolean {
  return hasCommunityPermission(access, "moderateMessages");
}

export function isVisitor(access: CommunityAccess): boolean {
  return access.status === "visitor";
}

export function canViewChannel(access: CommunityAccess, channel: Channel): boolean {
  if (access.isVisitor) {
    return access.canViewPublicContent && !channel.isPrivate && (channel.publicReadEnabled ?? true);
  }

  if (!channel.isPrivate) return true;
  return hasCommunityPermission(access, "viewPrivateChannels");
}

export function canSendMessage(access: CommunityAccess, channel: Channel): boolean {
  if (!canViewChannel(access, channel)) return false;
  if (access.isVisitor) return false;
  if (channel.type === "announcement") return hasCommunityPermission(access, "sendAnnouncements");
  if (channel.type !== "text") return false;
  return hasCommunityPermission(access, "sendMessages");
}

export function getComposerDisabledReason(access: CommunityAccess, channel: Channel): string | undefined {
  if (!canViewChannel(access, channel)) return "You do not have access to this channel.";
  if (access.isVisitor) return "Join this community to send messages.";
  if (channel.type === "announcement" && !hasCommunityPermission(access, "sendAnnouncements")) return "This announcement channel is read-only.";
  if (channel.type === "forum") return "Create or open a forum post to participate.";
  if (channel.type === "voice") return "Voice channels do not support text messages here.";
  if (!hasCommunityPermission(access, "sendMessages")) return "You do not have permission to send messages in this channel.";
  return undefined;
}

export function getVisibleChannelsForCurrentUser(community: Community, access: CommunityAccess): Channel[] {
  return community.categories.flatMap((category) => category.channels).filter((channel) => canViewChannel(access, channel));
}

export function filterCommunityForAccess(community: Community, access: CommunityAccess): Community {
  const categories: ChannelCategory[] = community.categories
    .map((category) => ({
      ...category,
      channels: category.channels.filter((channel) => canViewChannel(access, channel)),
    }))
    .filter((category) => category.channels.length > 0);
  const visibleChannelIds = new Set(categories.flatMap((category) => category.channels.map((channel) => channel.id)));
  const visibleMessages = community.messages.filter((message) => visibleChannelIds.has(message.channelId));
  const visibleAuthorIds = new Set(visibleMessages.map((message) => message.authorId));
  const visibleMembers = access.canViewMemberList
    ? community.members
    : community.members
        .filter((member) => visibleAuthorIds.has(member.userId))
        .map((member): Member => ({ ...member, status: "offline", statusText: "", bio: "" }));

  return {
    ...community,
    categories,
    messages: visibleMessages,
    members: visibleMembers,
    roles: access.canViewMemberList ? community.roles : community.roles.filter((role) => role.name === "Member"),
  };
}
