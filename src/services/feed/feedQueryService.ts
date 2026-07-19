import type { UnifiedContentMention } from "../../types/contentMentions";
import type { UnifiedFeedCursor, UnifiedFeedItem, UnifiedFeedPage, UnifiedFeedQuery } from "../../types/feed";
import { rankUnifiedFeedItems, type UnifiedFeedRankingInput } from "../../utils/unifiedFeedRanking";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type FeedQueryResult = Readonly<{ ok: true; data: UnifiedFeedPage }> | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;
type RankedFeedRow = Readonly<{
  feed_item_id: string; source_type: UnifiedContentMention["sourceType"]; source_id: string; parent_source_id: string | null;
  community_id: string; channel_id: string | null; author_id: string; mentioned_user_ids: string[]; preview: string;
  source_created_at: string; source_updated_at: string; visibility_context: unknown; reaction_count: number; comment_count: number;
  listener_count: number; mention_count: number; is_unread: boolean; is_saved: boolean; is_follow_related: boolean;
  ranking_score: number; ranking_epoch: string;
}>;
const localRead = new Set<string>();
const localSaved = new Set<string>();
const PAGE_CACHE_LIMIT = 16;
const PAGE_CACHE_FRESH_MS = 30_000;
const PAGE_CACHE_STALE_MS = 5 * 60_000;
const pageCache = new Map<string, { page: UnifiedFeedPage; updatedAt: number }>();
const bypassFreshCache = new Set<string>();
const resultLimit = (value?: number) => Math.max(1, Math.min(50, Math.trunc(value ?? 20)));

function pageCacheKey(query: UnifiedFeedQuery) {
  return JSON.stringify({ ...query, sourceTypes: query.sourceTypes ? [...query.sourceTypes] : undefined, followedAuthorIds: query.followedAuthorIds ? [...query.followedAuthorIds].sort() : undefined });
}

function rememberPage(key: string, page: UnifiedFeedPage) {
  pageCache.delete(key);
  pageCache.set(key, { page, updatedAt: Date.now() });
  while (pageCache.size > PAGE_CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value as string);
}

function visibility(value: unknown): UnifiedContentMention["visibility"] {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    communityVisibility: data.communityVisibility === "public" || data.communityVisibility === "private" ? data.communityVisibility : "unknown",
    channelPrivate: typeof data.channelPrivate === "boolean" ? data.channelPrivate : null,
    publicReadEnabled: data.publicReadEnabled === true,
  };
}

function mapRow(row: RankedFeedRow): UnifiedFeedItem {
  const mentionedUserId = row.mentioned_user_ids[0] ?? "unknown-user";
  return {
    feedItemId: row.feed_item_id,
    mention: {
      id: `${row.feed_item_id}:${mentionedUserId}`, sourceType: row.source_type, sourceId: row.source_id,
      parentSourceId: row.parent_source_id ?? undefined, communityId: row.community_id, channelId: row.channel_id ?? undefined,
      authorId: row.author_id, mentionedUserId, preview: row.preview, createdAt: row.source_created_at,
      updatedAt: row.source_updated_at, visibility: visibility(row.visibility_context),
    },
    mentionedUserIds: row.mentioned_user_ids,
    metrics: { reactions: Number(row.reaction_count) || 0, comments: Number(row.comment_count) || 0, listeners: Number(row.listener_count) || 0, mentionCount: Number(row.mention_count) || 0 },
    isUnread: row.is_unread, isSaved: row.is_saved, isFollowRelated: row.is_follow_related,
    rankingScore: Number(row.ranking_score) || 0, rankingEpoch: row.ranking_epoch,
  };
}

function isAfterCursor(score: number, item: UnifiedFeedRankingInput, cursor: UnifiedFeedCursor) {
  if (score !== cursor.rankingScore) return score < cursor.rankingScore;
  if (item.mention.createdAt !== cursor.createdAt) return item.mention.createdAt < cursor.createdAt;
  return item.feedItemId < cursor.feedItemId;
}

