import type { Community, Member, Role } from "../types/community";

function ownerRole(roles: readonly Role[]): Role | undefined {
  return roles.find((role) => role.systemKey === "owner" || role.name === "Owner") ?? roles[0];
}

function memberRole(roles: readonly Role[]): Role | undefined {
  return roles.find((role) => role.systemKey === "member" || role.name === "Member") ?? roles[0];
}

function placeholderMember(input: {
  userId: string;
  roleId: string;
  roleIds?: string[];
  displayName: string;
  username: string;
  status?: Member["status"];
  statusText?: string;
}): Member {
  return {
    id: `roster-${input.userId}`,
    userId: input.userId,
    displayName: input.displayName,
    username: input.username,
    avatarSeed: input.userId,
    status: input.status ?? "offline",
    statusText: input.statusText ?? "Member",
    roleId: input.roleId,
    roleIds: input.roleIds?.length ? [...input.roleIds] : [input.roleId],
    bio: "",
  };
}

/**
 * Communities hydrate with an empty `members` array until Supabase listMembers
 * returns. Owners can still open the member sidebar via `ownerId`, so ensure at
 * least the founder / current member is visible while (or if) the roster loads.
 */
export function ensureCommunityMemberRoster(
  community: Pick<Community, "ownerId" | "currentUserMembershipUserId" | "members" | "roles">,
  currentUser?: Pick<Member, "userId" | "displayName" | "username" | "avatarUrl" | "status" | "statusText" | "roleId" | "roleIds"> | null,
): Member[] {
  const byUserId = new Map<string, Member>();
  for (const member of community.members) {
    byUserId.set(member.userId, member);
  }

  const ownerRoleRef = ownerRole(community.roles);
  if (community.ownerId && !byUserId.has(community.ownerId)) {
    const isSelf = currentUser?.userId === community.ownerId;
    byUserId.set(community.ownerId, placeholderMember({
      userId: community.ownerId,
      roleId: ownerRoleRef?.id ?? currentUser?.roleId ?? "owner",
      roleIds: ownerRoleRef ? [ownerRoleRef.id] : currentUser?.roleIds,
      displayName: isSelf ? (currentUser?.displayName || "You") : "Community owner",
      username: isSelf ? (currentUser?.username || "owner") : "owner",
      status: isSelf ? (currentUser?.status ?? "online") : "offline",
      statusText: isSelf ? (currentUser?.statusText || "Owner") : "Owner",
    }));
  }

  const selfId = currentUser?.userId ?? community.currentUserMembershipUserId;
  if (selfId && !byUserId.has(selfId)) {
    const fallbackRole = memberRole(community.roles) ?? ownerRoleRef;
    byUserId.set(selfId, placeholderMember({
      userId: selfId,
      roleId: currentUser?.roleId ?? fallbackRole?.id ?? "member",
      roleIds: currentUser?.roleIds,
      displayName: currentUser?.displayName || "You",
      username: currentUser?.username || "member",
      status: currentUser?.status ?? "online",
      statusText: currentUser?.statusText || "Member",
    }));
  }

  // Prefer API rows over placeholders when both somehow exist for the same user.
  return [...byUserId.values()];
}
