import type { SupabaseClient } from "@supabase/supabase-js";
import { mockCommunities } from "../data/mockCommunities";
import type { CommunitySummary } from "./communityService";
import type { Database } from "./supabase/database.types";
import { isCommunityKind, type CommunityKind } from "../types/community";

export const COMMUNITY_LIST_SELECT = "id, kind, owner_id, name, description, icon_url, accent_color, visibility, public_read_enabled, rules_enabled, rules_version, created_at, updated_at" as const;

export type CommunityListRow = Readonly<{
  id: string;
  kind: CommunityKind;
  owner_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  accent_color: string;
  visibility: "public" | "private";
  public_read_enabled: boolean;
  rules_enabled: boolean;
  rules_version: string;
  created_at: string;
  updated_at: string;
}>;

export type CommunityListQueryResult = Readonly<{
  data: CommunitySummary[] | null;
  error: unknown;
}>;

export function mapCommunityListRow(row: CommunityListRow): CommunitySummary {
  if (!isCommunityKind(row.kind)) {
    throw new TypeError("Community row contains an invalid kind.");
  }

  return {
    id: row.id,
    kind: row.kind,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    accentColor: row.accent_color,
    visibility: row.visibility,
    publicReadEnabled: row.public_read_enabled,
    rulesEnabled: row.rules_enabled,
    rulesVersion: row.rules_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMockCommunitySummaries(): CommunitySummary[] {
  return mockCommunities.map((community) => ({
    id: community.id,
    kind: community.kind,
    ownerId: "mock-current-user",
    name: community.name,
    description: null,
    iconUrl: null,
    accentColor: community.accentColor,
    visibility: community.visibility ?? "private",
    publicReadEnabled: community.publicReadEnabled ?? false,
    rulesEnabled: community.rulesEnabled ?? false,
    rulesVersion: community.rulesVersion ?? "1",
    createdAt: null,
    updatedAt: null,
  }));
}

export function getMockCommunityKind(communityId: string): CommunityKind {
  return mockCommunities.find((community) => community.id === communityId)?.kind ?? "text";
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
