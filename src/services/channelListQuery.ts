import type { SupabaseClient } from "@supabase/supabase-js";
import { mockCommunities } from "../data/mockCommunities";
import type { ChannelType } from "../types/community";
import type { ChannelSummary } from "./channelService";
import type { Database } from "./supabase/database.types";

export const CHANNEL_LIST_SELECT = "id, community_id, category_id, name, type, topic, is_private, public_read_enabled, position, created_at, updated_at" as const;

export type ChannelListRow = Readonly<{
  id: string;
  community_id: string;
  category_id: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  is_private: boolean;
  public_read_enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}>;

export type ChannelListQueryResult = Readonly<{
  data: ChannelSummary[] | null;
  error: unknown;
}>;

export function mapChannelListRow(row: ChannelListRow): ChannelSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    categoryId: row.category_id,
    name: row.name,
    type: row.type,
    topic: row.topic,
    isPrivate: row.is_private,
    publicReadEnabled: row.public_read_enabled,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMockChannelSummaries(communityId: string): ChannelSummary[] {
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
      publicReadEnabled: channel.publicReadEnabled ?? !channel.isPrivate,
      position: channel.position ?? 0,
      createdAt: null,
      updatedAt: null,
    })),
  );
}

export async function listSupabaseChannelSummaries(client: SupabaseClient<Database>, communityId: string): Promise<ChannelListQueryResult> {
  const { data, error } = await client
    .from("channels")
    .select(CHANNEL_LIST_SELECT)
    .eq("community_id", communityId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error };
  }

  return { data: (data ?? []).map(mapChannelListRow), error: null };
}
