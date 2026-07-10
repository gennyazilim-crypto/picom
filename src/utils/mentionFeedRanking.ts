import type { MentionFeedTab, MentionItem } from "../types/mentions";

export type MentionRankingOptions = Readonly<{
  tab: MentionFeedTab;
  followedUserIds: readonly string[];
  isAccessible: (item: MentionItem) => boolean;
  nowMs?: number;
}>;

const HOUR_MS = 60 * 60 * 1000;
const RECENCY_WINDOW_HOURS = 7 * 24;

function bounded(value: number | null | undefined, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), maximum);
}

function reactionCount(item: MentionItem): number {
  return (item.reactions ?? []).reduce((total, reaction) => total + bounded(reaction.count, 10_000), 0);
}

function recencyScore(createdAt: string, nowMs: number): number {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return 0;
  const ageHours = Math.max(0, (nowMs - createdAtMs) / HOUR_MS);
  return Math.max(0, 36 * (1 - ageHours / RECENCY_WINDOW_HOURS));
}

export function scoreMentionItem(item: MentionItem, followedUserIds: ReadonlySet<string>, nowMs: number): number {
  const authorFollowed = followedUserIds.has(item.authorId);
  const mentionsFollowedUser = item.mentionedUserIds.some((userId) => followedUserIds.has(userId));
  const followScore = (authorFollowed ? 24 : 0) + (mentionsFollowedUser ? 8 : 0);
  const unreadScore = item.isUnread ? 18 : 0;
  const popularityScore = bounded(item.popularityScore, 100) * 0.24;
  const reactionsScore = Math.min(14, Math.sqrt(reactionCount(item)) * 2.4);
  const repliesScore = Math.min(10, Math.sqrt(bounded(item.commentCount, 10_000)) * 2.2);

  return followScore + unreadScore + popularityScore + reactionsScore + repliesScore + recencyScore(item.createdAt, nowMs);
}

export function rankMentionFeedItems(items: readonly MentionItem[], options: MentionRankingOptions): MentionItem[] {
  const followed = new Set(options.followedUserIds);
  const nowMs = options.nowMs ?? Date.now();

  return items
    .filter(options.isAccessible)
    .filter((item) => options.tab === "feed"
      ? item.source === "popular_feed"
      : item.source === "following" && (followed.has(item.authorId) || item.mentionedUserIds.some((userId) => followed.has(userId))))
    .map((item) => ({ item, score: scoreMentionItem(item, followed, nowMs) }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (Math.abs(scoreDelta) > Number.EPSILON) return scoreDelta;
      const createdDelta = Date.parse(right.item.createdAt) - Date.parse(left.item.createdAt);
      if (Number.isFinite(createdDelta) && createdDelta !== 0) return createdDelta;
      return left.item.id.localeCompare(right.item.id);
    })
    .map(({ item }) => item);
}
