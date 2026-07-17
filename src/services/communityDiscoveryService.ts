import type { Community } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type DiscoveryCategory = "development" | "design" | "gaming" | "music" | "study" | "work";
export type DiscoveryJoinPolicy = "open" | "request";
export type DiscoveryCommunity = Readonly<{
  id: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  memberCount: number;
  visibility: "public";
  category: DiscoveryCategory;
  joinPolicy: DiscoveryJoinPolicy;
}>;
export type DiscoveryJoinResult = Readonly<{ ok: true; action: "joined" | "requested" | "already_member" } | { ok: false; message: string }>;

const categories: DiscoveryCategory[] = ["design", "development", "gaming", "music", "study", "work"];

function fromCommunity(community: Community, index = 0): DiscoveryCommunity {
  return {
    id: community.id,
    name: community.name,
    description: community.description ?? "A public Picom community.",
    icon: community.icon,
    accentColor: community.accentColor,
    memberCount: community.members.length,
    visibility: "public",
    category: community.discoveryCategory ?? categories[index % categories.length],
    joinPolicy: community.discoveryJoinPolicy ?? "open",
  };
}

function isDiscoveryCategory(value: string | null): value is DiscoveryCategory {
  return value !== null && categories.includes(value as DiscoveryCategory);
}

export const communityDiscoveryService = {
  async listPublicCommunities(mockCommunities: Community[]): Promise<DiscoveryCommunity[]> {
    if (dataSourceService.getStatus().isMock) {
      return mockCommunities
        .filter((community) => community.visibility === "public" && community.publicReadEnabled !== false && community.discoveryListed !== false)
        .map(fromCommunity);
    }

    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.rpc("list_public_discovery_communities", { search_text: null, category_filter: null, result_limit: 60 });
    if (error) return [];
    return (data ?? []).filter((row) => isDiscoveryCategory(row.category)).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? "A public Picom community.",
      icon: row.icon_url ?? row.name.slice(0, 2).toUpperCase(),
      accentColor: row.accent_color,
      memberCount: Number(row.member_count) || 0,
      visibility: "public" as const,
      category: row.category as DiscoveryCategory,
      joinPolicy: row.join_policy,
    }));
  },

  async joinOrRequestAccess(communityId: string): Promise<DiscoveryJoinResult> {
    if (dataSourceService.getStatus().isMock) return { ok: false, message: "Use the local community membership flow in mock mode." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery membership is unavailable." };
    const { data, error } = await client.rpc("join_or_request_discovery_community", { target_community_id: communityId });
    if (error || !data) return { ok: false, message: "Picom could not join or request access to this community." };
    return { ok: true, action: data };
  },

  // Owner/admin opt-in: list this community in Discovery (or delist it). Listing forces the
  // community public + publicly-readable server-side and enqueues a pending moderator review.
  // Backed by the set_community_discovery_listing RPC (migration 20260717100000). That RPC is a
  // forward reference not yet in the generated Database types, so it is called through a
  // narrowly-typed wrapper until `supabase gen types` is re-run after deploy.
  async setDiscoveryListing(
    communityId: string,
    listed: boolean,
    options: Readonly<{ category?: DiscoveryCategory; joinPolicy?: DiscoveryJoinPolicy }> = {},
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (dataSourceService.getStatus().isMock) return { ok: false, message: "Discovery listing requires the production backend." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery listing is unavailable." };
    const invokeRpc = client.rpc as unknown as (
      fn: "set_community_discovery_listing",
      args: { target_community_id: string; next_listed: boolean; next_category: string | null; next_join_policy: string | null },
    ) => Promise<{ error: { message?: string } | null }>;
    const { error } = await invokeRpc("set_community_discovery_listing", {
      target_community_id: communityId,
      next_listed: listed,
      next_category: options.category ?? null,
      next_join_policy: options.joinPolicy ?? null,
    });
    if (error) return { ok: false, message: error.message ?? "Picom could not update the Discovery listing." };
    return { ok: true };
  },
};

