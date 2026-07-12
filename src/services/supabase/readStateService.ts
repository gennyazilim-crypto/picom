import { dataSourceService } from "../dataSourceService";
import { loggingService } from "../loggingService";
import { isUuid } from "../../utils/uuid";
import { getSupabaseClient } from "./supabaseClient";

export type ChannelUnreadSummary = {
  channelId: string;
  unreadCount: number;
  mentionCount: number;
  lastMessageId: string | null;
  lastReadMessageId: string | null;
};

type ReadStateResult<T> = { ok: true; data: T } | { ok: false; error: "READ_STATE_UNAVAILABLE" | "READ_STATE_FAILED" };

function unavailable<T>(): ReadStateResult<T> {
  return { ok: false, error: "READ_STATE_UNAVAILABLE" };
}

export const readStateService = {
  async listCommunityUnread(communityId: string): Promise<ReadStateResult<ChannelUnreadSummary[]>> {
    if (!dataSourceService.getStatus().isSupabase) return { ok: true, data: [] };
    if (!isUuid(communityId)) return { ok: true, data: [] };
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("get_my_community_unread_state", { target_community_id: communityId });
    if (error) {
      loggingService.logWarn("Unread state summary could not be loaded", { code: error.code ?? "unknown" }, "read-state");
      return { ok: false, error: "READ_STATE_FAILED" };
    }

    return { ok: true, data: (data ?? []).map((row) => ({
      channelId: row.channel_id,
      unreadCount: Number(row.unread_count),
      mentionCount: Number(row.mention_count),
      lastMessageId: row.last_message_id,
      lastReadMessageId: row.last_read_message_id,
    })) };
  },

  async markChannelRead(input: { channelId: string; lastReadMessageId: string | null }): Promise<ReadStateResult<boolean>> {
    if (!dataSourceService.getStatus().isSupabase) return { ok: true, data: true };
    if (!isUuid(input.channelId) || (input.lastReadMessageId !== null && !isUuid(input.lastReadMessageId))) {
      return { ok: true, data: false };
    }
    const client = getSupabaseClient();
    if (!client) return unavailable();

    const { data, error } = await client.rpc("mark_channel_read", {
      target_channel_id: input.channelId,
      target_last_read_message_id: input.lastReadMessageId,
    });
    if (error) {
      loggingService.logWarn("Channel read marker could not be saved", { code: error.code ?? "unknown" }, "read-state");
      return { ok: false, error: "READ_STATE_FAILED" };
    }
    return { ok: true, data: data === true };
  },
};
