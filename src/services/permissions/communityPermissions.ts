import type { Channel, ChannelCategory, Community, Member, Role, UserId } from "../../types/community";
import type { CommunityAccess, CommunityMembershipStatus, CommunityPermissionKey, CommunityPermissionOverride, CommunityPermissionScope, CommunityVisibility } from "../../types/communityAccess";
import type { MemberModerationAction } from "../../types/memberModeration";
import type { CommunityKind } from "../../types/community";

const OWNER_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageChannels",
  "manageCategories",
  "managePermissionOverrides",
  "manageRoles",
  "manageMembers",
  "moderateMembers",
  "moderateMessages",
  "deleteAnyMessage",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const ADMIN_PERMISSIONS: CommunityPermissionKey[] = [
  "manageCommunity",
  "manageChannels",
  "manageCategories",
  "managePermissionOverrides",
  "manageRoles",
  "manageMembers",
  "moderateMembers",
  "moderateMessages",
  "deleteAnyMessage",
  "createInvites",
  "viewInsights",
  "viewAuditLog",
];

const MODERATOR_PERMISSIONS: CommunityPermissionKey[] = [
  "manageMembers",
  "moderateMembers",
  "moderateMessages",
  "deleteAnyMessage",
  "createInvites",
];

const MEMBER_PERMISSIONS: CommunityPermissionKey[] = [];

