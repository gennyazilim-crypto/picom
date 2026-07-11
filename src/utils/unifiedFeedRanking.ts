import type { UnifiedContentMention } from "../types/contentMentions";
import type { UnifiedFeedMetrics } from "../types/feed";

export type UnifiedFeedRankingInput = Readonly<{
  feedItemId: string; mention: UnifiedContentMention; mentionedUserIds: readonly string[];
  metrics: UnifiedFeedMetrics; isUnread: boolean; isFollowRelated: boolean;
}>;

const HOUR_MS = 60 * 60 * 1000;
const RECENCY_WINDOW_HOURS = 7 * 24;
const bounded = (value: number, maximum: number) => Number.isFinite(value) ? Math.min(Math.max(value, 0), maximum) : 0;

export function scoreUnifiedFeedItem(item: UnifiedFeedRankingInput, rankingEpochMs: number): number {
  const ageHours = Math.max(0, (rankingEpochMs - Date.parse(item.mention.createdAt)) / HOUR_MS);
  const recency = Math.max(0, 36 * (1 - ageHours / RECENCY_WINDOW_HOURS));
  const reactions = Math.min(14, Math.sqrt(bounded(item.metrics.reactions, 100_000)) * 2.4);
  const comments = Math.min(10, Math.sqrt(bounded(item.metrics.comments, 100_000)) * 2.2);
  const listeners = Math.min(12, Math.log1p(bounded(item.metrics.listeners, 1_000_000)) * 1.8);
  const sourceWeight = item.mention.sourceType === "radio_session" ? 3
    : item.mention.sourceType === "podcast_episode" || item.mention.sourceType === "podcast_comment" ? 2 : 0;
  return (item.isFollowRelated ? 24 : 0) + (item.isUnread ? 18 : 0) + reactions + comments + listeners + sourceWeight + recency;
}

export function rankUnifiedFeedItems(items: readonly UnifiedFeedRankingInput[], rankingEpochMs: number) {
  return items.map((item) => ({ item, score: scoreUnifiedFeedItem(item, rankingEpochMs) })).sort((left, right) => {
    const scoreDelta = right.score - left.score;
    if (Math.abs(scoreDelta) > Number.EPSILON) return scoreDelta;
    const createdDelta = Date.parse(right.item.mention.createdAt) - Date.parse(left.item.mention.createdAt);
    if (Number.isFinite(createdDelta) && createdDelta !== 0) return createdDelta;
    return right.item.feedItemId.localeCompare(left.item.feedItemId);
  });
}
