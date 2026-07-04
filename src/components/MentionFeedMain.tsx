import { useMemo, type MouseEvent } from "react";
import type { Attachment, Community, Member } from "../types/community";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "../types/mentions";
import { MentionFeedHeader } from "./MentionFeedHeader";
import { MentionFeedList } from "./MentionFeedList";

type MentionFeedMainProps = {
  items: MentionItem[];
  communities: Community[];
  followedUserIds: string[];
  activeTab: MentionFeedTab;
  activeFilter: MentionQuickFilter | null;
  onTabChange: (tab: MentionFeedTab) => void;
  onOpenImage: (attachment: Attachment) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onToggleReaction: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenMore: (event: MouseEvent, item: MentionItem) => void;
};

function sortPopular(left: MentionItem, right: MentionItem) {
  if (Boolean(left.isUnread) !== Boolean(right.isUnread)) return left.isUnread ? -1 : 1;
  const scoreDelta = (right.popularityScore ?? 0) - (left.popularityScore ?? 0);
  if (scoreDelta !== 0) return scoreDelta;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function sortFollowing(left: MentionItem, right: MentionItem) {
  if (Boolean(left.isUnread) !== Boolean(right.isUnread)) return left.isUnread ? -1 : 1;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function isWithinDays(value: string, days: number) {
  const ageMs = Date.UTC(2026, 6, 4, 23, 59, 0) - new Date(value).getTime();
  return ageMs <= days * 24 * 60 * 60 * 1000;
}

function applyQuickFilter(items: MentionItem[], filter: MentionQuickFilter | null) {
  if (!filter) return items;
  if (filter === "today") return items.filter((item) => isWithinDays(item.createdAt, 1));
  if (filter === "week") return items.filter((item) => isWithinDays(item.createdAt, 7));
  if (filter === "unread") return items.filter((item) => item.isUnread);
  return items.filter((item) => item.isSaved);
}

export function MentionFeedMain({
  items,
  communities,
  followedUserIds,
  activeTab,
  activeFilter,
  onTabChange,
  onOpenImage,
  onOpenInChannel,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenProfile,
  onOpenMore,
}: MentionFeedMainProps) {
  const followedSet = useMemo(() => new Set(followedUserIds), [followedUserIds]);
  const feedItems = useMemo(() => items.filter((item) => item.source === "popular_feed").sort(sortPopular), [items]);
  const followingItems = useMemo(
    () =>
      items
        .filter((item) => item.source === "following" && (followedSet.has(item.authorId) || item.mentionedUserIds.some((id) => followedSet.has(id))))
        .sort(sortFollowing),
    [followedSet, items],
  );
  const visibleItems = applyQuickFilter(activeTab === "feed" ? feedItems : followingItems, activeFilter);

  return (
    <main className="mention-feed-main" aria-label="Home mention feed">
      <MentionFeedHeader
        activeTab={activeTab}
        feedCount={feedItems.length}
        followingCount={followingItems.length}
        onTabChange={onTabChange}
      />
      <MentionFeedList
        items={visibleItems}
        communities={communities}
        onOpenImage={onOpenImage}
        onOpenInChannel={onOpenInChannel}
        onToggleReaction={onToggleReaction}
        onToggleSaved={onToggleSaved}
        onMarkRead={onMarkRead}
        onOpenProfile={onOpenProfile}
        onOpenMore={onOpenMore}
      />
    </main>
  );
}
