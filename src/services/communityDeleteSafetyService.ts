import { getSupabaseClient } from "./supabase/supabaseClient";

export type CommunityDeletionStatus = Readonly<{
  communityId: string;
  deletionRequestedAt: string | null;
  scheduledDeletionAt: string | null;
  deletedAt: string | null;
}>;

export type CommunityDeletionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function unavailable(): CommunityDeletionResult<never> {
  return { ok: false, message: "" };
}

/**
 * The database RPCs own the lifecycle. This client never stores deletion state
 * locally and cannot set lifecycle columns directly.
 */
export const communityDeleteSafetyService = {
  async getStatus(communityId: string): Promise<CommunityDeletionResult<CommunityDeletionStatus>> {
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("get_community_deletion_status", {
      target_community_id: communityId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error) return unavailable();

    return {
      ok: true,
      data: {
        communityId,
        deletionRequestedAt: row?.deletion_requested_at ?? null,
        scheduledDeletionAt: row?.scheduled_deletion_at ?? null,
        deletedAt: row?.deleted_at ?? null,
      },
    };
  },

  async requestDeletion(communityId: string): Promise<CommunityDeletionResult<CommunityDeletionStatus>> {
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("request_community_deletion", {
      target_community_id: communityId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.scheduled_deletion_at) return unavailable();

    return {
      ok: true,
      data: {
        communityId,
        deletionRequestedAt: null,
        scheduledDeletionAt: row.scheduled_deletion_at,
        deletedAt: null,
      },
    };
  },

  async cancelDeletion(communityId: string): Promise<CommunityDeletionResult<CommunityDeletionStatus>> {
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("cancel_community_deletion", {
      target_community_id: communityId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.cancelled_at) return unavailable();

    return {
      ok: true,
      data: {
        communityId,
        deletionRequestedAt: null,
        scheduledDeletionAt: null,
        deletedAt: null,
      },
    };
  },
};
