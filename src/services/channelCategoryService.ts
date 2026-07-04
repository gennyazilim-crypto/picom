import { mockCommunities } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export const CHANNEL_CATEGORY_SELECT = "id, community_id, name, position, created_at, updated_at" as const;

export type ChannelCategoryRow = Readonly<{
  id: string;
  community_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}>;

export type ChannelCategorySummary = Readonly<{
  id: string;
  communityId: string;
  name: string;
  position: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type ChannelCategoryServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "CATEGORY_LIST_FAILED";

export type ChannelCategoryServiceError = Readonly<{
  code: ChannelCategoryServiceErrorCode;
  message: string;
}>;

export type ChannelCategoryServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: ChannelCategoryServiceError }>;

function categoryError(code: ChannelCategoryServiceErrorCode, message: string): ChannelCategoryServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function mapCategoryRow(row: ChannelCategoryRow): ChannelCategorySummary {
  return {
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return categoryError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return categoryError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const channelCategoryService = {
  async listCategories(communityId: string): Promise<ChannelCategoryServiceResult<ChannelCategorySummary[]>> {
    if (!communityId.trim()) {
      return categoryError("VALIDATION_ERROR", "Community ID is required.");
    }

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const community = mockCommunities.find((item) => item.id === communityId);
      return {
        ok: true,
        data: (community?.categories ?? []).map((category): ChannelCategorySummary => ({
          id: category.id,
          communityId,
          name: category.name,
          position: category.position ?? 0,
          createdAt: null,
          updatedAt: null,
        })),
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("channel_categories")
      .select(CHANNEL_CATEGORY_SELECT)
      .eq("community_id", communityId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      return categoryError("CATEGORY_LIST_FAILED", "Could not load channel categories.");
    }

    return { ok: true, data: data.map(mapCategoryRow) };
  },
};
