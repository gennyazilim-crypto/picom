import type { MouseEvent } from "react";
import type { Member, Reaction } from "../types/community";
import type { MentionCommentPreview, MentionItem } from "../types/mentions";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type MentionFeedFooterProps = {
  item: MentionItem;
  commenters: Member[];
  commentPreviewMembers: Record<string, Member | undefined>;
  onToggleReaction: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

type EmojiReactionSummaryProps = {
  reactions?: Reaction[];
};

type CommentAvatarStackProps = {
  commenters: Member[];
  totalCount: number;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

type MentionCommentPreviewProps = {
  previews?: MentionCommentPreview[];
  membersByUserId: Record<string, Member | undefined>;
  totalCount: number;
};

function getReactionTotal(reactions?: Reaction[]): number {
  return reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0;
}

export function EmojiReactionSummary({ reactions }: EmojiReactionSummaryProps) {
  const visibleReactions = (reactions ?? []).filter((reaction) => reaction.count > 0).slice(0, 4);
  const total = getReactionTotal(reactions);
  const active = visibleReactions.some((reaction) => reaction.reactedByCurrentUser);

  if (!visibleReactions.length || total <= 0) return null;

  return (
    <span className={`mention-footer-pill emoji-summary${active ? " active" : ""}`} title={`${total} reactions`}>
      <span className="emoji-summary-icons" aria-hidden="true">
        {visibleReactions.map((reaction) => (
          <span key={reaction.emoji}>{reaction.emoji}</span>
        ))}
      </span>
      <strong>{total}</strong>
    </span>
  );
}

export function CommentAvatarStack({ commenters, totalCount, onOpenProfile }: CommentAvatarStackProps) {
  const visibleCommenters = commenters.slice(0, 4);
  const overflow = Math.max(0, totalCount - visibleCommenters.length);

  if (!visibleCommenters.length) return null;

  return (
    <span className="mention-comment-stack" aria-label={`${totalCount} commenters`}>
      {visibleCommenters.map((member) => (
        <button
          key={member.userId}
          type="button"
          title={member.displayName}
          aria-label={`Open ${member.displayName} profile`}
          onClick={(event) => onOpenProfile(event, member)}
        >
          <MemberAvatar member={member} size={24} />
        </button>
      ))}
      {overflow > 0 ? <span className="mention-comment-overflow">+{overflow}</span> : null}
    </span>
  );
}

export function MentionCommentPreview({ previews, membersByUserId, totalCount }: MentionCommentPreviewProps) {
  const visiblePreviews = (previews ?? []).slice(0, 2);
  const remaining = Math.max(0, totalCount - visiblePreviews.length);

  if (!visiblePreviews.length) return null;

  return (
    <div className="mention-comment-preview" aria-label="Comment preview">
      {visiblePreviews.map((preview) => {
        const member = membersByUserId[preview.authorId];

        return (
          <p key={preview.id}>
            <strong>{member?.displayName ?? "Picom member"}</strong>
            <span>{preview.body}</span>
          </p>
        );
      })}
      {remaining > 0 ? <button type="button">View {remaining} more comments</button> : null}
    </div>
  );
}

export function MentionFeedFooter({
  item,
  commenters,
  commentPreviewMembers,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenInChannel,
  onOpenProfile,
}: MentionFeedFooterProps) {
  const commentCount = item.commentCount ?? 0;
  const reacted = item.reactions?.some((reaction) => reaction.reactedByCurrentUser) ?? false;

  return (
    <>
      <footer className="mention-card-footer">
        <div className="mention-footer-stats" aria-label="Mention engagement summary">
          <span className="mention-footer-pill">
            <AppIcon name="eye" size="xs" />
            <strong>{item.viewCount ?? 0}</strong>
            <span>views</span>
          </span>
          <EmojiReactionSummary reactions={item.reactions} />
          <CommentAvatarStack commenters={commenters} totalCount={commentCount} onOpenProfile={onOpenProfile} />
          <span className="mention-footer-pill">
            <AppIcon name="reply" size="xs" />
            <strong>{commentCount}</strong>
            <span>comments</span>
          </span>
        </div>
        <div className="mention-card-actions">
          <button type="button" className={reacted ? "active" : ""} onClick={() => onToggleReaction(item.id)}>
            React
          </button>
          <button type="button" className={item.isSaved ? "active" : ""} onClick={() => onToggleSaved(item.id)}>
            {item.isSaved ? "Saved" : "Save"}
          </button>
          {item.isUnread ? (
            <button type="button" onClick={() => onMarkRead(item.id)}>
              Mark read
            </button>
          ) : null}
          <button type="button" onClick={() => onOpenInChannel(item)}>
            Open in channel
          </button>
        </div>
      </footer>
      <MentionCommentPreview previews={item.commentPreview} membersByUserId={commentPreviewMembers} totalCount={commentCount} />
    </>
  );
}
