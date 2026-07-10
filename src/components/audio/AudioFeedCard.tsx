import type { AudioFeedItem } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { dateTimeService } from "../../services/dateTimeService";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { formatAudioTime } from "./AudioProgressBar";

function findAuthor(item: AudioFeedItem, communities: Community[]): Member | undefined {
  const userId = item.authorUserId ?? item.hostUserId;
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

export function AudioFeedCard({ item, communities, saved, reminderSet, onSelect, onToggleSaved, onToggleReminder, onOpenCommunity }: { item: AudioFeedItem; communities: Community[]; saved: boolean; reminderSet: boolean; onSelect: (item: AudioFeedItem) => void; onToggleSaved: (id: string) => void; onToggleReminder: (id: string) => void; onOpenCommunity: (communityId: string) => void }) {
  const community = communities.find((candidate) => candidate.id === item.communityId);
  const author = findAuthor(item, communities);
  const live = item.type === "radio_live";
  const scheduled = item.type === "radio_scheduled";
  const podcast = item.type === "podcast_episode";
  return <article className={`audio-feed-card ${item.type}`}><div className="audio-feed-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" aria-hidden="true" /> : <AppIcon name="headphones" size="xl" />}<span className={`audio-feed-kind ${live ? "live" : ""}`}>{live ? "Live now" : scheduled ? "Scheduled radio" : "Podcast episode"}</span></div><div className="audio-feed-copy"><header>{author ? <MemberAvatar member={author} size={32} /> : <span className="audio-feed-author-fallback"><AppIcon name="user" size="sm" /></span>}<div><strong>{author?.displayName ?? "Picom host"}</strong><button type="button" onClick={() => onOpenCommunity(item.communityId)}>{community?.name ?? "Picom community"}</button></div></header><h2>{item.title}</h2><p>{item.body}</p><div className="audio-feed-meta">{live ? <span><i />{item.listenerCount ?? 0} listening</span> : scheduled ? <span>{dateTimeService.formatCompactDateTime(item.startsAt ?? item.createdAt)}</span> : <><span>{formatAudioTime(item.durationSeconds ?? 0)}</span><span>{dateTimeService.formatCompactDateTime(item.createdAt)}</span><span>{item.listenerCount ?? 0} plays</span></>}</div>{item.reactionSummary?.length ? <div className="audio-feed-reactions">{item.reactionSummary.slice(0, 4).map((reaction) => <span className={reaction.reactedByCurrentUser ? "active" : ""} key={reaction.emoji}>{reaction.emoji} {reaction.count}</span>)}</div> : null}{item.commentPreview?.[0] ? <blockquote><strong>Community reply</strong><span>{item.commentPreview[0].body}</span></blockquote> : null}<footer>{scheduled ? <button type="button" className={reminderSet ? "active" : ""} onClick={() => onToggleReminder(item.id)}><AppIcon name="bell" size="sm" />{reminderSet ? "Reminder set" : "Remind me"}</button> : <button type="button" className="primary" onClick={() => onSelect(item)}><AppIcon name="play" size="sm" />{live ? "Listen" : "Play"}</button>}<button type="button" className={saved ? "active" : ""} onClick={() => onToggleSaved(item.id)}><AppIcon name="pin" size="sm" />{saved ? "Saved" : "Save"}</button><button type="button" onClick={() => onOpenCommunity(item.communityId)}>Open community<AppIcon name="chevronRight" size="xs" /></button></footer></div></article>;
}
