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
import { useAudioCatalog } from "../hooks/useAudioCatalog";
import { rankMentionFeedItems } from "../utils/mentionFeedRanking";
import { FeedCompanionRail } from "./FeedCompanionRail";
import { FollowedPeopleStoriesHeader } from "./FollowedPeopleStoriesHeader";
import { MentionFeedHeader } from "./MentionFeedHeader";
import { MentionFeedList } from "./MentionFeedList";
import { AudioFeedSection } from "./audio/AudioFeedSection";
import { RadioPanel } from "./audio/RadioPanel";
import { PodcastEpisodeDetail } from "./audio/PodcastEpisodeDetail";
import { useRadioScheduleReminders } from "../hooks/useRadioScheduleReminders";
import { radioService } from "../services/audio/radioService";
import { podcastService } from "../services/audio/podcastService";
import { audioFeedReadStateService } from "../services/audio/audioFeedReadStateService";
import { communityNavigationService } from "../services/community/communityNavigationService";
import { getCommunityAccess } from "../services/permissions/communityPermissions";

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
  onScreenSharePlaceholder,
  onOpenEventCommunity,
  onEventDetails,
}: MentionFeedMainProps) {
  const audioCatalog = useAudioCatalog();
  const reminderState = useRadioScheduleReminders(audioCatalog.radioSessions);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioPlayableItem | null>(null);
  const [selectedRadioSessionId, setSelectedRadioSessionId] = useState<string | null>(null);
  const [selectedPodcastEpisodeId, setSelectedPodcastEpisodeId] = useState<string | null>(null);
  const [savedAudioIds, setSavedAudioIds] = useState<Set<string>>(() => new Set(audioCatalog.feedItems.filter((item) => item.isSaved).map((item) => item.id)));
  const [readAudioIds, setReadAudioIds] = useState<Set<string>>(new Set());
  const rankingNowMs = useMemo(() => Date.now(), []);
  const feedItems = useMemo(() => rankMentionFeedItems(items, { tab: "feed", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const followingItems = useMemo(() => rankMentionFeedItems(items, { tab: "following", followedUserIds, isAccessible: () => true, nowMs: rankingNowMs }), [followedUserIds, items, rankingNowMs]);
  const visibleItems = useMemo(() => applyQuickFilter(activeTab === "feed" ? feedItems : followingItems, activeFilter), [activeFilter, activeTab, feedItems, followingItems]);
  const storyIds = useMemo(() => stories.map((story) => story.id), [stories]);
  const activeStoryIndex = activeStoryId ? storyIds.indexOf(activeStoryId) : -1;
  const accessibleAudioItems = useMemo(() => audioCatalog.feedItems.filter((item) => {
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    return access.isMember || access.canViewPublicContent;
  }), [audioCatalog.feedItems, communities, currentUserId]);
  const visibleAudioItems = useMemo(() => activeTab === "feed" ? accessibleAudioItems.slice(0, 6) : accessibleAudioItems.filter((item) => followedUserIds.includes(item.mentionAuthorUserId ?? item.authorUserId ?? item.hostUserId ?? "")).slice(0, 6), [accessibleAudioItems, activeTab, followedUserIds]);
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
  const reactToAudio = (item: AudioFeedItem) => { const sourceId = item.sourceId ?? item.id.replace(/^feed-/, ""); const reacted = item.reactionSummary?.some((reaction) => reaction.emoji === "🔥" && reaction.reactedByCurrentUser) === true; void (item.type === "podcast_episode" ? reacted ? podcastService.removePodcastReaction(sourceId, "🔥") : podcastService.reactToPodcastEpisode(sourceId, "🔥") : radioService.reactToRadio(sourceId, "🔥")); };
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
        <AudioFeedSection items={visibleAudioItems} communities={communities} savedIds={savedAudioIds} readIds={readAudioIds} reminderIds={audioReminderFeedIds} onSelect={selectAudio} onToggleSaved={(item) => { void toggleAudioSaved(item); }} onToggleReminder={toggleAudioReminder} onReact={reactToAudio} onMarkRead={markAudioRead} onOpenCommunity={onOpenEventCommunity} onOpenRadio={openAudioRadioSource} onOpenProfile={onOpenProfile} />
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
          events={companionEvents}
          communities={communities}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onLeaveVoice={onLeaveVoice}
          onOpenVoiceRoom={onOpenVoiceRoom}
          onScreenSharePlaceholder={onScreenSharePlaceholder}
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
