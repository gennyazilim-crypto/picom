import type { MouseEvent } from "react";
import type { AudioFeedItem } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { dateTimeService } from "../../services/dateTimeService";
import { getUserVerificationSummary } from "../../utils/verificationHelpers";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { VerifiedBadge } from "../VerifiedBadge";
import { formatAudioTime } from "./AudioProgressBar";

function findAuthor(item: AudioFeedItem, communities: Community[]): Member | undefined {
  const userId = item.mentionAuthorUserId ?? item.authorUserId ?? item.hostUserId;
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function findCommenters(item: AudioFeedItem, communities: Community[]): Member[] {
  const ids = [...new Set(item.commenterIds ?? item.commentPreview?.map((comment) => comment.authorId) ?? [])];
  const members = communities.flatMap((community) => community.members);
  return ids.map((id) => members.find((member) => member.userId === id)).filter((member): member is Member => Boolean(member));
}

type AudioFeedCardProps = {
  item: AudioFeedItem; communities: Community[]; saved: boolean; unread: boolean; reminderSet: boolean;
  onSelect: (item: AudioFeedItem) => void; onToggleSaved: (item: AudioFeedItem) => void;
  onToggleReminder: (id: string) => void; onReact: (item: AudioFeedItem) => void;
  onMarkRead: (item: AudioFeedItem) => void; onOpenCommunity: (communityId: string) => void;
  onOpenRadio: (item: AudioFeedItem) => void; onOpenProfile: (event: MouseEvent, member: Member) => void;
};

export function AudioFeedCard({ item, communities, saved, unread, reminderSet, onSelect, onToggleSaved, onToggleReminder, onReact, onMarkRead, onOpenCommunity, onOpenRadio, onOpenProfile }: AudioFeedCardProps) {
  const community = communities.find((candidate) => candidate.id === item.communityId);
  const author = findAuthor(item, communities);
  const commenters = findCommenters(item, communities);
  const live = item.type === "radio_live";
  const scheduled = item.type === "radio_scheduled";
  const ended = item.type === "radio_ended";
  const podcast = item.type === "podcast_episode";
  const reactionTotal = item.reactionSummary?.reduce((total, reaction) => total + reaction.count, 0) ?? 0;
  const visibleCommenters = commenters.slice(0, 4);
  const remainingCommenters = Math.max(0, commenters.length - visibleCommenters.length);
  const verification = author ? getUserVerificationSummary(author.userId) : undefined;
  const kindLabel = live ? "Live now" : scheduled ? "Scheduled radio" : ended ? "Radio replay" : item.isMention ? "Podcast mention" : "Podcast episode";

  return <article className={"audio-feed-card " + item.type + (unread ? " unread" : "")}>
    <div className="audio-feed-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" aria-hidden="true" /> : <AppIcon name="headphones" size="xl" />}<span className={"audio-feed-kind " + (live ? "live" : "")}>{kindLabel}</span></div>
    <div className="audio-feed-copy">
      <header>
        {author ? <button type="button" className="audio-feed-avatar-button" aria-label={"Open " + author.displayName + " profile"} onClick={(event) => onOpenProfile(event, author)}><MemberAvatar member={author} size={32} /></button> : <span className="audio-feed-author-fallback"><AppIcon name="user" size="sm" /></span>}
        <div><button type="button" className="audio-feed-author-name" onClick={(event) => author && onOpenProfile(event, author)}><strong>{author?.displayName ?? "Picom host"}</strong>{verification ? <VerifiedBadge verification={verification} size="xs" /> : null}</button><button type="button" onClick={() => onOpenCommunity(item.communityId)}>{community?.name ?? "Picom community"}</button></div>
      </header>
      <h2>{item.title}</h2><p>{item.body}</p>
      <div className="audio-feed-meta">{live ? <span><i />{item.listenerCount ?? 0} listening</span> : scheduled ? <span>{dateTimeService.formatCompactDateTime(item.startsAt ?? item.createdAt)}</span> : podcast ? <><span>{formatAudioTime(item.durationSeconds ?? 0)}</span><span>{dateTimeService.formatCompactDateTime(item.createdAt)}</span></> : <span>Ended {dateTimeService.formatCompactDateTime(item.createdAt)}</span>}</div>
      {item.mentionHighlight ? <blockquote className="audio-mention-highlight"><strong>{item.mentionSource === "episode_comment" ? "Mentioned you in a comment" : "Mentioned you in the episode notes"}</strong><span>{item.mentionHighlight}</span></blockquote> : item.commentPreview?.[0] ? <blockquote><strong>Community discussion</strong><span>{item.commentPreview[0].body}</span></blockquote> : null}
      <div className="audio-feed-social-proof" aria-label="Audio social activity">
        <span className="audio-social-pill"><AppIcon name="eye" size="xs" />{item.viewCount ?? item.listenerCount ?? 0} {live ? "listeners" : "views"}</span>
        {reactionTotal ? <span className="audio-social-pill reactions">{item.reactionSummary?.slice(0, 4).map((reaction) => <span key={reaction.emoji}>{reaction.emoji}</span>)}<strong>{reactionTotal}</strong></span> : null}
        {visibleCommenters.length ? <span className="audio-commenter-stack">{visibleCommenters.map((member) => <button type="button" key={member.userId} title={member.displayName} aria-label={"Open " + member.displayName + " profile"} onClick={(event) => onOpenProfile(event, member)}><MemberAvatar member={member} size={22} /></button>)}{remainingCommenters ? <em>+{remainingCommenters}</em> : null}</span> : null}
        <span className="audio-social-pill">{item.commentCount ?? 0} comments</span>
      </div>
      <footer>
        {scheduled ? <button type="button" className={reminderSet ? "active" : ""} onClick={() => onToggleReminder(item.id)}><AppIcon name="bell" size="sm" />{reminderSet ? "Reminder set" : "Remind me"}</button> : !ended ? <button type="button" className="primary" onClick={() => onSelect(item)}><AppIcon name="play" size="sm" />{live ? "Listen" : "Play"}</button> : null}
        <button type="button" onClick={() => onReact(item)}><AppIcon name="smile" size="sm" />React</button>
        <button type="button" className={saved ? "active" : ""} onClick={() => onToggleSaved(item)}><AppIcon name="pin" size="sm" />{saved ? "Saved" : "Save"}</button>
        {unread ? <button type="button" onClick={() => onMarkRead(item)}><AppIcon name="eye" size="sm" />Mark read</button> : null}
        {podcast ? <button type="button" onClick={() => onSelect(item)}>Open episode<AppIcon name="chevronRight" size="xs" /></button> : <button type="button" onClick={() => onOpenRadio(item)}>Open in Radio<AppIcon name="chevronRight" size="xs" /></button>}
        {podcast ? <button type="button" onClick={() => onOpenCommunity(item.communityId)}>Open community<AppIcon name="hash" size="xs" /></button> : null}
      </footer>
    </div>
  </article>;
}
