import type { ChannelType } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { CHANNEL_LIST_SELECT, listMockChannelSummaries, listSupabaseChannelSummaries, mapChannelListRow } from "./channelListQuery";

export type ChannelSummary = Readonly<{
  id: string;
  communityId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  isPrivate: boolean;
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
}>;

export type UpdateChannelInput = Readonly<{
  channelId: string;
  name?: string;
  type?: ChannelType;
  topic?: string | null;
  categoryId?: string | null;
  isPrivate?: boolean;
}>;

export type DeleteChannelInput = Readonly<{
  channelId: string;
  confirmName?: string;
}>;

export type ChannelServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "CHANNEL_CREATE_FAILED"
  | "CHANNEL_LIST_FAILED"
  | "CHANNEL_UPDATE_PLACEHOLDER"
  | "CHANNEL_DELETE_PLACEHOLDER";

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
      return {
        ok: true,
        data: {
          id: `mock-channel-${Date.now()}`,
          communityId: input.communityId,
          categoryId: input.categoryId ?? null,
          name,
          type,
          topic: input.topic?.trim() || null,
          isPrivate: Boolean(input.isPrivate),
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("channels")
      .insert({
        community_id: input.communityId,
        category_id: input.categoryId ?? null,
        name,
        type,
        topic: input.topic?.trim() || null,
        is_private: Boolean(input.isPrivate),
      })
      .select(CHANNEL_LIST_SELECT)
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "CHANNEL_CREATE_FAILED", message: "Could not create channel." } };
    }

    return { ok: true, data: mapChannelListRow(data) };
  },

  async updateChannel(input: UpdateChannelInput): Promise<ChannelServiceResult<ChannelSummary>> {
    if (!input.channelId.trim()) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel ID is required." } };
    }

    return {
      ok: false,
      error: {
        code: "CHANNEL_UPDATE_PLACEHOLDER",
        message: "Channel editing is prepared but not enabled in the MVP yet.",
      },
    };
  },

  async deleteChannel(input: DeleteChannelInput): Promise<ChannelServiceResult<void>> {
    if (!input.channelId.trim()) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Channel ID is required." } };
    }

    return {
      ok: false,
      error: {
        code: "CHANNEL_DELETE_PLACEHOLDER",
        message: "Channel deletion is prepared but not enabled in the MVP yet.",
      },
    };
  },
};
