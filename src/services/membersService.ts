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
  joinedAt: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: UserStatus | null;
  statusText: string | null;
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

function mapMemberRow(row: MemberRow): MemberSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    roleId: row.role_id,
    joinedAt: row.joined_at,
    displayName: null,
    username: null,
    avatarUrl: null,
    status: null,
    statusText: null,
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

    return { ok: true, data: data.map(mapMemberRow) };
  },
};
