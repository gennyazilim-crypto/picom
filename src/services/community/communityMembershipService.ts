import type { Community, Member } from "../../types/community";
import { hasResolvedCommunityMembership } from "../permissions/communityPermissions";
import { dataSourceService } from "../dataSourceService";
import type { CommunityRulesAcceptanceInput } from "../../types/communityRules";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { userBlockingService } from "../userBlockingService";

export type CommunityMembershipServiceErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "JOIN_NOT_ALLOWED"
  | "RULES_ACCEPTANCE_REQUIRED"
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

export type CommunityJoinStatus = "joined" | "already_member";
export type CommunityJoinOutcome = Readonly<{ member: Member; status: CommunityJoinStatus }>;

export type JoinCommunityInput = {
  community: Community;
  currentUser: Member;
  isAuthenticated: boolean;
  inviteValidated?: boolean;
  bannedUserIds?: string[];
  rulesAcceptance?: CommunityRulesAcceptanceInput | null;
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

function mapPublicJoinError(message?: string): CommunityMembershipServiceResult<never> {
  if (message?.includes("AUTH_REQUIRED")) return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before joining a community." } };
  if (message?.includes("PRIVATE_COMMUNITY_INVITE_REQUIRED")) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "Private communities require an invite or approval." } };
  if (message?.includes("JOIN_BANNED")) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "You cannot join this community." } };
  if (message?.includes("JOIN_BLOCKED")) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "This community cannot be joined while a blocking relationship is active." } };
  if (message?.includes("COMMUNITY_NOT_FOUND")) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "This community is unavailable." } };
  if (message?.includes("DEFAULT_ROLE_MISSING")) return { ok: false, error: { code: "JOIN_FAILED", message: "This community is not ready to accept members." } };
  if (message?.includes("RULES_ACCEPTANCE_REQUIRED")) return { ok: false, error: { code: "RULES_ACCEPTANCE_REQUIRED", message: "Review and accept the current community rules before joining." } };
  return { ok: false, error: { code: "JOIN_FAILED", message: "Could not join this community." } };
}

export const communityMembershipService = {
  async joinCommunity(input: JoinCommunityInput): Promise<CommunityMembershipServiceResult<CommunityJoinOutcome>> {
    if (!input.isAuthenticated) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before joining a community." } };
    }

    if (input.community.visibility !== "public" && !input.inviteValidated) {
      return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "Private communities require a valid invite." } };
    }

    if (input.bannedUserIds?.includes(input.currentUser.userId)) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "You cannot join this community." } };
    if (input.community.ownerId && userBlockingService.isBlocked(input.community.ownerId)) return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "This community cannot be joined while a blocking relationship is active." } };

    const dataSource = dataSourceService.getStatus();
    const existingMember = input.community.members.find((member) => member.userId === input.currentUser.userId);
    if (existingMember && (dataSource.isMock || hasResolvedCommunityMembership(existingMember, input.community))) {
      return { ok: true, data: { member: existingMember, status: "already_member" } };
    }

    if (input.community.rulesEnabled !== false) {
      const acceptance = input.rulesAcceptance;
      const expectedVersion = input.community.rulesVersion ?? "1";
      if (!acceptance || acceptance.rulesVersion !== expectedVersion || !Number.isFinite(Date.parse(acceptance.acceptedAt))) {
        return { ok: false, error: { code: "RULES_ACCEPTANCE_REQUIRED", message: "Review and accept the current community rules before joining." } };
      }
    }

    if (dataSource.isMock) {
      return { ok: true, data: { member: createMockMember(input.community, input.currentUser), status: "joined" } };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    if (input.community.visibility !== "public") return { ok: false, error: { code: "JOIN_NOT_ALLOWED", message: "Private communities require an invite or approval." } };
    const { data, error } = await configured.data.rpc("join_public_community", { target_community_id: input.community.id, accepted_rules_version: input.rulesAcceptance?.rulesVersion ?? null });
    const membership = data?.[0];
    if (error || !membership) return mapPublicJoinError(error?.message);

    return {
      ok: true,
      data: { status: membership.join_status, member: {
        id: membership.id,
        userId: membership.user_id,
        displayName: input.currentUser.displayName,
        username: input.currentUser.username,
        avatarSeed: input.currentUser.avatarSeed,
        avatarUrl: input.currentUser.avatarUrl,
        status: input.currentUser.status,
        statusText: membership.join_status === "already_member" ? "Already a community member" : "Joined this community",
        roleId: membership.role_id ?? input.currentUser.roleId,
        roleIds: membership.role_id ? [membership.role_id] : undefined,
        bio: input.currentUser.bio,
      } },
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

    // The owner-leave guard above ran against the caller-supplied currentUserId, but the delete
    // targets the authoritative session id. If they diverge (e.g. a stale closure), re-check the
    // guard against the id we are actually about to delete so an owner cannot skip the transfer step.
    const authoritativeMember = input.community.members.find((member) => member.userId === userId);
    const authoritativeRole = input.community.roles.find((role) => role.id === authoritativeMember?.roleId);
    if (input.community.ownerId === userId || authoritativeRole?.name === "Owner") {
      return { ok: false, error: { code: "LEAVE_NOT_ALLOWED", message: "Transfer ownership before leaving this community." } };
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
