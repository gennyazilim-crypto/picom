import type { LiveBadgeCount, LiveScreenShareSort, LiveScreenShareStatus, LiveScreenShareSummary } from "../../types/liveScreenShare";

const BADGE_CAP = 99;

/** Nav badge formatting: 0 (or invalid) hides the badge, large counts cap at "99+". */
export function formatLiveBadge(count: number): LiveBadgeCount {
  if (!Number.isFinite(count)) return null;
  const normalized = Math.max(0, Math.trunc(count));
  if (normalized <= 0) return null;
  if (normalized > BADGE_CAP) return "99+";
  return normalized;
}

export type RelevanceScoreInput = Readonly<{
  isMember: boolean;
  isFollowingBroadcaster: boolean;
  viewerCount: number;
  startedAt: string | number | Date;
  status: LiveScreenShareStatus;
  /** Injectable clock for deterministic tests; defaults to Date.now(). */
  now?: number;
}>;

const MEMBER_WEIGHT = 40;
const FOLLOWING_WEIGHT = 25;
const VIEWER_CAP = 50;
const RECENT_BONUS = 12;
const RECENT_WINDOW_MS = 15 * 60 * 1000;
const LIVE_STATUS_BONUS = 8;

/**
 * Client-side mirror of the `list_visible_live_screen_sessions` relevance formula
 * (see `refresh_live_screen_session_viewer_count` / scoring CTE in the migration).
 * Used for optimistic re-ranking before a fresh server list lands; the server score
 * (`relevanceScore` on `LiveScreenShareSummary`) remains the source of truth.
 */
export function computeClientRelevanceScore(input: RelevanceScoreInput): number {
  const startedAtMs = new Date(input.startedAt).getTime();
  const now = input.now ?? Date.now();
  const isRecent = Number.isFinite(startedAtMs) && now - startedAtMs < RECENT_WINDOW_MS;

  return (
    (input.isMember ? MEMBER_WEIGHT : 0)
    + (input.isFollowingBroadcaster ? FOLLOWING_WEIGHT : 0)
    + Math.min(Math.max(input.viewerCount, 0), VIEWER_CAP)
    + (isRecent ? RECENT_BONUS : 0)
    + (input.status === "live" ? LIVE_STATUS_BONUS : 0)
  );
}

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareStringDescending(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

function sortValue(item: LiveScreenShareSummary, sort: LiveScreenShareSort): number {
  switch (sort) {
    case "viewers":
      return item.viewerCount;
    case "newest":
      return new Date(item.startedAt).getTime();
    case "longest":
      return -new Date(item.startedAt).getTime();
    case "recommended":
    default:
      return item.relevanceScore;
  }
}

/**
 * Mirrors the `order by` clause of `list_visible_live_screen_sessions`: primary sort key
 * by mode, then started_at desc, then id desc, all as stable tie-breakers.
 */
export function sortLiveShares<T extends LiveScreenShareSummary>(items: readonly T[], sort: LiveScreenShareSort): T[] {
  return [...items].sort((left, right) => {
    const primary = compareDescending(sortValue(left, sort), sortValue(right, sort));
    if (primary !== 0) return primary;

    const startedAtDiff = compareDescending(new Date(left.startedAt).getTime(), new Date(right.startedAt).getTime());
    if (startedAtDiff !== 0) return startedAtDiff;

    return compareStringDescending(left.id, right.id);
  });
}

/** Picks the highest-relevance item, used for the Live nav rail's featured preview card. */
export function selectFeaturedLiveShare<T extends LiveScreenShareSummary>(items: readonly T[]): T | null {
  if (!items.length) return null;
  return items.reduce((best, current) => (current.relevanceScore > best.relevanceScore ? current : best));
}
