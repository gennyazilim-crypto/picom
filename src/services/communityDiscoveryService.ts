import type { Community } from "../types/community";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type DiscoveryCategory = "development" | "design" | "gaming" | "music" | "study" | "work";
export type DiscoveryJoinPolicy = "open" | "request";
export type DiscoveryCommunity = Readonly<{
  id: string;
  name: string;
  description: string;
  icon: string;
  bannerUrl?: string;
  accentColor: string;
  memberCount: number;
  visibility: "public";
  category: DiscoveryCategory;
  joinPolicy: DiscoveryJoinPolicy;
  isMember: boolean;
}>;
export type DiscoveryJoinResult = Readonly<{ ok: true; action: "joined" | "requested" | "already_member" } | { ok: false; message: string }>;
export type DiscoveryListResult = Readonly<{ ok: true; data: DiscoveryCommunity[] } | { ok: false; message: string }>;

const categories: DiscoveryCategory[] = ["design", "development", "gaming", "music", "study", "work"];

function isDiscoveryCategory(value: string | null | undefined): value is DiscoveryCategory {
  return value !== null && value !== undefined && categories.includes(value as DiscoveryCategory);
}

function normalizeDiscoveryCategory(value: string | null | undefined): DiscoveryCategory {
  return isDiscoveryCategory(value) ? value : "work";
}

function discoveryErrorMessage(error: unknown, operation: "list" | "join"): string {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  const diagnostic = `${code} ${message}`;

  if (/AUTH_REQUIRED|JWT|401/i.test(diagnostic)) return "Sign in to join this community.";
  if (/DISCOVERY_COMMUNITY_UNAVAILABLE/i.test(diagnostic)) return "This community is no longer available in Discovery.";
  if (/DISCOVERY_DEFAULT_ROLE_MISSING/i.test(diagnostic)) return "This community is not ready to accept members yet.";
  if (/PGRST202|42883|function .* does not exist/i.test(diagnostic)) return "Discovery is not available on this backend yet.";
  return operation === "list"
    ? "Picom could not load Discovery communities. Please try again."
    : "Picom could not join or request access to this community.";
}

export const communityDiscoveryService = {
  async listPublicCommunities(_fallbackCommunities: Community[]): Promise<DiscoveryListResult> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery is unavailable because Supabase is not configured." };
    const { data, error } = await client.rpc("list_public_discovery_communities", { search_text: null, category_filter: null, result_limit: 60 });
    if (error) return { ok: false, message: discoveryErrorMessage(error, "list") };
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "A public Picom community.",
        icon: row.icon_url ?? row.name.slice(0, 2).toUpperCase(),
        bannerUrl: "banner_url" in row && typeof row.banner_url === "string" ? row.banner_url : undefined,
        accentColor: row.accent_color,
        memberCount: Number(row.member_count) || 0,
        visibility: "public" as const,
        category: normalizeDiscoveryCategory(row.category),
        joinPolicy: row.join_policy === "request" ? "request" : "open",
        isMember: "is_member" in row && row.is_member === true,
      })),
    };
  },

  async joinOrRequestAccess(communityId: string): Promise<DiscoveryJoinResult> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery membership is unavailable." };
    const { data, error } = await client.rpc("join_or_request_discovery_community", { target_community_id: communityId });
    if (error) return { ok: false, message: discoveryErrorMessage(error, "join") };
    if (!data || !["joined", "requested", "already_member"].includes(data)) {
      return { ok: false, message: "Discovery returned an invalid membership response." };
    }
    return { ok: true, action: data };
  },

  /**
   * Join a public community found via search when it is not already in the local membership list.
   * Prefers Discovery join; falls back to public join when the community is public but not Discovery-listed.
   */
  async joinFromSearch(communityId: string): Promise<DiscoveryJoinResult | { ok: false; message: string; needsRules: true } | { ok: false; message: string; openDiscovery: true }> {
    const discovery = await this.joinOrRequestAccess(communityId);
    if (discovery.ok) return discovery;

    const unavailable = /no longer available in Discovery|DISCOVERY_COMMUNITY_UNAVAILABLE/i.test(discovery.message);
    if (!unavailable) return discovery;

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Community join is unavailable." };
    const { error } = await client.rpc("join_public_community", {
      target_community_id: communityId,
      accepted_rules_version: null,
    });
    if (!error) return { ok: true, action: "joined" };
    const message = error.message ?? "";
    if (/RULES_ACCEPTANCE_REQUIRED/i.test(message)) {
      return { ok: false, message: "Accept this community’s rules from Discover before joining.", needsRules: true };
    }
    if (/PRIVATE_COMMUNITY|SECRET|INVITE_REQUIRED/i.test(message)) {
      return { ok: false, message: "This community needs an invite. Browse Discover for public spaces you can join.", openDiscovery: true };
    }
    return { ok: false, message: discoveryErrorMessage(error, "join") };
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
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery listing is unavailable." };
    const invokeRpc = client.rpc.bind(client) as unknown as (
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
