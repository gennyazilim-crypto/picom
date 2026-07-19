import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { AudioFeedItem } from "../../types/audio";
import type { Community, Member, Reaction } from "../../types/community";
import { dateTimeService } from "../../services/dateTimeService";
import { getUserVerificationSummary } from "../../utils/verificationHelpers";
import { AppIcon, type IconName } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import { CommentEngagementSummary, EmojiReactionSummary } from "../MentionFeedFooter";
import { formatAudioTime } from "./AudioProgressBar";

const MENU_WIDTH = 176;

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
  item: AudioFeedItem;
  communities: Community[];
  saved: boolean;
  unread: boolean;
  reminderSet: boolean;
  onSelect: (item: AudioFeedItem) => void;
  onToggleSaved: (item: AudioFeedItem) => void;
  onToggleReminder: (id: string) => void;
  onReact: (item: AudioFeedItem) => void;
  onMarkRead: (item: AudioFeedItem) => void;
  onOpenCommunity: (communityId: string) => void;
  onOpenRadio: (item: AudioFeedItem) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onCopyReference?: (item: AudioFeedItem) => void;
  onReport?: (item: AudioFeedItem) => void;
};

type MenuPosition = { top: number; left: number };

function clampMenuLeft(triggerRight: number) {
  const left = triggerRight - MENU_WIDTH;
  const maxLeft = window.innerWidth - MENU_WIDTH - 8;
  return Math.min(Math.max(8, left), maxLeft);
}

function metaDetail(item: AudioFeedItem): string {
  const when = dateTimeService.formatCompactDateTime(item.createdAt);
  if (item.type === "podcast_episode") return `${formatAudioTime(item.durationSeconds ?? 0)} · ${when}`;
  if (item.type === "radio_live") return `${item.listenerCount ?? 0} listening · ${when}`;
  if (item.type === "radio_scheduled") {
    return dateTimeService.formatCompactDateTime(item.startsAt ?? item.createdAt);
  }
  return `Ended · ${when}`;
}

function metaDetailIcon(item: AudioFeedItem): IconName {
  if (item.type === "podcast_episode") return "play";
  if (item.type === "radio_live") return "headphones";
  if (item.type === "radio_scheduled") return "bell";
  return "headphones";
}

function kindLabel(item: AudioFeedItem): string {
  if (item.type === "radio_live") return "Live now";
  if (item.type === "radio_scheduled") return "Scheduled radio";
  if (item.type === "radio_ended") return "Radio replay";
  if (item.isMention) return "Podcast mention";
  return "Podcast episode";
}

function openComments(item: AudioFeedItem, onSelect: (item: AudioFeedItem) => void, onOpenRadio: (item: AudioFeedItem) => void) {
  if (item.type === "podcast_episode") onSelect(item);
  else onOpenRadio(item);
}

function primaryAction(
  item: AudioFeedItem,
  onSelect: (item: AudioFeedItem) => void,
  onOpenRadio: (item: AudioFeedItem) => void,
) {
  if (item.type === "podcast_episode" || item.type === "radio_live") onSelect(item);
  else onOpenRadio(item);
}

