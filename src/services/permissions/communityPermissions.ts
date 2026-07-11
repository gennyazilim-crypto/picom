import type { Channel, ChannelCategory, Community, Member, Role, UserId } from "../../types/community";
import type { CommunityAccess, CommunityMembershipStatus, CommunityPermissionKey, CommunityVisibility } from "../../types/communityAccess";
import type { MemberModerationAction } from "../../types/memberModeration";
import type { CommunityKind } from "../../types/community";

const OWNER_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageRoles",
  "manageMembers",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const ADMIN_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageRoles",
  "manageMembers",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const MODERATOR_PERMISSIONS: CommunityPermissionKey[] = [
  "manageMembers",
  "createInvites",
];

const MEMBER_PERMISSIONS: CommunityPermissionKey[] = [];

const KIND_PERMISSIONS: Readonly<Record<CommunityKind, Readonly<Record<CommunityMembershipStatus, readonly CommunityPermissionKey[]>>>> = {
  text: {
    owner: ["manageTextCommunity", "manageChannels", "moderateMessages", "deleteAnyMessage", "sendMessages", "sendAnnouncements", "viewPrivateChannels"],
    admin: ["manageTextCommunity", "manageChannels", "moderateMessages", "deleteAnyMessage", "sendMessages", "sendAnnouncements", "viewPrivateChannels"],
    moderator: ["moderateMessages", "deleteAnyMessage", "sendMessages"],
    member: ["sendMessages"],
    visitor: [],
  },
  radio: {
    owner: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "publishRadioAnnouncements", "moderateRadioComments"],
    admin: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "publishRadioAnnouncements", "moderateRadioComments"],
    moderator: ["viewRadioContent", "listenRadio", "moderateRadioComments"],
    member: ["viewRadioContent", "listenRadio"],
    visitor: [],
  },
  podcast: {
    owner: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity"],
    admin: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity"],
    moderator: ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments"],
    member: ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts"],
    visitor: [],
  },
};

const KNOWN_PERMISSIONS = new Set<CommunityPermissionKey>([
  ...OWNER_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...MODERATOR_PERMISSIONS,
  ...MEMBER_PERMISSIONS,
  ...Object.values(KIND_PERMISSIONS).flatMap((matrix) => Object.values(matrix).flat()),
]);
const KIND_SCOPED_PERMISSIONS = new Set<CommunityPermissionKey>(Object.values(KIND_PERMISSIONS).flatMap((matrix) => Object.values(matrix).flat()));

function isCommunityPermissionKey(value: string): value is CommunityPermissionKey {
  return KNOWN_PERMISSIONS.has(value as CommunityPermissionKey);
}

export function isCommunityPermissionAvailableForKind(kind: CommunityKind, permission: CommunityPermissionKey): boolean {
  if (!KIND_SCOPED_PERMISSIONS.has(permission)) return true;
  return Object.values(KIND_PERMISSIONS[kind]).some((permissions) => permissions.includes(permission));
}

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
  if (role.name === "Radio Producer") return "member";
  if (role.name === "Moderator" || role.level >= 60) return "moderator";
  return "member";
}

function getRolePermissions(status: CommunityMembershipStatus, kind: CommunityKind, role?: Role): CommunityPermissionKey[] {
  const common = status === "owner"
    ? OWNER_PERMISSIONS
    : status === "admin"
      ? ADMIN_PERMISSIONS
      : status === "moderator"
        ? MODERATOR_PERMISSIONS
        : status === "member"
          ? MEMBER_PERMISSIONS
          : [];
  const explicit = (role?.capabilities ?? [])
    .filter(isCommunityPermissionKey)
    .filter((permission) => isCommunityPermissionAvailableForKind(kind, permission));
  return [...new Set([...common, ...KIND_PERMISSIONS[kind][status], ...explicit])];
}

export function getCommunityAccess(userId: UserId, community: Community): CommunityAccess {
  const { member, role } = getUserCommunityRole(userId, community);
  const owner = isCommunityOwner(userId, community);
  const status = getStatus(role, owner);
  const visibility = getCommunityVisibility(community);
  const publicReadEnabled = isCommunityPublicReadEnabled(community);
  const isVisitor = status === "visitor";
  const canViewPublicContent = visibility === "public" && publicReadEnabled;
  const publicReadPermission: CommunityPermissionKey = community.kind === "radio" ? "viewRadioContent" : "viewPodcastContent";
  const permissions = isVisitor && canViewPublicContent && community.kind !== "text"
    ? [publicReadPermission]
    : getRolePermissions(status, community.kind, role);

  return {
    userId,
    communityKind: community.kind,
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

export function canPerformCommunityKindAction(access: CommunityAccess, permission: CommunityPermissionKey): boolean {
  return isCommunityPermissionAvailableForKind(access.communityKind, permission) && hasCommunityPermission(access, permission);
}

export function canAssignCommunityRole(access: CommunityAccess, community: Community, targetMember: Member, targetRole: Role): boolean {
  if (!hasCommunityPermission(access, "manageRoles") || (!access.isOwner && !access.isAdmin)) return false;
  const currentTargetRole = community.roles.find((role) => role.id === targetMember.roleId);
  if (!currentTargetRole) return false;
  if (targetMember.userId === community.ownerId || currentTargetRole.name === "Owner" || currentTargetRole.level >= 100) return false;
  if (targetRole.name === "Owner" || targetRole.level >= 100) return false;
  if (access.isOwner) return true;
  const actorLevel = access.role?.level ?? 0;
  return actorLevel >= 80 && currentTargetRole.level < actorLevel && targetRole.level < actorLevel;
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

export function canModerateCommunityMember(access: CommunityAccess, community: Community, targetMember: Member, _action: MemberModerationAction): boolean {
  if (!canManageMembers(access) || targetMember.userId === access.userId) return false;
  const targetRole = community.roles.find((role) => role.id === targetMember.roleId);
  if (!targetRole) return false;
  if (targetMember.userId === community.ownerId || targetRole.name === "Owner" || targetRole.level >= 100) return false;
  const actorLevel = access.isOwner ? 100 : (access.role?.level ?? 0);
  return actorLevel >= 60 && actorLevel > targetRole.level;
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
  if (access.communityKind !== "text") return false;
  if (!canViewChannel(access, channel)) return false;
  if (access.isVisitor) return false;
  if (channel.type === "announcement") return hasCommunityPermission(access, "sendAnnouncements");
  if (channel.type !== "text") return false;
  return hasCommunityPermission(access, "sendMessages");
}

export function getComposerDisabledReason(access: CommunityAccess, channel: Channel): string | undefined {
  if (!canViewChannel(access, channel)) return "You do not have access to this channel.";
  if (access.isVisitor) return "Join this community to send messages.";
  if (access.communityKind !== "text") return "Use this community's type-specific interaction controls.";
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