const KIND_PERMISSIONS: Readonly<Record<CommunityKind, Readonly<Record<CommunityMembershipStatus, readonly CommunityPermissionKey[]>>>> = {
  text: {
    owner: ["manageTextCommunity", "viewChannel", "sendMessages", "sendAnnouncements", "uploadAttachments", "addReactions", "viewPrivateChannels", "viewVoiceRoom", "joinVoiceRoom", "publishAudio", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom", "joinVoice", "speak", "speakInVoice"],
    admin: ["manageTextCommunity", "viewChannel", "sendMessages", "sendAnnouncements", "uploadAttachments", "addReactions", "viewPrivateChannels", "viewVoiceRoom", "joinVoiceRoom", "publishAudio", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom", "joinVoice", "speak", "speakInVoice"],
    moderator: ["viewChannel", "sendMessages", "uploadAttachments", "addReactions", "viewVoiceRoom", "joinVoiceRoom", "publishAudio", "shareScreen", "muteMembers", "removeFromVoice", "joinVoice", "speak", "speakInVoice"],
    member: ["viewChannel", "sendMessages", "uploadAttachments", "addReactions", "viewVoiceRoom", "joinVoiceRoom", "publishAudio", "shareScreen", "joinVoice", "speak", "speakInVoice"],
    visitor: [],
  },
  radio: {
    owner: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "publishRadioAnnouncements", "moderateRadioComments", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"],
    admin: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "publishRadioAnnouncements", "moderateRadioComments", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"],
    moderator: ["viewRadioContent", "listenRadio", "moderateRadioComments", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice"],
    member: ["viewRadioContent", "listenRadio", "joinVoice", "speak", "speakInVoice", "shareScreen"],
    visitor: [],
  },
  podcast: {
    owner: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "moderatePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"],
    admin: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "moderatePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice", "manageVoiceRoom"],
    moderator: ["viewPodcastContent", "listenPodcasts", "moderatePodcastEpisodes", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "joinVoice", "speak", "speakInVoice", "shareScreen", "muteMembers", "removeFromVoice"],
    member: ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts", "joinVoice", "speak", "speakInVoice", "shareScreen"],
    visitor: [],
  },
};

const MEETING_PERMISSIONS: Readonly<Record<CommunityMembershipStatus, readonly CommunityPermissionKey[]>> = {
  owner: ["createMeeting","manageMeeting","joinMeeting","publishAudio","publishVideo","shareScreen","admitGuests","manageParticipants","manageStage","viewMeetingHistory","enableCaptions"],
  admin: ["createMeeting","manageMeeting","joinMeeting","publishAudio","publishVideo","shareScreen","admitGuests","manageParticipants","manageStage","viewMeetingHistory","enableCaptions"],
  moderator: ["joinMeeting","publishAudio","publishVideo","shareScreen","manageParticipants","manageStage","viewMeetingHistory"],
  member: ["joinMeeting","publishAudio","publishVideo"],
  visitor: [],
};

const KNOWN_PERMISSIONS = new Set<CommunityPermissionKey>([
  ...OWNER_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...MODERATOR_PERMISSIONS,
  ...MEMBER_PERMISSIONS,
  ...Object.values(KIND_PERMISSIONS).flatMap((matrix) => Object.values(matrix).flat()),
  ...Object.values(MEETING_PERMISSIONS).flat(),
]);
const KIND_SCOPED_PERMISSIONS = new Set<CommunityPermissionKey>([...Object.values(KIND_PERMISSIONS).flatMap((matrix) => Object.values(matrix).flat()),...Object.values(MEETING_PERMISSIONS).flat()]);

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

export function getAssignedCommunityRoles(member: Member | undefined, community: Community): Role[] {
  if (!member) return [];
  const roleIds = member.roleIds?.length ? member.roleIds : [member.roleId];
  return community.roles.filter((role) => roleIds.includes(role.id)).sort((a, b) => getRolePosition(b) - getRolePosition(a));
}

export function getUserCommunityRole(userId: UserId, community: Community): { member?: Member; role?: Role; roles: Role[] } {
  const member = community.members.find((candidate) => candidate.userId === userId);
  const roles = getAssignedCommunityRoles(member, community);
  return { member, role: roles[0], roles };
}

export function getRolePosition(role?: Pick<Role, "level">): number {
  return Math.max(0, Math.min(100, role?.level ?? 0));
}

export function isOwnerRole(role?: Role): boolean {
  return role?.systemKey === "owner" || role?.name === "Owner" || getRolePosition(role) >= 100;
}

export function isCommunityOwner(userId: UserId, community: Community): boolean {
  const { role } = getUserCommunityRole(userId, community);
  return community.ownerId === userId || isOwnerRole(role);
}

const ORDINARY_COMMUNITY_MEDIA_PERMISSIONS = new Set<CommunityPermissionKey>([
  "viewVoiceRoom",
  "joinVoiceRoom",
  "joinVoice",
  "speak",
  "speakInVoice",
  "publishAudio",
  "shareScreen",
]);

export function isOrdinaryCommunityMediaPermission(permission: CommunityPermissionKey): boolean {
  return ORDINARY_COMMUNITY_MEDIA_PERMISSIONS.has(permission);
}

export function isActiveCommunityMember(userId: UserId, community: Community): boolean {
  return community.members.some((member) => member.userId === userId);
}

function getStatus(role?: Role, isOwner = false, hasMembership = false): CommunityMembershipStatus {
  if (isOwner) return "owner";
  if (!role) return hasMembership ? "member" : "visitor";
  if (role.systemKey === "admin" || role.name === "Admin") return "admin";
  if (role.name === "Radio Producer") return "member";
  if (role.systemKey === "moderator" || role.name === "Moderator") return "moderator";
  return "member";
}

function getRolePermissions(status: CommunityMembershipStatus, kind: CommunityKind, roles: readonly Role[] = []): CommunityPermissionKey[] {
  const common = status === "owner"
    ? OWNER_PERMISSIONS
    : status === "admin"
      ? ADMIN_PERMISSIONS
      : status === "moderator"
        ? MODERATOR_PERMISSIONS
        : status === "member"
          ? MEMBER_PERMISSIONS
          : [];
  const explicit = roles.flatMap((role) => role.permissionValues ? Object.entries(role.permissionValues).filter(([, allowed]) => allowed).map(([permission]) => permission) : [...(role.capabilities ?? [])])
    .filter(isCommunityPermissionKey)
    .filter((permission) => isCommunityPermissionAvailableForKind(kind, permission));
  return [...new Set([...common, ...KIND_PERMISSIONS[kind][status], ...MEETING_PERMISSIONS[status], ...explicit])];
}

export function getDefaultCommunityRolePermissions(role: Role, kind: CommunityKind): CommunityPermissionKey[] {
  const status = getStatus(role, isOwnerRole(role));
  const common = status === "owner" ? OWNER_PERMISSIONS : status === "admin" ? ADMIN_PERMISSIONS : status === "moderator" ? MODERATOR_PERMISSIONS : MEMBER_PERMISSIONS;
  return [...new Set([...common, ...KIND_PERMISSIONS[kind][status], ...MEETING_PERMISSIONS[status]])];
}

export function getCommunityAccess(userId: UserId, community: Community): CommunityAccess {
  const { member, role, roles } = getUserCommunityRole(userId, community);
  const owner = isCommunityOwner(userId, community);
  const isActiveMember = isActiveCommunityMember(userId, community);
  const status = getStatus(role, owner, isActiveMember);
  const visibility = getCommunityVisibility(community);
  const publicReadEnabled = isCommunityPublicReadEnabled(community);
  const isVisitor = status === "visitor";
  const canViewPublicContent = visibility === "public" && publicReadEnabled;
  const publicReadPermission: CommunityPermissionKey = community.kind === "radio" ? "viewRadioContent" : "viewPodcastContent";
  const permissions = isVisitor && canViewPublicContent && community.kind !== "text"
    ? [publicReadPermission]
    : getRolePermissions(status, community.kind, roles);

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
    isActiveMember,
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
  if (isOrdinaryCommunityMediaPermission(permission)) return access.isActiveMember;
  return access.permissions.includes(permission);
}

export function resolveCommunityPermission(
  access: CommunityAccess,
  permission: CommunityPermissionKey,
  scopes: readonly CommunityPermissionScope[] = [],
  overrides: readonly CommunityPermissionOverride[] = [],
): boolean {
  if (!isCommunityPermissionAvailableForKind(access.communityKind, permission)) return false;
  if (isOrdinaryCommunityMediaPermission(permission)) return access.isActiveMember;
  let allowed = hasCommunityPermission(access, permission);
  if (access.isOwner || !access.role) return allowed;
  const roleIds = access.member?.roleIds?.length ? access.member.roleIds : [access.role.id];
  for (const scope of scopes) {
    const matching = overrides.filter((override) => roleIds.includes(override.roleId) && override.permission === permission && override.scope.type === scope.type && override.scope.id === scope.id);
    if (matching.some((override) => override.effect === "deny")) allowed = false;
    else if (matching.some((override) => override.effect === "allow")) allowed = true;
  }
  return allowed;
}

export function canPerformCommunityKindAction(access: CommunityAccess, permission: CommunityPermissionKey): boolean {
  return isCommunityPermissionAvailableForKind(access.communityKind, permission) && hasCommunityPermission(access, permission);
}

export function canManageCommunityRole(access: CommunityAccess, targetRole: Role): boolean {
  if (!hasCommunityPermission(access, "manageRoles") || isOwnerRole(targetRole)) return false;
  const actorPosition = access.isOwner ? 101 : getRolePosition(access.role);
  return actorPosition > getRolePosition(targetRole);
}

export function canAssignCommunityRole(access: CommunityAccess, community: Community, targetMember: Member, targetRole: Role): boolean {
  if (!canManageCommunityRole(access, targetRole)) return false;
  const currentTargetRole = getAssignedCommunityRoles(targetMember, community)[0];
  if (!currentTargetRole || targetMember.userId === community.ownerId || isOwnerRole(currentTargetRole)) return false;
  return access.isOwner || getRolePosition(access.role) > getRolePosition(currentTargetRole);
}

export function canDeleteCommunityRole(access: CommunityAccess, community: Community, targetRole: Role): boolean {
  if (!canManageCommunityRole(access, targetRole) || targetRole.isDefault) return false;
  return !community.members.some((member) => member.roleId === targetRole.id || member.roleIds?.includes(targetRole.id));
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
  const targetRole = getAssignedCommunityRoles(targetMember, community)[0];
  if (!targetRole) return false;
  if (targetMember.userId === community.ownerId || isOwnerRole(targetRole)) return false;
  const actorLevel = access.isOwner ? 101 : getRolePosition(access.role);
  return actorLevel > getRolePosition(targetRole);
}

export function canModerateMessages(access: CommunityAccess): boolean {
  return hasCommunityPermission(access, "moderateMessages");
}

export function isVisitor(access: CommunityAccess): boolean {
  return access.status === "visitor";
}

export function canViewChannel(access: CommunityAccess, channel: Channel): boolean {
  if (channel.type === "voice") return access.isActiveMember;
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
