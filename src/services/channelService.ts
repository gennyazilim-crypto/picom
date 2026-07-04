import { mockCommunities } from "../data/mockCommunities";
import type { ChannelType } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

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

export type ChannelServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "CHANNEL_CREATE_FAILED"
  | "CHANNEL_LIST_FAILED";

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

function mapSupabaseChannel(row: {
  id: string;
  community_id: string;
  category_id: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  is_private: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}): ChannelSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    categoryId: row.category_id,
    name: row.name,
    type: row.type,
    topic: row.topic,
    isPrivate: row.is_private,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listMockChannels(communityId: string): ChannelSummary[] {
  const community = mockCommunities.find((item) => item.id === communityId);
  if (!community) return [];

  return community.categories.flatMap((category) =>
    category.channels.map((channel) => ({
      id: channel.id,
      communityId: community.id,
      categoryId: channel.categoryId ?? category.id,
      name: channel.name,
      type: channel.type,
      topic: channel.topic ?? null,
      isPrivate: Boolean(channel.isPrivate),
      position: channel.position ?? 0,
      createdAt: null,
      updatedAt: null,
    })),
  );
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
      return { ok: true, data: listMockChannels(communityId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("channels")
      .select("id, community_id, category_id, name, type, topic, is_private, position, created_at, updated_at")
      .eq("community_id", communityId)
      .order("position", { ascending: true });

    if (error) {
      return { ok: false, error: { code: "CHANNEL_LIST_FAILED", message: "Could not load channels." } };
    }

    return { ok: true, data: (data ?? []).map(mapSupabaseChannel) };
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
      .select("id, community_id, category_id, name, type, topic, is_private, position, created_at, updated_at")
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "CHANNEL_CREATE_FAILED", message: "Could not create channel." } };
    }

    return { ok: true, data: mapSupabaseChannel(data) };
  },
};