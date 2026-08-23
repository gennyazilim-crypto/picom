import type { LiveScreenShareCategory, LiveScreenShareSummary } from "../../types/liveScreenShare";
import { selectFeaturedLiveShare, sortLiveShares } from "../../services/live/liveScreenShareScoring.ts";

export const JUST_STARTED_WINDOW_MS = 15 * 60 * 1000;
export const FEATURED_SELECTOR_LIMIT = 8;

export const LIVE_CATEGORY_META: ReadonlyArray<
  Readonly<{ id: LiveScreenShareCategory; label: string }>
> = [
  { id: "game", label: "Game" },
  { id: "chat", label: "Chat" },
  { id: "education", label: "Education" },
  { id: "watch_together", label: "Watch together" },
  { id: "other", label: "Other" },
];

export type LiveCategoryBucket = Readonly<{
  id: LiveScreenShareCategory;
  label: string;
  liveCount: number;
}>;

export function categoryLabel(category: LiveScreenShareCategory): string {
  return LIVE_CATEGORY_META.find((item) => item.id === category)?.label ?? "Other";
}

export function buildCategoryBuckets(items: readonly LiveScreenShareSummary[]): readonly LiveCategoryBucket[] {
  const counts = new Map<LiveScreenShareCategory, number>();
  for (const item of items) {
    if (item.status !== "live" && item.status !== "reconnecting") continue;
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return LIVE_CATEGORY_META.map((meta) => ({
    id: meta.id,
    label: meta.label,
    liveCount: counts.get(meta.id) ?? 0,
  })).filter((bucket) => bucket.liveCount > 0);
}

export function isJustStarted(share: LiveScreenShareSummary, now = Date.now()): boolean {
  const started = Date.parse(share.startedAt);
  if (!Number.isFinite(started)) return false;
  return now - started < JUST_STARTED_WINDOW_MS;
}

export function partitionLiveDiscovery(
  items: readonly LiveScreenShareSummary[],
  options: Readonly<{ memberItems?: readonly LiveScreenShareSummary[]; now?: number }> = {},
) {
  const now = options.now ?? Date.now();
  const active = items.filter((item) => item.status === "live" || item.status === "reconnecting");
  const featured = selectFeaturedLiveShare(active);
  const featuredSelectors = sortLiveShares(active, "recommended").slice(0, FEATURED_SELECTOR_LIMIT);
  const friendsWatching = active.filter((item) => item.friendViewerIds.length > 0);
  const justStarted = sortLiveShares(
    active.filter((item) => isJustStarted(item, now)),
    "newest",
  );
  const risingFast = sortLiveShares(
    active.filter((item) => !isJustStarted(item, now)),
    "viewers",
  );
  const memberLive = options.memberItems
    ? options.memberItems.filter((item) => item.status === "live" || item.status === "reconnecting")
    : [];

  return {
    featured,
    featuredSelectors,
    categories: buildCategoryBuckets(active),
    memberLive,
    friendsWatching,
    risingFast,
    justStarted,
    activeGrid: sortLiveShares(active, "recommended"),
  } as const;
}
