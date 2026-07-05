import type { Community, Member } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

export type CommunityMembershipServiceErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "JOIN_NOT_ALLOWED"
  | "JOIN_FAILED"
  | "LEAVE_NOT_ALLOWED"
  | "LEAVE_FAILED"
  | "DATA_SOURCE_NOT_CONFIGURED";

export type CommunityMembershipServiceError = {
  code: CommunityMembershipServiceErrorCode;
  message: string;
};

export type CommunityMembershipServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CommunityMembershipServiceError };

export type JoinCommunityInput = {
  community: Community;
  currentUser: Member;
  isAuthenticated: boolean;
};

export type LeaveCommunityInput = {
  community: Community;
  currentUserId: string;
};

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return {
      ok: false as const,
      error: {
        code: "DATA_SOURCE_NOT_CONFIGURED" as const,
        message: status.reason ?? "Supabase data source is not configured.",
      },
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    return {
      ok: false as const,
      error: {
        code: "DATA_SOURCE_NOT_CONFIGURED" as const,
        message: "Supabase client is unavailable.",
      },
    };
  }

  return { ok: true as const, data: client };
}

function createMockMember(community: Community, currentUser: Member): Member {
  const memberRole = community.roles.find((role) => role.name === "Member") ?? community.roles.find((role) => role.id === "member") ?? community.roles[0];

  return {
    ...currentUser,
    id: `${community.id}-member-current-user`,
    roleId: memberRole?.id ?? currentUser.roleId,
    status: currentUser.status === "offline" ? "online" : currentUser.status,
    statusText: "Joined this community",
  };
}

export const communityMembershipService = {
  async joinCommunity(input: JoinCommunityInput): Promise<CommunityMembershipServiceResult<Member>> {
    if (!input.isAuthenticated) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before joining a community." } };
    }

    if (input.community.visibility === "private") {
      return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "Private communities require an invite placeholder." } };
    }

    if (input.community.members.some((member) => member.userId === input.currentUser.userId)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "You are already a member of this community." } };
    }

    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) {
      return { ok: true, data: createMockMember(input.community, input.currentUser) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;

    if (userError || !userId) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before joining a community." } };
    }

    const { data: roleData, error: roleError } = await configured.data
      .from("roles")
      .select("id")
      .eq("community_id", input.community.id)
      .eq("name", "Member")
      .maybeSingle();

    if (roleError) {
      return { ok: false, error: { code: "JOIN_FAILED", message: "Could not find the default member role." } };
    }

    const { data, error } = await configured.data
      .from("community_members")
      .insert({
        community_id: input.community.id,
        user_id: userId,
        role_id: roleData?.id ?? null,
      })
      .select("id, community_id, user_id, role_id, joined_at")
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "JOIN_FAILED", message: "Could not join this community." } };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        userId: data.user_id,
        displayName: input.currentUser.displayName,
        username: input.currentUser.username,
        avatarSeed: input.currentUser.avatarSeed,
        avatarUrl: input.currentUser.avatarUrl,
        status: input.currentUser.status,
        statusText: "Joined this community",
        roleId: data.role_id ?? "member",
        bio: input.currentUser.bio,
      },
    };
  },

  async leaveCommunity(input: LeaveCommunityInput): Promise<CommunityMembershipServiceResult<void>> {
    if (!input.community.members.some((member) => member.userId === input.currentUserId)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "You are not a member of this community." } };
    }

    const currentMember = input.community.members.find((member) => member.userId === input.currentUserId);
    const currentRole = input.community.roles.find((role) => role.id === currentMember?.roleId);
    if (input.community.ownerId === input.currentUserId || currentRole?.name === "Owner") {
      return { ok: false, error: { code: "LEAVE_NOT_ALLOWED", message: "Transfer ownership before leaving this community." } };
    }

    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) {
      return { ok: true, data: undefined };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;

    if (userError || !userId) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before leaving a community." } };
    }

    const { error } = await configured.data
      .from("community_members")
      .delete()
      .eq("community_id", input.community.id)
      .eq("user_id", userId);

    if (error) {
      return { ok: false, error: { code: "LEAVE_FAILED", message: "Could not leave this community." } };
    }

    return { ok: true, data: undefined };
  },
};
