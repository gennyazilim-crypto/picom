import { useMemo } from "react";
import type { DirectConversation } from "../types/directMessages";
import { dateTimeService } from "../services/dateTimeService";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { getUserVerificationSummary } from "../utils/verificationHelpers";

type MentionFeedMessageAlertsProps = {
  conversations: readonly DirectConversation[];
  currentUserId: string;
  onOpenConversation: (conversation: DirectConversation) => void;
  maxVisible?: number;
};

function truncatePreview(value: string, maxLength = 34) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function isIncomingConversation(conversation: DirectConversation, currentUserId: string) {
  if (conversation.unreadCount > 0) return true;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return Boolean(lastMessage && lastMessage.authorId !== currentUserId && !lastMessage.deletedAt);
}

export function getMentionFeedMessageAlerts(
  conversations: readonly DirectConversation[],
  currentUserId: string,
  maxVisible = 3,
) {
  return [...conversations]
    .filter((conversation) => !conversation.archivedAt && isIncomingConversation(conversation, currentUserId))
    .sort((left, right) => {
      const unreadDelta = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
      if (unreadDelta !== 0) return unreadDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, maxVisible);
}

export function MentionFeedMessageAlerts({
  conversations,
  currentUserId,
  onOpenConversation,
  maxVisible = 3,
}: MentionFeedMessageAlertsProps) {
  const alerts = useMemo(
    () => getMentionFeedMessageAlerts(conversations, currentUserId, maxVisible),
    [conversations, currentUserId, maxVisible],
  );
  const unreadTotal = useMemo(
    () => alerts.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [alerts],
  );

  if (!alerts.length) return null;

  return (
    <div
      className={`mention-feed-message-alerts${unreadTotal ? " has-unread-queue" : ""}`}
      aria-label="Incoming direct messages"
      aria-live="polite"
    >
      {unreadTotal ? (
        <span className="mention-feed-message-alerts-summary" aria-label={`${unreadTotal} unread direct messages`}>
          <i className="mention-feed-message-alerts-pulse" aria-hidden="true" />
          {unreadTotal > 9 ? "9+" : unreadTotal} okunmamış
        </span>
      ) : null}
      {alerts.map((conversation) => {
        const verification = getUserVerificationSummary(conversation.participantUserId);
        const preview = truncatePreview(conversation.lastMessagePreview || "New message");
        const timeLabel = dateTimeService.formatMessageTime(conversation.updatedAt);
        const hasUnread = conversation.unreadCount > 0;

        return (
          <button
            key={conversation.id}
            type="button"
            className={`mention-feed-message-alert${hasUnread ? " has-unread" : ""}`}
            title={`${conversation.participantName}: ${conversation.lastMessagePreview}${hasUnread ? ` (${conversation.unreadCount} okunmamış)` : ""}`}
            aria-label={`Open message from ${conversation.participantName}. ${preview}${hasUnread ? `. ${conversation.unreadCount} unread.` : ""}`}
            onClick={() => onOpenConversation(conversation)}
          >
            <span className="mention-feed-message-alert-avatar">
              <VerifiedAvatarFrame
                userId={conversation.participantUserId}
                label={conversation.participantName}
                avatarUrl={conversation.participantAvatarUrl}
                size="compact"
                avatarSize={28}
                verification={verification}
              />
              {hasUnread ? <i className="mention-feed-message-alert-dot" aria-hidden="true" /> : null}
            </span>
            <span className="mention-feed-message-alert-copy">
              <span className="mention-feed-message-alert-top">
                <strong>{conversation.participantName}</strong>
                {hasUnread ? <em className="mention-feed-message-alert-label">Yeni</em> : null}
                <time dateTime={conversation.updatedAt}>{timeLabel}</time>
              </span>
              <span className="mention-feed-message-alert-preview">{preview}</span>
            </span>
            {hasUnread ? (
              <span className="mention-feed-message-alert-badge" aria-hidden="true">
                {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
