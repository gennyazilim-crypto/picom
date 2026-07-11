import { mockUnifiedContentMentions } from "../../data/mockUnifiedContentMentions";
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
const resultLimit = (value?: number) => Math.max(1, Math.min(50, Math.trunc(value ?? 20)));

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

function mockPage(query: UnifiedFeedQuery): UnifiedFeedPage {
  const rankingEpoch = query.cursor?.rankingEpoch ?? new Date().toISOString();
  const followed = new Set(query.followedAuthorIds ?? []);
  const inputs: UnifiedFeedRankingInput[] = mockUnifiedContentMentions
    .filter((mention) => !query.sourceTypes?.length || query.sourceTypes.includes(mention.sourceType))
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
    if (dataSourceService.getStatus().isMock) return { ok: true, data: mockPage(query) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "FEED_BACKEND_UNAVAILABLE", message: "The Feed is temporarily unavailable." } };
    const limit = resultLimit(query.limit);
    const rankingEpoch = query.cursor?.rankingEpoch ?? new Date().toISOString();
    const { data, error } = await client.rpc("list_ranked_unified_feed", {
      feed_mode: query.mode, ranking_epoch_input: rankingEpoch, cursor_rank: query.cursor?.rankingScore ?? null,
      cursor_created_at: query.cursor?.createdAt ?? null, cursor_feed_item_id: query.cursor?.feedItemId ?? null,
      source_types: query.sourceTypes?.length ? [...query.sourceTypes] : null, result_limit: limit,
    });
    if (error) return { ok: false, error: { code: "FEED_LOAD_FAILED", message: error.message } };
    const items = ((data ?? []) as RankedFeedRow[]).map(mapRow);
    const last = items[items.length - 1];
    return { ok: true, data: {
      items,
      nextCursor: items.length === limit && last ? { rankingScore: last.rankingScore, createdAt: last.mention.createdAt, feedItemId: last.feedItemId, rankingEpoch: last.rankingEpoch } : null,
      rankingEpoch,
      emptyState: items.length ? null : query.mode === "following" ? "no_followed_mentions" : "no_visible_mentions",
    } };
  },
  refresh(query: Omit<UnifiedFeedQuery, "cursor">) { return this.listPage({ ...query, cursor: null }); },
  setMockRead(feedItemId: string, read: boolean) { if (read) localRead.add(feedItemId); else localRead.delete(feedItemId); },
  setMockSaved(feedItemId: string, saved: boolean) { if (saved) localSaved.add(feedItemId); else localSaved.delete(feedItemId); },
};
