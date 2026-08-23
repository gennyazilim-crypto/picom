import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export const COMMUNITY_OWNER_ARCHIVE_MEMBER_LIMIT = 1_000;

export type CommunityArchiveEligibility = Readonly<{
  memberCount: number;
  requiresOwnershipTransfer: boolean;
}>;

export type CommunityArchiveEligibilityResult =
  | Readonly<{ ok: true; data: CommunityArchiveEligibility }>
  | Readonly<{ ok: false; message: string }>;

export type CommunityArchiveEligibilityInput = Readonly<{
  communityId: string;
  isOwner: boolean;
  mockMemberCount: number;
}>;

export function requiresOwnershipTransferToArchive(memberCount: number): boolean {
  return !Number.isSafeInteger(memberCount) || memberCount < 0 || memberCount > COMMUNITY_OWNER_ARCHIVE_MEMBER_LIMIT;
}

function toEligibility(memberCount: number): CommunityArchiveEligibility {
  return {
    memberCount,
    requiresOwnershipTransfer: requiresOwnershipTransferToArchive(memberCount),
  };
}

export const communityArchiveEligibilityService = {
  async getEligibility(input: CommunityArchiveEligibilityInput): Promise<CommunityArchiveEligibilityResult> {
    if (!input.isOwner) {
      return { ok: false, message: "Only the community owner can check deletion eligibility." };
    }

    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: toEligibility(input.mockMemberCount) };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { ok: false, message: "Community deletion eligibility is unavailable until Supabase is configured." };
    }

    const { data, error } = await client.rpc("get_community_archive_eligibility", {
      target_community_id: input.communityId,
    });
    const row = data?.[0];
    const memberCount = Number(row?.member_count);

    if (!error && row && Number.isSafeInteger(memberCount) && memberCount >= 0) {
      return {
        ok: true,
        data: {
          memberCount,
          requiresOwnershipTransfer: Boolean(row.ownership_transfer_required),
        },
      };
    }

    // Older deployed environments do not have the eligibility RPC yet. Read the
    // same live membership source so owners are not trapped behind a disabled
    // transfer flow while the additive migration is rolled out.
    const { count, error: countError } = await client
      .from("community_members")
      .select("id", { count: "exact", head: true })
      .eq("community_id", input.communityId);

    if (!countError && count !== null && Number.isSafeInteger(count) && count >= 0) {
      return { ok: true, data: toEligibility(count) };
    }

    return { ok: false, message: "Picom could not verify the community member count. No deletion action was performed." };
  },
};
