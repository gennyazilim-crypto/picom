import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { AudioPlayableItem, PodcastEpisode } from "../../types/audio";
import type { Member } from "../../types/community";
import { dateTimeService } from "../../services/dateTimeService";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { AudioMiniPlayer } from "./AudioMiniPlayer";
import { formatAudioTime } from "./AudioProgressBar";

type PodcastEpisodeDetailProps = {
  episode: PodcastEpisode;
  communityName: string;
  author?: Member;
  relatedEpisodes: PodcastEpisode[];
  getCommentAuthorLabel: (authorId: string) => string;
  onClose: () => void;
  onOpenCommunity: () => void;
  onOpenAuthor?: (event: MouseEvent<HTMLButtonElement>, author: Member) => void;
  onSelectEpisode: (episode: PodcastEpisode) => void;
};

function playableEpisode(episode: PodcastEpisode, communityName: string): AudioPlayableItem {
  return { id: episode.id, type: "podcast_episode", title: episode.title, contextLabel: `${communityName} / Podcast`, coverUrl: episode.coverUrl, audioUrl: episode.audioUrl, durationSeconds: episode.durationSeconds, communityId: episode.communityId };
}

export function PodcastEpisodeHeader({ episode, communityName, author, saved, onToggleSaved, onOpenCommunity, onOpenAuthor, onClose, onNotice }: Omit<PodcastEpisodeDetailProps, "relatedEpisodes" | "getCommentAuthorLabel" | "onSelectEpisode"> & { saved: boolean; onToggleSaved: () => void; onNotice: (message: string) => void }) {
  return <header className="podcast-episode-header">
    <div className="podcast-episode-cover" aria-hidden="true">{episode.coverUrl ? <img src={episode.coverUrl} alt="" /> : <AppIcon name="headphones" size="xl" />}</div>
    <div className="podcast-episode-title">
      <span className="podcast-episode-kind">PODCAST EPISODE</span>
      <h1>{episode.title}</h1>
      <button type="button" className="podcast-author-link" disabled={!author || !onOpenAuthor} onClick={(event) => author && onOpenAuthor?.(event, author)}>{author ? <MemberAvatar member={author} size={30} /> : null}<span><strong>{author?.displayName ?? "Picom creator"}</strong><small>{communityName}</small></span></button>
      <div className="podcast-episode-meta"><span>{formatAudioTime(episode.durationSeconds)}</span><span>{dateTimeService.formatCompactDateTime(episode.publishedAt)}</span><span>{episode.listenerCount} listeners</span></div>
      <div className="podcast-episode-header-actions">
        <button type="button" className={`secondary-button compact ${saved ? "active" : ""}`} onClick={onToggleSaved}><AppIcon name="pin" size="sm" />{saved ? "Saved" : "Save"}</button>
        <button type="button" className="secondary-button compact" onClick={() => onNotice("A safe share action is prepared; no private episode link was copied.")}><AppIcon name="more" size="sm" />Share</button>
        <button type="button" className="secondary-button compact" onClick={onOpenCommunity}><AppIcon name="hash" size="sm" />Open community</button>
        <button type="button" className="icon-button" aria-label="More podcast options" onClick={() => onNotice("More episode actions are prepared for the future audio service.")}><AppIcon name="more" size="sm" /></button>
      </div>
    </div>
    <button type="button" className="icon-button podcast-detail-close" aria-label="Close podcast detail" onClick={onClose}><AppIcon name="close" size="md" /></button>
  </header>;
}

export function PodcastEpisodePlayer({ episode, communityName }: { episode: PodcastEpisode; communityName: string }) {
  const [playerVisible, setPlayerVisible] = useState(true);
  const item = useMemo(() => playableEpisode(episode, communityName), [communityName, episode]);
  return <section className="podcast-episode-player" aria-label="Podcast episode player">{playerVisible ? <AudioMiniPlayer item={item} onClose={() => setPlayerVisible(false)} /> : <button type="button" className="primary-button" onClick={() => setPlayerVisible(true)}><AppIcon name="play" size="sm" />Open player</button>}<small>Playback starts only after you press Play.</small></section>;
}

