import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { dateTimeService } from "../services/dateTimeService";
import { AttachmentGrid } from "./AttachmentGrid";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";
import { MentionFeedFooter } from "./MentionFeedFooter";
import { getUserVerificationSummary } from "../utils/verificationHelpers";

type MentionFeedCardProps = {
  item: MentionItem;
  author?: Member;
  community?: Community;
  channel?: Channel;
  mentionedMembers: Member[];
  commenters: Member[];
  commentPreviewMembers: Record<string, Member | undefined>;
  resolveMember: (userId: string) => Member | undefined;
  onOpenImage: (attachment: Attachment) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onToggleReaction: (id: string, emoji: string) => void;
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
  resolveMember,
  onOpenImage,
  onOpenInChannel,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenProfile,
  onOpenMore,
}: MentionFeedCardProps) {
  const authorLabel = author?.displayName ?? "Picom member";
  const verification = getUserVerificationSummary(author?.userId ?? item.authorId, [], author?.verification);

  return (
    <article className={`mention-card unified-feed-card unified-feed-card--text${item.isUnread ? " unread" : ""}`}>
      <header className="mention-card-header">
        <button
          className="mention-author-button"
          type="button"
          onClick={(event) => author && onOpenProfile(event, author)}
          aria-label={`Open ${authorLabel} profile preview`}
        >
          <VerifiedAvatarFrame
            user={author}
            label={authorLabel}
            size="medium"
            avatarSize={48}
            verification={verification}
          />
        </button>

        <div className="mention-header-main">
          <div className="mention-header-top">
            <div className="mention-header-identity">
              <button
                className="mention-author-name-button"
                type="button"
                onClick={(event) => author && onOpenProfile(event, author)}
                disabled={!author}
              >
                <span>{authorLabel}</span>
                <VerifiedBadge verification={verification} size="xs" />
              </button>
              <span className="mention-topic-badge">
                <AppIcon name="hash" size="xs" aria-hidden="true" />
                Mention
              </span>
            </div>

            <div className="mention-card-meta" aria-label="Mention source">
              <span className="mention-meta-chip" title={community?.name ?? "Visible community"}>
                <AppIcon name="home" size="xs" aria-hidden="true" />
                <span>{community?.name ?? "Visible community"}</span>
              </span>
              <span className="mention-meta-chip mention-meta-chip--time">
                <AppIcon name="bell" size="xs" aria-hidden="true" />
                <time dateTime={item.createdAt}>{dateTimeService.formatCompactDateTime(item.createdAt)}</time>
              </span>
            </div>
          </div>

          {item.title ? <h2 className="mention-header-title">{item.title}</h2> : null}
        </div>

        <div className="mention-card-header-actions">
          <button className="icon-button mention-more-button" type="button" aria-label="More mention actions" onClick={(event) => onOpenMore(event, item)}>
            <AppIcon name="more" size="sm" />
          </button>
        </div>
      </header>

      <div className="mention-card-body">
        <p>{renderMentionBody(item.body, mentionedMembers)}</p>
        {item.attachments?.length ? <AttachmentGrid attachments={item.attachments} onOpenImage={onOpenImage} /> : null}
      </div>

      <MentionFeedFooter
        item={item}
        commenters={commenters}
        commentPreviewMembers={commentPreviewMembers}
        resolveMember={resolveMember}
        onToggleReaction={onToggleReaction}
        onToggleSaved={onToggleSaved}
        onMarkRead={onMarkRead}
        onOpenInChannel={onOpenInChannel}
        onOpenProfile={onOpenProfile}
      />
    </article>
  );
}
