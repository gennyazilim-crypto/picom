import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { dateTimeService } from "../services/dateTimeService";
import { AttachmentGrid } from "./AttachmentGrid";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";
import { MentionFeedFooter } from "./MentionFeedFooter";

type MentionFeedCardProps = {
  item: MentionItem;
  author?: Member;
  community?: Community;
  channel?: Channel;
  mentionedMembers: Member[];
  commenters: Member[];
  commentPreviewMembers: Record<string, Member | undefined>;
  onOpenImage: (attachment: Attachment) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onToggleReaction: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenMore: (event: MouseEvent, item: MentionItem) => void;
};

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
  commenters,
  commentPreviewMembers,
  onOpenImage,
  onOpenInChannel,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenProfile,
  onOpenMore,
}: MentionFeedCardProps) {
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
          <button
            className="mention-author-name-button"
            type="button"
            onClick={(event) => author && onOpenProfile(event, author)}
            disabled={!author}
          >
            {authorLabel}
          </button>
          <span>
            {community?.name ?? "Visible community"} / #{channel?.name ?? "channel"} / {dateTimeService.formatCompactDateTime(item.createdAt)}
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

      <MentionFeedFooter
        item={item}
        commenters={commenters}
        commentPreviewMembers={commentPreviewMembers}
        onToggleReaction={onToggleReaction}
        onToggleSaved={onToggleSaved}
        onMarkRead={onMarkRead}
        onOpenInChannel={onOpenInChannel}
        onOpenProfile={onOpenProfile}
      />
    </article>
  );
}