export function PodcastEpisodeDescription({ episode }: { episode: PodcastEpisode }) {
  return <section className="podcast-detail-section podcast-episode-description"><header><span>ABOUT THIS EPISODE</span><h2>Episode notes</h2></header><p>{episode.description}</p><div>{episode.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><footer>{episode.reactionSummary.length ? episode.reactionSummary.map((reaction) => <span className={reaction.reactedByCurrentUser ? "active" : ""} key={reaction.emoji}>{reaction.emoji} {reaction.count}</span>) : <small>No reactions yet</small>}</footer></section>;
}

export function PodcastEpisodeCommentsPreview({ episode, getAuthorLabel }: { episode: PodcastEpisode; getAuthorLabel: (authorId: string) => string }) {
  return <section className="podcast-detail-section podcast-comments-preview"><header><span>COMMUNITY REPLIES</span><h2>{episode.commentCount} comments</h2></header>{episode.commentPreview.length ? <div>{episode.commentPreview.slice(0, 3).map((comment) => <blockquote key={comment.id}><strong>{getAuthorLabel(comment.authorId)}</strong><p>{comment.body}</p><small>{dateTimeService.formatCompactDateTime(comment.createdAt)}</small></blockquote>)}</div> : <div className="podcast-detail-empty">No comments are visible yet.</div>}<small>Comments are preview-only in this MVP.</small></section>;
}

export function PodcastRelatedEpisodes({ episodes, onSelectEpisode }: { episodes: PodcastEpisode[]; onSelectEpisode: (episode: PodcastEpisode) => void }) {
  return <section className="podcast-detail-section podcast-related-episodes"><header><span>KEEP LISTENING</span><h2>Related episodes</h2></header>{episodes.length ? <div>{episodes.slice(0, 4).map((episode) => <button type="button" key={episode.id} onClick={() => onSelectEpisode(episode)}><span className="podcast-related-cover">{episode.coverUrl ? <img src={episode.coverUrl} alt="" /> : <AppIcon name="headphones" size="sm" />}</span><span><strong>{episode.title}</strong><small>{formatAudioTime(episode.durationSeconds)} · {episode.listenerCount} listeners</small></span><AppIcon name="chevronRight" size="sm" /></button>)}</div> : <div className="podcast-detail-empty">No related episodes are available.</div>}</section>;
}

export function PodcastEpisodeDetail({ episode, communityName, author, relatedEpisodes, getCommentAuthorLabel, onClose, onOpenCommunity, onOpenAuthor, onSelectEpisode }: PodcastEpisodeDetailProps) {
  const [saved, setSaved] = useState(episode.isSavedByCurrentUser);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [onClose]);
  useEffect(() => { setSaved(episode.isSavedByCurrentUser); setNotice(null); }, [episode.id, episode.isSavedByCurrentUser]);
  return <main className="podcast-episode-detail">
    <PodcastEpisodeHeader episode={episode} communityName={communityName} author={author} saved={saved} onToggleSaved={() => setSaved((current) => !current)} onOpenCommunity={onOpenCommunity} onOpenAuthor={onOpenAuthor} onClose={onClose} onNotice={setNotice} />
    <div className="podcast-detail-scroll">{notice ? <div className="podcast-detail-notice" role="status">{notice}</div> : null}<PodcastEpisodePlayer episode={episode} communityName={communityName} /><div className="podcast-detail-grid"><div className="podcast-detail-primary"><PodcastEpisodeDescription episode={episode} /><PodcastEpisodeCommentsPreview episode={episode} getAuthorLabel={getCommentAuthorLabel} /></div><PodcastRelatedEpisodes episodes={relatedEpisodes.filter((candidate) => candidate.id !== episode.id)} onSelectEpisode={onSelectEpisode} /></div></div>
  </main>;
}
