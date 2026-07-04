import type { SupabaseClient } from "@supabase/supabase-js";
import { mockCommunities } from "../data/mockCommunities";
import type { CommunitySummary } from "./communityService";
import type { Database } from "./supabase/database.types";

export const COMMUNITY_LIST_SELECT = "id, owner_id, name, description, icon_url, accent_color, created_at, updated_at" as const;

export type CommunityListRow = Readonly<{
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  accent_color: string;
  created_at: string;
  updated_at: string;
}>;

export type CommunityListQueryResult = Readonly<{
  data: CommunitySummary[] | null;
  error: unknown;
}>;

export function mapCommunityListRow(row: CommunityListRow): CommunitySummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    accentColor: row.accent_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMockCommunitySummaries(): CommunitySummary[] {
  return mockCommunities.map((community) => ({
    id: community.id,
    ownerId: "mock-current-user",
    name: community.name,
    description: null,
    iconUrl: null,
    accentColor: community.accentColor,
    createdAt: null,
    updatedAt: null,
  }));
}

export async function listSupabaseCommunitySummaries(client: SupabaseClient<Database>): Promise<CommunityListQueryResult> {
  const { data, error } = await client
    .from("communities")
    .select(COMMUNITY_LIST_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error };
  }

  return { data: (data ?? []).map(mapCommunityListRow), error: null };
}