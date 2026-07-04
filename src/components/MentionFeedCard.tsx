import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { AttachmentGrid } from "./AttachmentGrid";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";
import { MentionReactionPill } from "./MentionReactionPill";

type MentionFeedCardProps = {
  item: MentionItem;
  author?: Member;
  community?: Community;
  channel?: Channel;
  mentionedMembers: Member[];
  onOpenImage: (attachment: Attachment) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onToggleReaction: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenMore: (event: MouseEvent, item: MentionItem) => void;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function renderMentionBody(body: string, mentionedMembers: Member[]) {
  const mentionNames = new Set(mentionedMembers.map((member) => `@${member.displayName}`));

  return body.split(/(\s+)/).map((token, index) => {
    const cleanToken = token.replace(/[.,!?;:)]$/u, "");

    if (mentionNames.has(cleanToken)) {
      const suffix = token.slice(cleanToken.length);

      return (
        <span key={`${token}-${index}`}>
          <mark>{cleanToken}</mark>
          {suffix}
        </span>
      );
    }

    return token;
  });
}

export function MentionFeedCard({
  item,
  author,
  community,
  channel,
  mentionedMembers,
  onOpenImage,
  onOpenInChannel,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenProfile,
  onOpenMore,
}: MentionFeedCardProps) {
  const reactionTotal = item.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0;
  const authorLabel = author?.displayName ?? "Picom member";

  return (
    <article className={`mention-card${item.isUnread ? " unread" : ""}`}>
      <header className="mention-card-header">
        <button
          className="mention-author-button"
          type="button"
          onClick={(event) => author && onOpenProfile(event, author)}
          aria-label={`Open ${authorLabel} profile preview`}
        >
          <MemberAvatar member={author} label={authorLabel} size={42} />
        </button>
        <div className="mention-author-copy">
          <strong>{authorLabel}</strong>
          <span>
            {community?.name ?? "Visible community"} / #{channel?.name ?? "channel"} / {formatTime(item.createdAt)}
          </span>
        </div>
        {item.isUnread ? <span className="mention-unread-badge">Unread</span> : null}
        <button className="icon-button mention-more-button" type="button" aria-label="More mention actions" onClick={(event) => onOpenMore(event, item)}>
          <AppIcon name="more" size="sm" />
        </button>
      </header>

      <div className="mention-card-body">
        {item.title ? <h2>{item.title}</h2> : null}
        <p>{renderMentionBody(item.body, mentionedMembers)}</p>
        {item.attachments?.length ? <AttachmentGrid attachments={item.attachments} onOpenImage={onOpenImage} /> : null}
      </div>

      <footer className="mention-card-footer">
        <MentionReactionPill reactions={item.reactions} />
        <span>
          <AppIcon name="users" size="xs" />
          {item.viewCount ?? 0} views
        </span>
        <span>
          <AppIcon name="reply" size="xs" />
          {item.commentCount ?? 0} replies
        </span>
        <span>
          <AppIcon name="smile" size="xs" />
          {reactionTotal}
        </span>
        <div className="mention-card-actions">
          <button type="button" onClick={() => onToggleReaction(item.id)}>
            {item.reactions?.some((reaction) => reaction.reactedByCurrentUser) ? "Reacted" : "Like"}
          </button>
          <button type="button" onClick={() => onToggleSaved(item.id)}>
            {item.isSaved ? "Saved" : "Save"}
          </button>
          <button type="button" disabled={!item.isUnread} onClick={() => onMarkRead(item.id)}>
            {item.isUnread ? "Mark read" : "Read"}
          </button>
          <button type="button" onClick={() => onOpenInChannel(item)}>
            Open in channel
          </button>
        </div>
      </footer>
    </article>
  );
}