export function AudioFeedCard({
  item,
  communities,
  saved,
  unread,
  reminderSet,
  onSelect,
  onToggleSaved,
  onToggleReminder,
  onReact,
  onMarkRead,
  onOpenCommunity,
  onOpenRadio,
  onOpenProfile,
  onCopyReference,
  onReport,
}: AudioFeedCardProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const community = communities.find((candidate) => candidate.id === item.communityId);
  const author = findAuthor(item, communities);
  const commenters = findCommenters(item, communities);
  const live = item.type === "radio_live";
  const scheduled = item.type === "radio_scheduled";
  const podcast = item.type === "podcast_episode";
  const commentCount = item.commentCount ?? 0;
  const viewCount = item.viewCount ?? item.listenerCount ?? 0;
  const reacted = item.reactionSummary?.some((reaction) => reaction.reactedByCurrentUser) ?? false;
  const authorLabel = author?.displayName ?? "Picom host";
  const verification = author ? getUserVerificationSummary(author.userId, [], author.verification) : undefined;
  const previewComment = item.commentPreview?.[0];
  const previewAuthor = previewComment
    ? communities.flatMap((entry) => entry.members).find((member) => member.userId === previewComment.authorId)
    : undefined;

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 6, left: clampMenuLeft(rect.right) });
  };

  useLayoutEffect(() => {
    if (!moreOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (moreRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [moreOpen]);

  const menu =
    moreOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="audio-feed-more-menu"
            role="menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                if (podcast) onSelect(item);
                else onOpenRadio(item);
              }}
            >
              <AppIcon name={podcast ? "play" : "headphones"} size="sm" />
              {podcast ? "Open episode" : "Open Radio"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                onToggleSaved(item);
              }}
            >
              <AppIcon name="pin" size="sm" />
              {saved ? "Remove saved" : "Save"}
            </button>
            {unread ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  onMarkRead(item);
                }}
              >
                <AppIcon name="eye" size="sm" />
                Mark read
              </button>
            ) : null}
            {onCopyReference ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  onCopyReference(item);
                }}
              >
                <AppIcon name="hash" size="sm" />
                Copy reference
              </button>
            ) : null}
            {onReport ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  onReport(item);
                }}
              >
                <AppIcon name="bell" size="sm" />
                Report
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <article
        className={
          "audio-feed-card unified-feed-card unified-feed-card--audio " +
          item.type +
          (unread ? " unread" : "") +
          (moreOpen ? " has-open-menu" : "")
        }
      >
        <aside className="audio-feed-aside">
          <div className="audio-feed-cover">
            {item.coverUrl ? <img src={item.coverUrl} alt="" aria-hidden="true" /> : <AppIcon name="headphones" size="xl" />}
            <span className={"audio-feed-kind " + (live ? "live" : "")}>{kindLabel(item)}</span>
          </div>
        </aside>

        <div className="audio-feed-copy">
          <header className="mention-card-header audio-feed-header">
            <button
              className="mention-author-button"
              type="button"
              onClick={(event) => author && onOpenProfile(event, author)}
              aria-label={`Open ${authorLabel} profile preview`}
              disabled={!author}
            >
              {author ? (
                <VerifiedAvatarFrame
                  user={author}
                  label={authorLabel}
                  size="medium"
                  avatarSize={48}
                  verification={verification}
                />
              ) : (
                <span className="audio-feed-author-fallback">
                  <AppIcon name="user" size="sm" />
                </span>
              )}
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
                    {verification ? <VerifiedBadge verification={verification} size="xs" /> : null}
                  </button>
                </div>

                <div className="mention-card-meta" aria-label="Audio source">
                  <button
                    type="button"
                    className="mention-meta-chip mention-meta-chip--button"
                    title={community?.name ?? "Picom community"}
                    onClick={() => onOpenCommunity(item.communityId)}
                  >
                    <AppIcon name="home" size="xs" aria-hidden="true" />
                    <span>{community?.name ?? "Picom community"}</span>
                  </button>
                  <span className="mention-meta-chip mention-meta-chip--time">
                    <AppIcon name={metaDetailIcon(item)} size="xs" aria-hidden="true" />
                    <span>{metaDetail(item)}</span>
                  </span>
                </div>
              </div>

              <h2 className="mention-header-title">{item.title}</h2>
            </div>

            <div className="mention-card-header-actions">
              <div className={"audio-feed-more" + (moreOpen ? " is-open" : "")} ref={moreRef}>
                <button
                  ref={triggerRef}
                  className="icon-button mention-more-button"
                  type="button"
                  aria-label={`More actions for ${item.title}`}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  <AppIcon name="more" size="sm" />
                </button>
              </div>
            </div>
          </header>

          <div className="mention-card-body audio-feed-body">
            <p>{item.body}</p>
          </div>

          <div className="mention-card-engagement audio-feed-engagement">
            <footer className="mention-card-footer">
              <div className="mention-footer-stats" aria-label="Audio engagement summary">
                <span className="mention-footer-pill" title={`${viewCount} ${live ? "listeners" : "views"}`} aria-label={`${viewCount} ${live ? "listeners" : "views"}`}>
                  <AppIcon name="eye" size="xs" aria-hidden="true" />
                  <strong>{viewCount}</strong>
                </span>
                <EmojiReactionSummary reactions={item.reactionSummary as Reaction[] | undefined} />
                <CommentEngagementSummary
                  commenters={commenters}
                  totalCount={commentCount}
                  onOpenComments={() => openComments(item, onSelect, onOpenRadio)}
                  onOpenProfile={onOpenProfile}
                />
                <div className="mention-footer-actions" aria-label="Audio actions">
                  {scheduled ? (
                    <button
                      type="button"
                      className={`mention-footer-pill mention-footer-action mention-footer-button${reminderSet ? " active" : ""}`}
                      onClick={() => onToggleReminder(item.id)}
                      aria-label={reminderSet ? "Reminder set" : "Set reminder"}
                      title={reminderSet ? "Reminder set" : "Remind me"}
                    >
                      <AppIcon name="bell" size="md" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`mention-footer-pill mention-footer-action mention-footer-button${reacted ? " active" : ""}`}
                    onClick={() => onReact(item)}
                    aria-label="React to audio"
                    title="React"
                  >
                    <AppIcon name="smile" size="md" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`mention-footer-pill mention-footer-action mention-footer-button${saved ? " active" : ""}`}
                    onClick={() => onToggleSaved(item)}
                    aria-label={saved ? "Remove saved audio" : "Save audio"}
                    title={saved ? "Saved" : "Save"}
                  >
                    <AppIcon name="pin" size="md" aria-hidden="true" />
                  </button>
                  {unread ? (
                    <button
                      type="button"
                      className="mention-footer-pill mention-footer-action mention-footer-button"
                      onClick={() => onMarkRead(item)}
                      aria-label="Mark audio as read"
                      title="Mark read"
                    >
                      <AppIcon name="eye" size="md" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mention-footer-pill mention-footer-action mention-footer-action--primary mention-footer-button"
                    onClick={() => primaryAction(item, onSelect, onOpenRadio)}
                    aria-label={podcast ? "Play episode" : live ? "Listen now" : "Open in Radio"}
                    title={podcast ? "Play" : live ? "Listen" : "Open Radio"}
                  >
                    <AppIcon name={podcast || live ? "play" : "headphones"} size="md" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </footer>

            {item.mentionHighlight ? (
              <div className="mention-comment-preview audio-mention-highlight" aria-label="Mention highlight">
                <div className="mention-comment-preview-head">
                  <AppIcon name="hash" size="sm" aria-hidden="true" />
                  <span>
                    {item.mentionSource === "episode_comment"
                      ? "Mentioned you in a comment"
                      : "Mentioned you in the episode notes"}
                  </span>
                </div>
                <div className="mention-comment-preview-list">
                  <article className="mention-comment-preview-item">
                    <p>
                      <span>{item.mentionHighlight}</span>
                    </p>
                  </article>
                </div>
              </div>
            ) : previewComment ? (
              <div className="mention-comment-preview" aria-label="Comment preview">
                <div className="mention-comment-preview-head">
                  <AppIcon name="reply" size="sm" aria-hidden="true" />
                  <span>Recent comments</span>
                  <strong>{commentCount}</strong>
                </div>
                <div className="mention-comment-preview-list">
                  <article className="mention-comment-preview-item">
                    <button
                      type="button"
                      className="mention-comment-preview-avatar"
                      aria-label={previewAuthor ? `Open ${previewAuthor.displayName} profile` : "Open commenter profile"}
                      onClick={(event) => previewAuthor && onOpenProfile(event, previewAuthor)}
                      disabled={!previewAuthor}
                    >
                      {previewAuthor ? <MemberAvatar member={previewAuthor} size={24} /> : <AppIcon name="user" size="xs" />}
                    </button>
                    <p>
                      <strong>{previewAuthor?.displayName ?? "Picom member"}</strong>
                      <span>{previewComment.body}</span>
                    </p>
                  </article>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </article>
      {menu}
    </>
  );
}
