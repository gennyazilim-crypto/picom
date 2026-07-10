import { useMemo, useState, type MouseEvent } from "react";
import type { Attachment, Community, Member } from "../types/community";
import type { UpcomingEvent } from "../types/events";
import type { FriendConnection } from "../types/friends";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "../types/mentions";
import type { FollowedUserStory } from "../types/stories";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import type { ActiveVoiceRoomSummary } from "../types/voiceDiscovery";
import { rankMentionFeedItems } from "../utils/mentionFeedRanking";
import { FeedCompanionRail } from "./FeedCompanionRail";
import { FollowedPeopleStoriesHeader } from "./FollowedPeopleStoriesHeader";
import { MentionFeedHeader } from "./MentionFeedHeader";
import { MentionFeedList } from "./MentionFeedList";

type MentionFeedMainProps = {
  items: MentionItem[];
  communities: Community[];
  friends: FriendConnection[];
  events: UpcomingEvent[];
  stories: FollowedUserStory[];
  voiceState: VoiceServiceSnapshot;
  activeVoiceRooms: ActiveVoiceRoomSummary[];
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
  onMarkStorySeen: (storyId: string) => void;
  onOpenStoryInChannel: (story: FollowedUserStory) => void;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenVoiceRoom: (room: ActiveVoiceRoomSummary) => void;
  onScreenSharePlaceholder: () => void;
  onOpenEventCommunity: (communityId: string) => void;
  onEventDetails: (event: UpcomingEvent) => void;
};

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
  friends,
  events,
  stories,
  voiceState,
  activeVoiceRooms,
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
  onMarkStorySeen,
  onOpenStoryInChannel,
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onLeaveVoice,
  onOpenVoiceRoom,
  onScreenSharePlaceholder,
  onOpenEventCommunity,
  onEventDetails,
}: MentionFeedMainProps) {
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const rankingNowMs = useMemo(() => Date.now(), []);
  const feedItems = useMemo(() => rankMentionFeedItems(items, { tab: "feed", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const followingItems = useMemo(() => rankMentionFeedItems(items, { tab: "following", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const visibleItems = useMemo(() => applyQuickFilter(activeTab === "feed" ? feedItems : followingItems, activeFilter), [activeFilter, activeTab, feedItems, followingItems]);
  const storyIds = useMemo(() => stories.map((story) => story.id), [stories]);
  const activeStoryIndex = activeStoryId ? storyIds.indexOf(activeStoryId) : -1;
  const openStory = (storyId: string) => {
    setActiveStoryId(storyId);
    onMarkStorySeen(storyId);
  };
  const closeStory = () => setActiveStoryId(null);
  const previousStory = () => {
    if (!storyIds.length || activeStoryIndex < 0) return;
    openStory(storyIds[(activeStoryIndex - 1 + storyIds.length) % storyIds.length]);
  };
  const nextStory = () => {
    if (!storyIds.length || activeStoryIndex < 0) return;
    openStory(storyIds[(activeStoryIndex + 1) % storyIds.length]);
  };

  return (
    <main className="mention-feed-main" aria-label="Home mention feed">
      <FollowedPeopleStoriesHeader
        stories={stories}
        communities={communities}
        activeStoryId={activeStoryId}
        onOpenStory={openStory}
        onCloseStory={closeStory}
        onPreviousStory={previousStory}
        onNextStory={nextStory}
        onOpenStoryProfile={onOpenProfile}
        onOpenStoryInChannel={onOpenStoryInChannel}
      />
      <MentionFeedHeader
        activeTab={activeTab}
        feedCount={feedItems.length}
        followingCount={followingItems.length}
        onTabChange={onTabChange}
      />
      <div className="mention-feed-body-grid">
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
        <FeedCompanionRail
          voiceState={voiceState}
          activeVoiceRooms={activeVoiceRooms}
          friends={friends}
          events={events}
          communities={communities}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onLeaveVoice={onLeaveVoice}
          onOpenVoiceRoom={onOpenVoiceRoom}
          onScreenSharePlaceholder={onScreenSharePlaceholder}
          onOpenProfile={onOpenProfile}
          onOpenEventCommunity={onOpenEventCommunity}
          onEventDetails={onEventDetails}
        />
      </div>
    </main>
  );
}
