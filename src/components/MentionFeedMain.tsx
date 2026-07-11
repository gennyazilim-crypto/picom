import { useEffect, useMemo, useState, type MouseEvent } from "react";
import "./MentionFeedMain.css";
import type { Attachment, Community, Member } from "../types/community";
import type { UpcomingEvent } from "../types/events";
import type { FriendConnection } from "../types/friends";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "../types/mentions";
import type { FollowedUserStory } from "../types/stories";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import type { ActiveVoiceRoomSummary } from "../types/voiceDiscovery";
import type { AudioFeedItem, AudioPlayableItem } from "../types/audio";
import { useAudioCatalogState } from "../hooks/useAudioCatalog";
import { rankMentionFeedItems } from "../utils/mentionFeedRanking";
import { FeedCompanionRail } from "./FeedCompanionRail";
import { FollowedPeopleStoriesHeader } from "./FollowedPeopleStoriesHeader";
import { MentionFeedHeader } from "./MentionFeedHeader";
import { UnifiedFeedList } from "./UnifiedFeedList";
import { RadioPanel } from "./audio/RadioPanel";
import { PodcastEpisodeDetail } from "./audio/PodcastEpisodeDetail";
import { useRadioScheduleReminders } from "../hooks/useRadioScheduleReminders";
import { radioService } from "../services/audio/radioService";
import { podcastService } from "../services/audio/podcastService";
import { audioFeedReadStateService } from "../services/audio/audioFeedReadStateService";
import { communityNavigationService } from "../services/community/communityNavigationService";
import { getCommunityAccess } from "../services/permissions/communityPermissions";
import { feedQueryService } from "../services/feed/feedQueryService";
import { dataSourceService } from "../services/dataSourceService";
import type { UnifiedFeedItem } from "../types/feed";

type MentionFeedMainProps = {
  items: MentionItem[];
  communities: Community[];
  friends: FriendConnection[];
  events: UpcomingEvent[];
  stories: FollowedUserStory[];
  voiceState: VoiceServiceSnapshot;
  activeVoiceRooms: ActiveVoiceRoomSummary[];
  followedUserIds: string[];
  currentUserId: string;
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
  onOpenScreenShare: () => void;
  onOpenEventCommunity: (communityId: string) => void;
  onEventDetails: (event: UpcomingEvent) => void;
  onCopyAudioReference: (item: AudioFeedItem) => void;
  onReportAudio: (item: AudioFeedItem) => void;
};

