import { useMemo, useState } from "react";
import type { Community } from "../../types/community";
import type { AudioPlayableItem, PodcastEpisode, RadioSession } from "../../types/audio";
import { mockPodcastEpisodes, mockRadioSessions } from "../../data/mockAudio";
import { AppIcon } from "../AppIcon";
import { AudioMiniPlayer } from "./AudioMiniPlayer";

type CommunityAudioTab = "live" | "podcasts" | "scheduled";

type CommunityAudioViewProps = {
  community: Community;
  canManageAudio: boolean;
  onPlaceholderAction: (message: string) => void;
};

type CommunityAudioHeaderProps = {
  communityName: string;
  activeTab: CommunityAudioTab;
  canManageAudio: boolean;
  onSelectTab: (tab: CommunityAudioTab) => void;
  onPlaceholderAction: (message: string) => void;
};

export function CommunityAudioHeader({ communityName, activeTab, canManageAudio, onSelectTab, onPlaceholderAction }: CommunityAudioHeaderProps) {
  const tabs: Array<{ id: CommunityAudioTab; label: string }> = [
    { id: "live", label: "Live Radio" },
    { id: "podcasts", label: "Podcasts" },
    { id: "scheduled", label: "Scheduled" },
  ];

  return <header className="community-audio-header">
    <div className="community-audio-heading">
      <span className="community-audio-heading-icon" aria-hidden="true"><AppIcon name="headphones" size="lg" /></span>
      <div>
        <span className="community-audio-eyebrow">{communityName}</span>
        <h1>Community Audio</h1>
        <p>Live conversations, scheduled rooms, and member podcasts.</p>
      </div>
    </div>

    <div className="community-audio-header-actions">
      {canManageAudio ? <>
        <button type="button" className="secondary-button compact" onClick={() => onPlaceholderAction("New podcast publishing is prepared for a later backend task.")}>
          <AppIcon name="plus" size="sm" />New Podcast
        </button>
        <button type="button" className="primary-button compact" onClick={() => onPlaceholderAction("Radio hosting is prepared for a later realtime audio task.")}>
          <AppIcon name="headphones" size="sm" />Start Radio
        </button>
      </> : null}
    </div>

    <div className="community-audio-tabs" role="tablist" aria-label="Community audio sections">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onSelectTab(tab.id)}>{tab.label}</button>)}
    </div>
  </header>;
}

type CommunityAudioCardProps = {
  title: string;
  subtitle: string;
  description: string;
  coverUrl?: string;
  badge: string;
  meta: string;
  actionLabel: string;
  isSaved?: boolean;
  onPlay: () => void;
  onToggleSaved?: () => void;
};

export function CommunityAudioCard({ title, subtitle, description, coverUrl, badge, meta, actionLabel, isSaved, onPlay, onToggleSaved }: CommunityAudioCardProps) {
  return <article className="community-audio-card">
    <div className="community-audio-cover" aria-hidden="true">
      {coverUrl ? <img src={coverUrl} alt="" /> : <AppIcon name="headphones" size="xl" />}
      <span>{badge}</span>
    </div>
    <div className="community-audio-card-copy">
      <span>{subtitle}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <small>{meta}</small>
    </div>
    <div className="community-audio-card-actions">
      {onToggleSaved ? <button type="button" className={`icon-button ${isSaved ? "active" : ""}`} aria-label={isSaved ? `Remove ${title} from saved audio` : `Save ${title}`} title={isSaved ? "Saved" : "Save"} onClick={onToggleSaved}><AppIcon name="pin" size="sm" /></button> : null}
      <button type="button" className="primary-button compact" onClick={onPlay}><AppIcon name="play" size="sm" />{actionLabel}</button>
    </div>
  </article>;
}

type RadioSessionListProps = {
  sessions: RadioSession[];
  scheduled?: boolean;
  reminderIds: Set<string>;
  getUserLabel: (userId: string) => string;
  onListen: (session: RadioSession) => void;
  onToggleReminder: (sessionId: string) => void;
};

