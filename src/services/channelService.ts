import type { ChannelType } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { CHANNEL_LIST_SELECT, listMockChannelSummaries, listSupabaseChannelSummaries, mapChannelListRow } from "./channelListQuery";
import { auditLogService } from "./auditLogService";

export type ChannelSummary = Readonly<{
  id: string;
  communityId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  isPrivate: boolean;
  publicReadEnabled: boolean;
  position: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type CreateChannelInput = Readonly<{
  communityId: string;
  categoryId?: string | null;
  name: string;
  type?: ChannelType;
  topic?: string | null;
  isPrivate?: boolean;
  publicReadEnabled?: boolean;
}>;

export type UpdateChannelInput = Readonly<{
  channelId: string;
  communityId: string;
  name: string;
  type: ChannelType;
  topic?: string | null;
  categoryId: string | null;
  isPrivate: boolean;
  publicReadEnabled: boolean;
}>;

export type DeleteChannelInput = Readonly<{
  channelId: string;
  communityId: string;
  channelName: string;
  confirmName?: string;
  fallbackChannelId: string | null;
}>;

export type DeleteChannelResult = Readonly<{
  deletedChannelId: string;
  fallbackChannelId: string | null;
}>;

export type ChannelServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "CHANNEL_CREATE_FAILED"
  | "CHANNEL_LIST_FAILED"
  | "CHANNEL_UPDATE_FAILED"
  | "CHANNEL_DELETE_FAILED"
  | "LAST_CHANNEL_REQUIRED";

export type ChannelServiceError = Readonly<{
  code: ChannelServiceErrorCode;
  message: string;
}>;

export type ChannelServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: ChannelServiceError }>;

function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").replace(/-+/g, "-").slice(0, 80);
}

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

function validateCreateInput(input: CreateChannelInput): ChannelServiceError | null {
  if (!input.communityId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  }

  const name = normalizeChannelName(input.name);
  if (!name) {
    return { code: "VALIDATION_ERROR", message: "Channel name is required." };
  }

  if (input.topic && input.topic.length > 300) {
    return { code: "VALIDATION_ERROR", message: "Channel topic must be 300 characters or fewer." };
  }

  return null;
}

export const channelService = {
  normalizeChannelName,

  async listChannels(communityId: string): Promise<ChannelServiceResult<ChannelSummary[]>> {
    if (!communityId.trim()) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Community ID is required." } };
    }

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: listMockChannelSummaries(communityId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const result = await listSupabaseChannelSummaries(configured.data, communityId);

    if (result.error || !result.data) {
      return { ok: false, error: { code: "CHANNEL_LIST_FAILED", message: "Could not load channels." } };
    }

    return { ok: true, data: result.data };
  },

  async createChannel(input: CreateChannelInput): Promise<ChannelServiceResult<ChannelSummary>> {
    const validationError = validateCreateInput(input);
    if (validationError) return { ok: false, error: validationError };

    const name = normalizeChannelName(input.name);
    const type = input.type ?? "text";
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const now = new Date().toISOString();
      const channel: ChannelSummary = {
          id: `mock-channel-${Date.now()}`, communityId: input.communityId, categoryId: input.categoryId ?? null, name, type, topic: input.topic?.trim() || null, isPrivate: Boolean(input.isPrivate), publicReadEnabled: input.isPrivate ? false : (input.publicReadEnabled ?? true), position: 0, createdAt: now, updatedAt: now,
      };
      await auditLogService.append({ communityId: input.communityId, actionType: "channel_create", targetType: "channel", targetId: channel.id, reason: `Created #${name}` });
      return {
        ok: true,
        data: channel,
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const categoryId = input.categoryId?.trim() || null;
    const safeCategoryId = categoryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)
      ? categoryId
      : null;

    const { data, error } = await configured.data.rpc("create_managed_text_channel", {
      target_community_id: input.communityId,
      target_category_id: safeCategoryId,
      channel_name: name,
      channel_type: type,
      channel_topic: input.topic?.trim() || null,
      channel_is_private: Boolean(input.isPrivate),
      channel_public_read_enabled: input.isPrivate ? false : (input.publicReadEnabled ?? true),
    });
    const row = data?.[0];

    if (error || !row) {
      return { ok: false, error: { code: "CHANNEL_CREATE_FAILED", message: "Could not create channel." } };
    }

    const channel = mapChannelListRow(row); await auditLogService.append({ communityId: input.communityId, actionType: "channel_create", targetType: "channel", targetId: channel.id, reason: `Created #${name}` }); return { ok: true, data: channel };
  },

  async updateChannel(input: UpdateChannelInput): Promise<ChannelServiceResult<ChannelSummary>> {
    if (!input.channelId.trim()) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel ID is required." } };
    }

    const name = normalizeChannelName(input.name);
    if (!name) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel name is required." } };
    if (input.topic && input.topic.length > 300) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel topic must be 300 characters or fewer." } };

    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) {
      const now = new Date().toISOString();
      return { ok: true, data: { id: input.channelId, communityId: input.communityId, categoryId: input.categoryId, name, type: input.type, topic: input.topic?.trim() || null, isPrivate: input.isPrivate, publicReadEnabled: input.isPrivate ? false : input.publicReadEnabled, position: 0, createdAt: now, updatedAt: now } };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;
    const rpcClient = configured.data as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await rpcClient.rpc("update_managed_channel", {
      target_channel_id: input.channelId,
      next_name: name,
      next_type: input.type,
      next_topic: input.topic?.trim() || null,
      next_category_id: input.categoryId,
      next_is_private: input.isPrivate,
      next_public_read_enabled: input.isPrivate ? false : input.publicReadEnabled,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: false, error: { code: "CHANNEL_UPDATE_FAILED", message: error?.message ?? "Could not update channel." } };
    const channel = mapChannelListRow(row as Parameters<typeof mapChannelListRow>[0]);
    await auditLogService.append({ communityId: input.communityId, actionType: "channel_update", targetType: "channel", targetId: channel.id, reason: `Updated #${channel.name}` });
    return { ok: true, data: channel };
  },

  async deleteChannel(input: DeleteChannelInput): Promise<ChannelServiceResult<DeleteChannelResult>> {
    if (!input.channelId.trim()) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel ID is required." } };
    }

    if (normalizeChannelName(input.confirmName ?? "") !== normalizeChannelName(input.channelName)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Type the channel name to confirm deletion." } };
    }
    if (!input.fallbackChannelId) {
      return { ok: false, error: { code: "LAST_CHANNEL_REQUIRED", message: "Create another channel before deleting the final channel." } };
    }

    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) return { ok: true, data: { deletedChannelId: input.channelId, fallbackChannelId: input.fallbackChannelId } };

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;
    const rpcClient = configured.data as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await rpcClient.rpc("delete_managed_channel", { target_channel_id: input.channelId, confirmation_name: input.confirmName ?? "" });
    const row = (Array.isArray(data) ? data[0] : data) as { deleted_channel_id?: string; fallback_channel_id?: string | null } | null;
    if (error || !row?.deleted_channel_id) return { ok: false, error: { code: "CHANNEL_DELETE_FAILED", message: error?.message ?? "Could not delete channel." } };
    await auditLogService.append({ communityId: input.communityId, actionType: "channel_delete", targetType: "channel", targetId: input.channelId, reason: `Deleted #${input.channelName}` });
    return { ok: true, data: { deletedChannelId: row.deleted_channel_id, fallbackChannelId: row.fallback_channel_id ?? input.fallbackChannelId } };
  },
};