async function mockPage(query: UnifiedFeedQuery): Promise<UnifiedFeedPage> {
  const { mockUnifiedContentMentions } = await import("../../data/mockUnifiedContentMentions");
  const rankingEpoch = query.cursor?.rankingEpoch ?? new Date().toISOString();
  const followed = new Set(query.followedAuthorIds ?? []);
  const inputs: UnifiedFeedRankingInput[] = mockUnifiedContentMentions
    .filter((mention) => !query.sourceTypes?.length || query.sourceTypes.includes(mention.sourceType))
    .filter((mention) => !query.createdAfter || mention.createdAt >= query.createdAfter)
    .map((mention, index) => ({
      feedItemId: mention.id, mention, mentionedUserIds: [mention.mentionedUserId],
      metrics: { reactions: (index * 3) % 17, comments: (index * 2) % 11, listeners: mention.sourceType === "radio_session" || mention.sourceType.startsWith("podcast_") ? 24 + index * 9 : 0, mentionCount: 1 },
      isUnread: !localRead.has(mention.id), isFollowRelated: followed.has(mention.authorId) || followed.has(mention.mentionedUserId),
    })).filter((item) => query.mode === "popular" || item.isFollowRelated);
  const ranked = rankUnifiedFeedItems(inputs, Date.parse(rankingEpoch)).filter(({ item, score }) => !query.cursor || isAfterCursor(score, item, query.cursor));
  const limit = resultLimit(query.limit);
  const page = ranked.slice(0, limit);
  const items = page.map(({ item, score }): UnifiedFeedItem => ({ ...item, isSaved: localSaved.has(item.feedItemId), rankingScore: score, rankingEpoch }));
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: ranked.length > page.length && last ? { rankingScore: last.rankingScore, createdAt: last.mention.createdAt, feedItemId: last.feedItemId, rankingEpoch } : null,
    rankingEpoch,
    emptyState: items.length ? null : query.mode === "following" ? "no_followed_mentions" : "no_visible_mentions",
  };
}

export const feedQueryService = {
  async listPage(query: UnifiedFeedQuery): Promise<FeedQueryResult> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: await mockPage(query) };
    const key = pageCacheKey(query);
    const cached = pageCache.get(key);
    const bypassFresh = bypassFreshCache.delete(key);
    if (!bypassFresh && cached && Date.now() - cached.updatedAt <= PAGE_CACHE_FRESH_MS) return { ok: true, data: cached.page };
    const client = getSupabaseClient();
    if (!client) return cached && Date.now() - cached.updatedAt <= PAGE_CACHE_STALE_MS
      ? { ok: true, data: { ...cached.page, isStale: true } }
      : { ok: false, error: { code: "FEED_BACKEND_UNAVAILABLE", message: "The Feed is temporarily unavailable." } };
    const limit = resultLimit(query.limit);
    const rankingEpoch = query.cursor?.rankingEpoch ?? new Date().toISOString();
    const fetchLimit = limit + 1;
    const { data, error } = await client.rpc("list_ranked_unified_feed", {
      feed_mode: query.mode, ranking_epoch_input: rankingEpoch, cursor_rank: query.cursor?.rankingScore ?? null,
      cursor_created_at: query.cursor?.createdAt ?? null, cursor_feed_item_id: query.cursor?.feedItemId ?? null,
      source_types: query.sourceTypes?.length ? [...query.sourceTypes] : null, created_after: query.createdAfter ?? null,
      unread_only: query.unreadOnly ?? false, saved_only: query.savedOnly ?? false, result_limit: fetchLimit,
    });
    if (error) return cached && Date.now() - cached.updatedAt <= PAGE_CACHE_STALE_MS
      ? { ok: true, data: { ...cached.page, isStale: true } }
      : { ok: false, error: { code: "FEED_LOAD_FAILED", message: error.message } };
    const rows = (data ?? []) as RankedFeedRow[];
    const hasNextPage = rows.length > limit;
    const items = rows.slice(0, limit).map(mapRow);
    const last = items[items.length - 1];
    const page: UnifiedFeedPage = {
      items,
      nextCursor: hasNextPage && last ? { rankingScore: last.rankingScore, createdAt: last.mention.createdAt, feedItemId: last.feedItemId, rankingEpoch: last.rankingEpoch } : null,
      rankingEpoch,
      emptyState: items.length ? null : query.mode === "following" ? "no_followed_mentions" : "no_visible_mentions",
    };
    rememberPage(key, page);
    return { ok: true, data: page };
  },
  refresh(query: Omit<UnifiedFeedQuery, "cursor">) { const next = { ...query, cursor: null }; bypassFreshCache.add(pageCacheKey(next)); return this.listPage(next); },
  invalidateCache() { pageCache.clear(); bypassFreshCache.clear(); },
  cacheDiagnostics() { return { size: pageCache.size, maxPages: PAGE_CACHE_LIMIT, oldestAgeMs: pageCache.size ? Date.now() - Math.min(...[...pageCache.values()].map((entry) => entry.updatedAt)) : 0 } as const; },
  setMockRead(feedItemId: string, read: boolean) { if (read) localRead.add(feedItemId); else localRead.delete(feedItemId); },
  setMockSaved(feedItemId: string, saved: boolean) { if (saved) localSaved.add(feedItemId); else localSaved.delete(feedItemId); },
};