export function RadioSessionList({ sessions, scheduled = false, reminderIds, getUserLabel, onListen, onToggleReminder }: RadioSessionListProps) {
  if (!sessions.length) return <div className="community-audio-empty">No radio sessions are available in this section yet.</div>;
  return <div className="community-audio-list">
    {sessions.map((session) => <CommunityAudioCard
      key={session.id}
      title={session.title}
      subtitle={getUserLabel(session.hostUserId)}
      description={session.description}
      coverUrl={session.coverUrl}
      badge={scheduled ? "UPCOMING" : "LIVE"}
      meta={scheduled ? new Date(session.startsAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : `${session.listenerCount} listening`}
      actionLabel={scheduled ? "Preview" : "Listen"}
      isSaved={scheduled ? reminderIds.has(session.id) : undefined}
      onToggleSaved={scheduled ? () => onToggleReminder(session.id) : undefined}
      onPlay={() => onListen(session)}
    />)}
  </div>;
}

type PodcastEpisodeListProps = {
  episodes: PodcastEpisode[];
  savedIds: Set<string>;
  getUserLabel: (userId: string) => string;
  onPlay: (episode: PodcastEpisode) => void;
  onToggleSaved: (episodeId: string) => void;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function PodcastEpisodeList({ episodes, savedIds, getUserLabel, onPlay, onToggleSaved }: PodcastEpisodeListProps) {
  if (!episodes.length) return <div className="community-audio-empty">No podcast episodes have been published here yet.</div>;
  return <div className="community-audio-list">
    {episodes.map((episode) => <CommunityAudioCard
      key={episode.id}
      title={episode.title}
      subtitle={getUserLabel(episode.authorUserId)}
      description={episode.description}
      coverUrl={episode.coverUrl}
      badge="PODCAST"
      meta={`${formatDuration(episode.durationSeconds)} · ${episode.listenerCount} plays`}
      actionLabel="Play"
      isSaved={savedIds.has(episode.id)}
      onToggleSaved={() => onToggleSaved(episode.id)}
      onPlay={() => onPlay(episode)}
    />)}
  </div>;
}

export function CommunityRadioSection(props: RadioSessionListProps) {
  return <section className="community-audio-section" aria-labelledby="community-radio-title">
    <div className="community-audio-section-title"><div><span>ON AIR</span><h2 id="community-radio-title">Live Radio</h2></div><p>Join a community-hosted conversation already in progress.</p></div>
    <RadioSessionList {...props} />
  </section>;
}

export function CommunityPodcastSection(props: PodcastEpisodeListProps) {
  return <section className="community-audio-section" aria-labelledby="community-podcast-title">
    <div className="community-audio-section-title"><div><span>ON DEMAND</span><h2 id="community-podcast-title">Podcasts</h2></div><p>Listen to community-made episodes without leaving your workspace.</p></div>
    <PodcastEpisodeList {...props} />
  </section>;
}

function toRadioPlayable(session: RadioSession, contextLabel: string): AudioPlayableItem {
  return { id: session.id, type: session.status === "scheduled" ? "radio_scheduled" : "radio_live", title: session.title, contextLabel, coverUrl: session.coverUrl, durationSeconds: 3600 };
}

function toPodcastPlayable(episode: PodcastEpisode, contextLabel: string): AudioPlayableItem {
  return { id: episode.id, type: "podcast_episode", title: episode.title, contextLabel, coverUrl: episode.coverUrl, audioUrl: episode.audioUrl, durationSeconds: episode.durationSeconds };
}

export function CommunityAudioView({ community, canManageAudio, onPlaceholderAction }: CommunityAudioViewProps) {
  const [activeTab, setActiveTab] = useState<CommunityAudioTab>("live");
  const [nowPlaying, setNowPlaying] = useState<AudioPlayableItem | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const radioSessions = useMemo(() => mockRadioSessions.filter((session) => session.communityId === community.id), [community.id]);
  const podcastEpisodes = useMemo(() => mockPodcastEpisodes.filter((episode) => episode.communityId === community.id), [community.id]);
  const getUserLabel = (userId: string) => community.members.find((member) => member.userId === userId)?.displayName ?? "Picom creator";
  const toggleSaved = (id: string) => setSavedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleReminder = (id: string) => setReminderIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <main className="community-audio-view">
    <CommunityAudioHeader communityName={community.name} activeTab={activeTab} canManageAudio={canManageAudio} onSelectTab={setActiveTab} onPlaceholderAction={onPlaceholderAction} />
    <div className="community-audio-scroll">
      {activeTab === "live" ? <CommunityRadioSection sessions={radioSessions.filter((session) => session.status === "live")} reminderIds={reminderIds} getUserLabel={getUserLabel} onListen={(session) => setNowPlaying(toRadioPlayable(session, community.name))} onToggleReminder={toggleReminder} /> : null}
      {activeTab === "podcasts" ? <CommunityPodcastSection episodes={podcastEpisodes.filter((episode) => episode.status === "published")} savedIds={savedIds} getUserLabel={getUserLabel} onPlay={(episode) => setNowPlaying(toPodcastPlayable(episode, community.name))} onToggleSaved={toggleSaved} /> : null}
      {activeTab === "scheduled" ? <section className="community-audio-section" aria-labelledby="community-scheduled-title">
        <div className="community-audio-section-title"><div><span>COMING UP</span><h2 id="community-scheduled-title">Scheduled Radio</h2></div><p>Preview upcoming sessions and keep local reminders.</p></div>
        <RadioSessionList sessions={radioSessions.filter((session) => session.status === "scheduled")} scheduled reminderIds={reminderIds} getUserLabel={getUserLabel} onListen={(session) => setNowPlaying(toRadioPlayable(session, community.name))} onToggleReminder={toggleReminder} />
      </section> : null}
    </div>
    {nowPlaying ? <div className="community-audio-player-dock"><AudioMiniPlayer item={nowPlaying} onClose={() => setNowPlaying(null)} /></div> : null}
  </main>;
}
