import { useState } from "react";
import type { MouseEvent } from "react";
import type { Member, Reaction } from "../types/community";
import type { MentionCommentPreview as MentionCommentPreviewItem, MentionItem } from "../types/mentions";
import { listMentionComments } from "../services/mentionCommentService";
import { AppIcon } from "./AppIcon";
import { EmojiPicker } from "./EmojiPicker";
import { MemberAvatar } from "./MemberAvatar";

type MentionFeedFooterProps = {
  item: MentionItem;
  commenters: Member[];
  commentPreviewMembers: Record<string, Member | undefined>;
  resolveMember: (userId: string) => Member | undefined;
  onToggleReaction: (id: string, emoji: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

type EmojiReactionSummaryProps = {
  reactions?: Reaction[];
};

type CommentEngagementProps = {
  commenters: Member[];
  totalCount: number;
  onOpenComments: () => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

type MentionCommentPreviewProps = {
  item: MentionItem;
  membersByUserId: Record<string, Member | undefined>;
  resolveMember: (userId: string) => Member | undefined;
  totalCount: number;
  onOpenInChannel: () => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

const COLLAPSED_COMMENT_LIMIT = 2;

function renderCommentPreviewItem(
  preview: MentionCommentPreviewItem,
  member: Member | undefined,
  expanded: boolean,
  onOpenProfile: (event: MouseEvent, member: Member) => void,
) {
  return (
    <article key={preview.id} className="mention-comment-preview-item">
      <button
        type="button"
        className="mention-comment-preview-avatar"
        aria-label={member ? `Open ${member.displayName} profile` : "Open commenter profile"}
        onClick={(event) => member && onOpenProfile(event, member)}
        disabled={!member}
      >
        {member ? <MemberAvatar member={member} size={24} /> : <AppIcon name="user" size="xs" />}
      </button>
      <p>
        <strong>{member?.displayName ?? "Picom member"}</strong>
        <span className={expanded ? "is-expanded" : undefined}>{preview.body}</span>
      </p>
    </article>
  );
}

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

export function CommentEngagementSummary({ commenters, totalCount, onOpenComments, onOpenProfile }: CommentEngagementProps) {
  if (totalCount <= 0) return null;

  const visibleCommenters = commenters.slice(0, 4);
  const overflow = Math.max(0, commenters.length - visibleCommenters.length);

  return (
    <div className="mention-footer-pill mention-comment-engagement" aria-label={`${totalCount} comments`}>
      <button
        type="button"
        className="mention-comment-engagement-open mention-footer-button"
        onClick={onOpenComments}
        aria-label={`Open ${totalCount} comments`}
        title={`${totalCount} comments`}
      >
        <AppIcon name="reply" size="xs" aria-hidden="true" />
      </button>
      {visibleCommenters.map((member) => (
        <button
          key={member.userId}
          type="button"
          className="mention-comment-engagement-avatar"
          title={member.displayName}
          aria-label={`Open ${member.displayName} profile`}
          onClick={(event) => onOpenProfile(event, member)}
        >
          <MemberAvatar member={member} size={22} />
        </button>
      ))}
      {overflow > 0 ? <span className="mention-comment-overflow">+{overflow}</span> : null}
    </div>
  );
}

export function MentionCommentPreview({ item, membersByUserId, resolveMember, totalCount, onOpenInChannel, onOpenProfile }: MentionCommentPreviewProps) {
  const previewSeed = item.commentPreview ?? [];
  const [expanded, setExpanded] = useState(false);
  const [expandedComments, setExpandedComments] = useState<MentionCommentPreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!previewSeed.length) return null;

  const visibleComments = expanded
    ? expandedComments ?? previewSeed
    : previewSeed.slice(0, COLLAPSED_COMMENT_LIMIT);
  const hiddenCount = Math.max(0, totalCount - visibleComments.length);
  const canExpandInline = !expanded && hiddenCount > 0;

  async function handleExpandComments() {
    if (loading) return;
    setLoading(true);

    try {
      const comments = await listMentionComments(item);
      setExpandedComments(comments);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`mention-comment-preview${expanded ? " is-expanded" : ""}`} aria-label="Comment preview">
      <div className="mention-comment-preview-head">
        <AppIcon name="reply" size="sm" aria-hidden="true" />
        <span>{expanded ? "Comments" : "Recent comments"}</span>
        <strong>{totalCount}</strong>
      </div>
      <div className="mention-comment-preview-list">
        {visibleComments.map((preview) =>
          renderCommentPreviewItem(
            preview,
            membersByUserId[preview.authorId] ?? resolveMember(preview.authorId),
            expanded,
            onOpenProfile,
          ),
        )}
      </div>
      {canExpandInline ? (
        <button type="button" className="mention-comment-preview-more" onClick={() => void handleExpandComments()} disabled={loading}>
          <AppIcon name="reply" size="xs" aria-hidden="true" />
          {loading ? "Loading comments..." : `View ${hiddenCount} more comments`}
          <AppIcon name="chevronRight" size="xs" aria-hidden="true" />
        </button>
      ) : null}
      {expanded && hiddenCount > 0 ? (
        <button type="button" className="mention-comment-preview-more" onClick={onOpenInChannel}>
          <AppIcon name="hash" size="xs" aria-hidden="true" />
          Open {hiddenCount} more in channel
          <AppIcon name="chevronRight" size="xs" aria-hidden="true" />
        </button>
      ) : null}
      {expanded && hiddenCount <= 0 ? (
        <button type="button" className="mention-comment-preview-more" onClick={() => setExpanded(false)}>
          <AppIcon name="chevronDown" size="xs" aria-hidden="true" />
          Show less
        </button>
      ) : null}
    </div>
  );
}

export function MentionFeedFooter({
  item,
  commenters,
  commentPreviewMembers,
  resolveMember,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenInChannel,
  onOpenProfile,
}: MentionFeedFooterProps) {
  const commentCount = item.commentCount ?? 0;
  const reacted = item.reactions?.some((reaction) => reaction.reactedByCurrentUser) ?? false;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  return (
    <div className="mention-card-engagement">
      <footer className="mention-card-footer">
        <div className="mention-footer-stats" aria-label="Mention engagement summary">
          <span className="mention-footer-pill" title={`${item.viewCount ?? 0} views`} aria-label={`${item.viewCount ?? 0} views`}>
            <AppIcon name="eye" size="xs" aria-hidden="true" />
            <strong>{item.viewCount ?? 0}</strong>
          </span>
          <EmojiReactionSummary reactions={item.reactions} />
          <CommentEngagementSummary
            commenters={commenters}
            totalCount={commentCount}
            onOpenComments={() => onOpenInChannel(item)}
            onOpenProfile={onOpenProfile}
          />
          <div className="mention-footer-actions" aria-label="Mention actions">
            <div className="mention-footer-action-wrap">
              <button
                type="button"
                className={`mention-footer-pill mention-footer-action mention-footer-button${reacted || reactionPickerOpen ? " active" : ""}`}
                onClick={() => setReactionPickerOpen((open) => !open)}
                aria-label="React to mention"
                aria-expanded={reactionPickerOpen}
                title="React"
              >
                <AppIcon name="smile" size="md" aria-hidden="true" />
              </button>
              {reactionPickerOpen ? (
                <EmojiPicker
                  className="mention-reaction-picker"
                  label="Choose mention reaction"
                  mode="reaction"
                  communityId={item.communityId}
                  onClose={() => setReactionPickerOpen(false)}
                  onSelect={(emoji) => {
                    onToggleReaction(item.id, emoji);
                    setReactionPickerOpen(false);
                  }}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={`mention-footer-pill mention-footer-action mention-footer-button${item.isSaved ? " active" : ""}`}
              onClick={() => onToggleSaved(item.id)}
              aria-label={item.isSaved ? "Remove saved mention" : "Save mention"}
              title={item.isSaved ? "Saved" : "Save"}
            >
              <AppIcon name="pin" size="md" aria-hidden="true" />
            </button>
            {item.isUnread ? (
              <button
                type="button"
                className="mention-footer-pill mention-footer-action mention-footer-button"
                onClick={() => onMarkRead(item.id)}
                aria-label="Mark mention as read"
                title="Mark read"
              >
                <AppIcon name="eye" size="md" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="mention-footer-pill mention-footer-action mention-footer-action--primary mention-footer-button"
              onClick={() => onOpenInChannel(item)}
              aria-label="Open mention in channel"
              title="Open in channel"
            >
              <AppIcon name="hash" size="md" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>

      <MentionCommentPreview
        item={item}
        membersByUserId={commentPreviewMembers}
        resolveMember={resolveMember}
        totalCount={commentCount}
        onOpenInChannel={() => onOpenInChannel(item)}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}
