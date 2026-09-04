import type { FriendRecommendation, FriendRecommendationReason } from "../../types/friends";
import { getSupabaseClient } from "../supabase/supabaseClient";

const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 6;
const SERVER_MAXIMUM = 20;

type RecommendationResult =
  | Readonly<{ ok: true; data: readonly FriendRecommendation[] }>
  | Readonly<{ ok: false; error: string }>;

type CacheEntry = Readonly<{
  userId: string;
  seed: string;
  expiresAt: number;
  rows: readonly FriendRecommendation[];
}>;

let cache: CacheEntry | null = null;

function createSeed(): string {
  const entropy = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `sidebar-${entropy}`;
}

function clampLimit(limit: number | undefined): number {
  const normalized = Number.isFinite(limit) ? Math.trunc(limit ?? DEFAULT_LIMIT) : DEFAULT_LIMIT;
  return Math.min(SERVER_MAXIMUM, Math.max(1, normalized));
}

function reason(value: unknown): FriendRecommendationReason {
  return value === "MUTUAL_FRIENDS" || value === "SHARED_COMMUNITY" || value === "SHARED_INTERESTS" || value === "POPULAR_IN_NETWORK"
    ? value
    : "DISCOVERY";
}

function mapRows(input: unknown): FriendRecommendation[] {
  if (!Array.isArray(input)) return [];
  const rows: FriendRecommendation[] = [];
  for (const value of input) {
    const row = value as Record<string, unknown>;
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!userId) continue;
    const avatarUrl = typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url : undefined;
    rows.push({
        userId,
        displayName: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : "Picom user",
        username: typeof row.username === "string" && row.username.trim() ? row.username : "user",
        ...(avatarUrl ? { avatarUrl } : {}),
        verifiedPublic: row.verified_public === true,
        mutualFriendCount: Math.max(0, Number(row.mutual_friend_count) || 0),
        sharedCommunityCount: Math.max(0, Number(row.shared_community_count) || 0),
        reasonCode: reason(row.reason_code),
      });
  }
  return rows.slice(0, SERVER_MAXIMUM);
}

async function currentAuthentication() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ? { client, userId: data.user.id } : null;
}

export const friendRecommendationService = {
  defaultLimit: DEFAULT_LIMIT,
  serverMaximum: SERVER_MAXIMUM,

  invalidate(userId?: string): void {
    if (!userId || cache?.userId === userId) cache = null;
  },

  async list(input: Readonly<{ limit?: number; forceRefresh?: boolean }> = {}): Promise<RecommendationResult> {
    const auth = await currentAuthentication();
    if (!auth) return { ok: false, error: "Sign in to load friend recommendations." };
    const limit = clampLimit(input.limit);
    const now = Date.now();
    if (!input.forceRefresh && cache?.userId === auth.userId && cache.expiresAt > now) {
      return { ok: true, data: cache.rows.slice(0, limit) };
    }

    const seed = createSeed();
    const { data, error } = await auth.client.rpc("get_friend_recommendations", {
      result_limit: limit,
      refresh_seed: seed,
    });
    if (error) return { ok: false, error: "Friend recommendations are temporarily unavailable." };
    const rows = mapRows(data);
    cache = { userId: auth.userId, seed, expiresAt: now + CACHE_TTL_MS, rows };
    return { ok: true, data: rows };
  },

  async dismiss(userId: string): Promise<boolean> {
    const auth = await currentAuthentication();
    if (!auth) return false;
    const { data, error } = await auth.client.rpc("dismiss_friend_recommendation", { target_user_id: userId });
    if (error || data !== true) return false;
    if (cache?.userId === auth.userId) cache = { ...cache, rows: cache.rows.filter((row) => row.userId !== userId) };
    return true;
  },

  async recordEvent(userId: string, eventName: "profile_open" | "request_sent" | "accepted"): Promise<boolean> {
    const auth = await currentAuthentication();
    if (!auth) return false;
    const { data, error } = await auth.client.rpc("record_friend_recommendation_event", {
      target_user_id: userId,
      event_name: eventName,
    });
    return !error && data === true;
  },
};
