import { mockCommunities } from "../data/mockCommunities";
import type { UserStatus } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export const MEMBER_SELECT = "id, community_id, user_id, role_id, joined_at" as const;

export type MemberRow = Readonly<{
  id: string;
  community_id: string;
  user_id: string;
  role_id: string | null;
  joined_at: string;
}>;

export type MemberSummary = Readonly<{
  id: string;
  communityId: string;
  userId: string;
  roleId: string | null;
  roleIds: string[];
  joinedAt: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: UserStatus | null;
  statusText: string | null;
}>;

type ProfileRow = Readonly<{
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  status_text: string;
}>;

export type MembersServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "MEMBERS_LIST_FAILED";

export type MembersServiceError = Readonly<{
  code: MembersServiceErrorCode;
  message: string;
}>;

export type MembersServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: MembersServiceError }>;

function membersError(code: MembersServiceErrorCode, message: string): MembersServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function mapMemberRow(row: MemberRow, roleIds: string[] = row.role_id ? [row.role_id] : []): MemberSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    roleId: row.role_id,
    roleIds,
    joinedAt: row.joined_at,
    displayName: null,
    username: null,
    avatarUrl: null,
    status: null,
    statusText: null,
  };
}

function toUserStatus(value: string | null | undefined): UserStatus {
  if (value === "online" || value === "idle" || value === "dnd" || value === "offline") return value;
  return "offline";
}

function mapMemberWithProfile(row: MemberRow, profile?: ProfileRow, roleIds: string[] = row.role_id ? [row.role_id] : []): MemberSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    roleId: row.role_id,
    roleIds,
    joinedAt: row.joined_at,
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    status: profile ? toUserStatus(profile.status) : null,
    statusText: profile?.status_text ?? null,
  };
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return membersError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return membersError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const membersService = {
  async listMembers(communityId: string): Promise<MembersServiceResult<MemberSummary[]>> {
    if (!communityId.trim()) {
      return membersError("VALIDATION_ERROR", "Community ID is required.");
    }

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const community = mockCommunities.find((item) => item.id === communityId);
      return {
        ok: true,
        data: (community?.members ?? []).map((member): MemberSummary => ({
          id: member.id,
          communityId,
          userId: member.userId,
          roleId: member.roleId,
          roleIds: member.roleIds?.length ? [...member.roleIds] : [member.roleId],
          joinedAt: new Date(0).toISOString(),
          displayName: member.displayName,
          username: member.username,
          avatarUrl: member.avatarUrl ?? null,
          status: member.status,
          statusText: member.statusText,
        })),
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("community_members")
      .select(MEMBER_SELECT)
      .eq("community_id", communityId)
      .order("joined_at", { ascending: true });

    if (error || !data) {
      return membersError("MEMBERS_LIST_FAILED", "Could not load community members.");
    }

    const userIds = data.map((member) => member.user_id);
    const { data: profiles } = userIds.length
      ? await configured.data
          .from("profiles")
          .select("id, username, display_name, avatar_url, status, status_text")
          .in("id", userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]));
    const memberIds = data.map((member) => member.id);
    const { data: memberRoles } = memberIds.length ? await configured.data.from("community_member_roles").select("member_id, role_id, is_primary").in("member_id", memberIds) : { data: [] };
    const roleIdsByMember = new Map<string, string[]>();
    for (const assignment of memberRoles ?? []) roleIdsByMember.set(assignment.member_id, [...(roleIdsByMember.get(assignment.member_id) ?? []), assignment.role_id]);

    return { ok: true, data: data.map((member) => mapMemberWithProfile(member, profileById.get(member.user_id), roleIdsByMember.get(member.id)) ?? mapMemberRow(member, roleIdsByMember.get(member.id))) };
  },
};