function isWithinDays(value: string, days: number) {
  const ageMs = Date.now() - new Date(value).getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function applyQuickFilter(items: MentionItem[], filter: MentionQuickFilter | null) {
  if (!filter) return items;
  if (filter === "today") return items.filter((item) => isWithinDays(item.createdAt, 1));
  if (filter === "week") return items.filter((item) => isWithinDays(item.createdAt, 7));
  if (filter === "unread") return items.filter((item) => item.isUnread);
  if (filter === "saved") return items.filter((item) => item.isSaved);
  if (filter === "text") return items;
  return [];
}

function sourceTypesForFilter(filter: MentionQuickFilter | null) {
  if (filter === "text") return ["text_message", "radio_chat"] as const;
  if (filter === "radio") return ["radio_session"] as const;
  if (filter === "podcast") return ["podcast_episode", "podcast_comment"] as const;
  return undefined;
}

function createdAfterForFilter(filter: MentionQuickFilter | null) {
  const days = filter === "today" ? 1 : filter === "week" ? 7 : 0;
  return days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
}

function applyAudioQuickFilter(items: readonly AudioFeedItem[], filter: MentionQuickFilter | null, saved: ReadonlySet<string>, read: ReadonlySet<string>) {
  if (!filter) return [...items];
  if (filter === "today") return items.filter((item) => isWithinDays(item.createdAt, 1));
  if (filter === "week") return items.filter((item) => isWithinDays(item.createdAt, 7));
  if (filter === "unread") return items.filter((item) => Boolean(item.isUnread && !read.has(item.id)));
  if (filter === "saved") return items.filter((item) => saved.has(item.id));
  if (filter === "radio") return items.filter((item) => item.type !== "podcast_episode");
  if (filter === "podcast") return items.filter((item) => item.type === "podcast_episode");
  return [];
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
  currentUserId,
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
  onOpenScreenShare,
  onOpenEventCommunity,
  onEventDetails,
  onCopyAudioReference,
  onReportAudio,
}: MentionFeedMainProps) {
  const audioCatalogState = useAudioCatalogState();
  const audioCatalog = audioCatalogState.snapshot;
  const reminderState = useRadioScheduleReminders(audioCatalog.radioSessions);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioPlayableItem | null>(null);
  const [selectedRadioSessionId, setSelectedRadioSessionId] = useState<string | null>(null);
  const [selectedPodcastEpisodeId, setSelectedPodcastEpisodeId] = useState<string | null>(null);
  const [savedAudioIds, setSavedAudioIds] = useState<Set<string>>(() => new Set(audioCatalog.feedItems.filter((item) => item.isSaved).map((item) => item.id)));
  const [readAudioIds, setReadAudioIds] = useState<Set<string>>(new Set());
  const [queriedFeedItems, setQueriedFeedItems] = useState<readonly UnifiedFeedItem[] | null>(null);
  const [feedQueryNotice, setFeedQueryNotice] = useState<string | null>(null);
  const rankingNowMs = useMemo(() => Date.now(), []);
  const feedItems = useMemo(() => rankMentionFeedItems(items, { tab: "feed", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const followingItems = useMemo(() => rankMentionFeedItems(items, { tab: "following", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const locallyVisibleItems = useMemo(() => applyQuickFilter(activeTab === "feed" ? feedItems : followingItems, activeFilter), [activeFilter, activeTab, feedItems, followingItems]);
  const visibleStories = useMemo(() => stories.filter((story) => {
    if (!story.communityId) return true;
    const community = communities.find((candidate) => candidate.id === story.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    return access.isMember || access.canViewPublicContent;
  }), [communities, currentUserId, stories]);
  const storyIds = useMemo(() => visibleStories.map((story) => story.id), [visibleStories]);
  const activeStoryIndex = activeStoryId ? storyIds.indexOf(activeStoryId) : -1;
  const accessibleAudioItems = useMemo(() => audioCatalog.feedItems.filter((item) => {
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    return access.isMember || access.canViewPublicContent;
  }), [audioCatalog.feedItems, communities, currentUserId]);
  const followedAudioItems = useMemo(() => accessibleAudioItems.filter((item) => followedUserIds.includes(item.mentionAuthorUserId ?? item.authorUserId ?? item.hostUserId ?? "")), [accessibleAudioItems, followedUserIds]);
  const locallyVisibleAudioItems = useMemo(() => applyAudioQuickFilter(activeTab === "feed" ? accessibleAudioItems : followedAudioItems, activeFilter, savedAudioIds, readAudioIds), [accessibleAudioItems, activeFilter, activeTab, followedAudioItems, readAudioIds, savedAudioIds]);
  useEffect(() => {
    let active = true;
    setQueriedFeedItems(null);
    const hostedStateFilters = dataSourceService.getStatus().isSupabase;
    void feedQueryService.refresh({
      mode: activeTab === "feed" ? "popular" : "following",
      sourceTypes: sourceTypesForFilter(activeFilter),
      followedAuthorIds: followedUserIds,
      createdAfter: createdAfterForFilter(activeFilter),
      unreadOnly: hostedStateFilters && activeFilter === "unread",
      savedOnly: hostedStateFilters && activeFilter === "saved",
      limit: 50,
    }).then((result) => {
      if (!active) return;
      if (result.ok) { setQueriedFeedItems(result.data.items); setFeedQueryNotice(result.data.isStale ? "Showing cached Feed results while Picom reconnects." : null); }
      else { setFeedQueryNotice("Live ranking is unavailable. Showing cached visible updates."); setQueriedFeedItems(null); }
    });
    return () => { active = false; };
  }, [activeFilter, activeTab, audioCatalog.feedItems, followedUserIds, items]);
  const queriedSourceOrder = useMemo(() => queriedFeedItems === null ? null : new Map(queriedFeedItems.map((item, index) => [item.mention.sourceId, index])), [queriedFeedItems]);
  const visibleItems = useMemo(() => queriedSourceOrder === null ? locallyVisibleItems : locallyVisibleItems.filter((item) => queriedSourceOrder.has(item.messageId)).sort((left, right) => (queriedSourceOrder.get(left.messageId) ?? 999) - (queriedSourceOrder.get(right.messageId) ?? 999)), [locallyVisibleItems, queriedSourceOrder]);
  const visibleAudioItems = useMemo(() => queriedSourceOrder === null ? locallyVisibleAudioItems.slice(0, 12) : locallyVisibleAudioItems.filter((item) => queriedSourceOrder.has(item.sourceId ?? item.id.replace(/^feed-/, ""))).sort((left, right) => (queriedSourceOrder.get(left.sourceId ?? left.id.replace(/^feed-/, "")) ?? 999) - (queriedSourceOrder.get(right.sourceId ?? right.id.replace(/^feed-/, "")) ?? 999)).slice(0, 12), [locallyVisibleAudioItems, queriedSourceOrder]);
  const audioReminderFeedIds = useMemo(() => new Set([...reminderState.reminderIds].map((id) => "feed-" + id)), [reminderState.reminderIds]);
  const radioEvents = useMemo<UpcomingEvent[]>(() => audioCatalog.radioSessions
    .filter((session) => session.status === "scheduled")
    .map((session) => ({
      id: "radio-event-" + session.id,
      communityId: session.communityId,
      channelId: session.channelId,
      title: session.title,
      description: session.description,
      startsAt: session.startsAt,
      endsAt: session.scheduledEndAt,
      attendeeCount: session.listenerCount,
      type: "voice",
      source: "radio",
      radioSessionId: session.id,
      reminderSet: reminderState.reminderIds.has(session.id),
      currentUserRsvp: reminderState.reminderIds.has(session.id) ? "interested" : undefined,
    })), [audioCatalog.radioSessions, reminderState.reminderIds]);
  const companionEvents = useMemo(() => [...radioEvents, ...events.filter((event) => !radioEvents.some((radioEvent) => radioEvent.id === event.id))]
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, 8), [events, radioEvents]);
  const selectAudio = (item: AudioFeedItem) => {
    if (item.type === "radio_live" || item.type === "radio_scheduled" || item.type === "radio_ended") {
      const session = audioCatalog.radioSessions.find((candidate) => candidate.id === (item.sourceId ?? item.id.replace(/^feed-/, "")));
      if (session) setSelectedRadioSessionId(session.id);
      return;
    }
    const episodeId = item.sourceId ?? item.id.replace(/^feed-/, "");
    const episode = audioCatalog.podcastEpisodes.find((candidate) => candidate.id === episodeId);
    setSelectedPodcastEpisodeId(episodeId);
    const communityName = communities.find((community) => community.id === item.communityId)?.name ?? "Picom community";
    setSelectedAudio({ id: episodeId, type: item.type, title: item.title, contextLabel: `${communityName} / ${item.type === "podcast_episode" ? "Podcast" : "Community radio"}`, coverUrl: item.coverUrl, audioUrl: episode?.audioUrl, durationSeconds: item.durationSeconds ?? episode?.durationSeconds ?? 3600, communityId: item.communityId });
  };
  const selectedRadioSession = audioCatalog.radioSessions.find((session) => session.id === selectedRadioSessionId) ?? null;
  const selectedRadioCommunity = selectedRadioSession ? communities.find((community) => community.id === selectedRadioSession.communityId) : undefined;
  const selectedPodcastEpisode = audioCatalog.podcastEpisodes.find((episode) => episode.id === selectedPodcastEpisodeId) ?? null;
  const selectedPodcastCommunity = selectedPodcastEpisode ? communities.find((community) => community.id === selectedPodcastEpisode.communityId) : undefined;
  useEffect(() => { setSavedAudioIds(new Set(audioCatalog.feedItems.filter((item) => item.isSaved).map((item) => item.id))); }, [audioCatalog.feedItems]);
  useEffect(() => { let active = true; void audioFeedReadStateService.listReadItemIds(accessibleAudioItems).then((ids) => { if (active) setReadAudioIds(ids); }); return () => { active = false; }; }, [accessibleAudioItems]);
  const toggleAudioSaved = async (item: AudioFeedItem) => {
    const wasSaved = savedAudioIds.has(item.id);
    setSavedAudioIds((current) => { const next = new Set(current); if (wasSaved) next.delete(item.id); else next.add(item.id); return next; });
    const sourceId = item.sourceId ?? item.id.replace(/^feed-/, "");
    const result = item.type === "podcast_episode" ? await (wasSaved ? podcastService.unsavePodcastEpisode(sourceId) : podcastService.savePodcastEpisode(sourceId)) : await (wasSaved ? radioService.unsaveRadio(sourceId) : radioService.saveRadio(sourceId));
    if (!result.ok) setSavedAudioIds((current) => { const next = new Set(current); if (wasSaved) next.add(item.id); else next.delete(item.id); return next; });
  };
  const reactToAudio = (item: AudioFeedItem) => {
    const sourceId = item.sourceId ?? item.id.replace(/^feed-/, "");
    const emoji = "\u{1F525}";
    const reacted = item.reactionSummary?.some((reaction) => reaction.emoji === emoji && reaction.reactedByCurrentUser) === true;
    void (async () => {
      const result = item.type === "podcast_episode"
        ? reacted ? await podcastService.removePodcastReaction(sourceId, emoji) : await podcastService.reactToPodcastEpisode(sourceId, emoji)
        : reacted ? await radioService.removeRadioReaction(sourceId, emoji) : await radioService.reactToRadio(sourceId, emoji);
      if (!result.ok) { setFeedQueryNotice(result.error.message); return; }
      await audioCatalogState.refresh();
    })();
  };
  const markAudioRead = (item: AudioFeedItem) => { setReadAudioIds((current) => new Set(current).add(item.id)); void audioFeedReadStateService.markRead(item); };
  const openAudioRadioSource = (item: AudioFeedItem) => { const sessionId = item.sourceId ?? item.id.replace(/^feed-/, ""); communityNavigationService.rememberRadioSession(item.communityId, sessionId); onOpenEventCommunity(item.communityId); };
  const toggleAudioReminder = (feedItemId: string) => {
    const session = audioCatalog.radioSessions.find((candidate) => candidate.id === feedItemId.replace(/^feed-/, ""));
    if (session) void reminderState.toggle(session);
  };
  const toggleEventReminder = (event: UpcomingEvent) => {
    const session = event.radioSessionId ? audioCatalog.radioSessions.find((candidate) => candidate.id === event.radioSessionId) : undefined;
    if (session) void reminderState.toggle(session);
  };
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
        stories={visibleStories}
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
        feedCount={feedItems.length + accessibleAudioItems.length}
        followingCount={followingItems.length + followedAudioItems.length}
        onTabChange={onTabChange}
      />
      <div className="mention-feed-body-grid">
        <div className="mention-feed-primary-list">
        {feedQueryNotice ? <p className="feed-query-notice" role="status">{feedQueryNotice}</p> : null}
        <UnifiedFeedList
          textItems={visibleItems}
          audioItems={visibleAudioItems}
          communities={communities}
          savedAudioIds={savedAudioIds}
          readAudioIds={readAudioIds}
          reminderAudioIds={audioReminderFeedIds}
          onOpenImage={onOpenImage}
          onOpenTextInChannel={onOpenInChannel}
          onToggleTextReaction={onToggleReaction}
          onToggleTextSaved={onToggleSaved}
          onMarkTextRead={onMarkRead}
          onOpenProfile={onOpenProfile}
          onOpenTextMore={onOpenMore}
          onSelectAudio={selectAudio}
          onToggleAudioSaved={(item) => { void toggleAudioSaved(item); }}
          onToggleAudioReminder={toggleAudioReminder}
          onReactAudio={reactToAudio}
          onMarkAudioRead={markAudioRead}
          onOpenCommunity={onOpenEventCommunity}
          onOpenRadio={openAudioRadioSource}
          onCopyAudioReference={onCopyAudioReference}
          onReportAudio={onReportAudio}
        />
        </div>
        <FeedCompanionRail
          voiceState={voiceState}
          activeVoiceRooms={activeVoiceRooms}
          friends={friends}
          events={companionEvents}
          communities={communities}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onLeaveVoice={onLeaveVoice}
          onOpenVoiceRoom={onOpenVoiceRoom}
          onOpenScreenShare={onOpenScreenShare}
          onOpenProfile={onOpenProfile}
          onOpenEventCommunity={onOpenEventCommunity}
          onEventDetails={onEventDetails}
          onToggleEventReminder={toggleEventReminder}
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
      {selectedPodcastEpisode ? <div className="podcast-detail-modal-backdrop" role="presentation" onMouseDown={() => setSelectedPodcastEpisodeId(null)}><div className="podcast-detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedPodcastEpisode.title} podcast detail`} onMouseDown={(event) => event.stopPropagation()}><PodcastEpisodeDetail episode={selectedPodcastEpisode} communityName={selectedPodcastCommunity?.name ?? "Picom community"} author={selectedPodcastCommunity?.members.find((member) => member.userId === selectedPodcastEpisode.authorUserId)} relatedEpisodes={audioCatalog.podcastEpisodes.filter((episode) => episode.communityId === selectedPodcastEpisode.communityId && episode.status === "published")} getCommentAuthorLabel={(authorId) => selectedPodcastCommunity?.members.find((member) => member.userId === authorId)?.displayName ?? "Community member"} onClose={() => setSelectedPodcastEpisodeId(null)} onOpenCommunity={() => { setSelectedPodcastEpisodeId(null); onOpenEventCommunity(selectedPodcastEpisode.communityId); }} onOpenAuthor={onOpenProfile} onSelectEpisode={(episode) => setSelectedPodcastEpisodeId(episode.id)} /></div></div> : null}
    </main>
  );
}
