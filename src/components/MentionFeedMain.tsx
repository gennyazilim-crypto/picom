import { useMemo, useState, type MouseEvent } from "react";
import type { Attachment, Community, Member } from "../types/community";
import type { UpcomingEvent } from "../types/events";
import type { FriendConnection } from "../types/friends";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "../types/mentions";
import type { FollowedUserStory } from "../types/stories";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import type { ActiveVoiceRoomSummary } from "../types/voiceDiscovery";
import type { AudioFeedItem, AudioPlayableItem } from "../types/audio";
import { mockAudioFeedItems, mockRadioSessions } from "../data/mockAudio";
import { rankMentionFeedItems } from "../utils/mentionFeedRanking";
import { FeedCompanionRail } from "./FeedCompanionRail";
import { FollowedPeopleStoriesHeader } from "./FollowedPeopleStoriesHeader";
import { MentionFeedHeader } from "./MentionFeedHeader";
import { MentionFeedList } from "./MentionFeedList";
import { AudioFeedSection } from "./audio/AudioFeedSection";
import { RadioPanel } from "./audio/RadioPanel";

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
  const [selectedAudio, setSelectedAudio] = useState<AudioPlayableItem | null>(null);
  const [selectedRadioSessionId, setSelectedRadioSessionId] = useState<string | null>(null);
  const [savedAudioIds, setSavedAudioIds] = useState<Set<string>>(() => new Set(mockAudioFeedItems.filter((item) => item.isSaved).map((item) => item.id)));
  const [audioReminderIds, setAudioReminderIds] = useState<Set<string>>(() => new Set());
  const rankingNowMs = useMemo(() => Date.now(), []);
  const feedItems = useMemo(() => rankMentionFeedItems(items, { tab: "feed", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const followingItems = useMemo(() => rankMentionFeedItems(items, { tab: "following", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const visibleItems = useMemo(() => applyQuickFilter(activeTab === "feed" ? feedItems : followingItems, activeFilter), [activeFilter, activeTab, feedItems, followingItems]);
  const storyIds = useMemo(() => stories.map((story) => story.id), [stories]);
  const activeStoryIndex = activeStoryId ? storyIds.indexOf(activeStoryId) : -1;
  const visibleAudioItems = useMemo(() => activeTab === "feed" ? mockAudioFeedItems.slice(0, 6) : mockAudioFeedItems.filter((item) => followedUserIds.includes(item.authorUserId ?? item.hostUserId ?? "")).slice(0, 6), [activeTab, followedUserIds]);
  const selectAudio = (item: AudioFeedItem) => {
    if (item.type === "radio_live" || item.type === "radio_scheduled") {
      const session = mockRadioSessions.find((candidate) => candidate.id === item.id.replace(/^feed-/, ""));
      if (session) setSelectedRadioSessionId(session.id);
      return;
    }
    const communityName = communities.find((community) => community.id === item.communityId)?.name ?? "Picom community";
    setSelectedAudio({ id: item.id, type: item.type, title: item.title, contextLabel: `${communityName} / ${item.type === "podcast_episode" ? "Podcast" : "Community radio"}`, coverUrl: item.coverUrl, durationSeconds: item.durationSeconds ?? 3600 });
  };
  const selectedRadioSession = mockRadioSessions.find((session) => session.id === selectedRadioSessionId) ?? null;
  const selectedRadioCommunity = selectedRadioSession ? communities.find((community) => community.id === selectedRadioSession.communityId) : undefined;
  const toggleAudioSet = (setter: (value: Set<string>) => void, current: Set<string>, id: string) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); setter(next); };
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
        <div className="mention-feed-primary-list">
        <AudioFeedSection items={visibleAudioItems} communities={communities} savedIds={savedAudioIds} reminderIds={audioReminderIds} onSelect={selectAudio} onToggleSaved={(id) => toggleAudioSet(setSavedAudioIds, savedAudioIds, id)} onToggleReminder={(id) => toggleAudioSet(setAudioReminderIds, audioReminderIds, id)} onOpenCommunity={onOpenEventCommunity} />
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
        </div>
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
          audioItem={selectedAudio}
          onCloseAudio={() => setSelectedAudio(null)}
        />
      </div>
      {selectedRadioSession ? <div className="radio-panel-modal-backdrop" role="presentation" onMouseDown={() => setSelectedRadioSessionId(null)}>
        <div className="radio-panel-modal" role="dialog" aria-modal="true" aria-label={`${selectedRadioSession.title} radio panel`} onMouseDown={(event) => event.stopPropagation()}>
          <RadioPanel
            session={selectedRadioSession}
            communityName={selectedRadioCommunity?.name ?? "Picom community"}
            host={selectedRadioCommunity?.members.find((member) => member.userId === selectedRadioSession.hostUserId)}
            listeners={selectedRadioCommunity?.members.filter((member) => member.status !== "offline") ?? []}
            canHost={false}
            onClose={() => setSelectedRadioSessionId(null)}
            onOpenCommunity={() => { setSelectedRadioSessionId(null); onOpenEventCommunity(selectedRadioSession.communityId); }}
          />
        </div>
      </div> : null}
    </main>
  );
}
