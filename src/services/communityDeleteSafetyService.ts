import { getSupabaseClient } from "./supabase/supabaseClient";

export type CommunityDeletionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function unavailable(): CommunityDeletionResult<never> {
  return { ok: false, message: "" };
}

/** The server owns immediate, irreversible community deletion. */
export const communityImmediateDeleteService = {
  async deleteOwnedCommunity(communityId: string): Promise<CommunityDeletionResult<{ communityId: string; deletedAt: string }>> {
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("delete_owned_community", {
      target_community_id: communityId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.deleted_at) return unavailable();

    return {
      ok: true,
      data: {
        communityId,
        deletedAt: row.deleted_at,
      },
    };
  },
};
