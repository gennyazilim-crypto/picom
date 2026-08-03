import { useMemo } from "react";
import type { DirectConversation } from "../types/directMessages";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { ProfileDisplayName } from "./ProfileDisplayName";

type MentionFeedMessageAlertsProps = {
  conversations: readonly DirectConversation[];
  currentUserId: string;
  onOpenConversation: (conversation: DirectConversation) => void;
  maxVisible?: number;
};

function truncatePreview(value: string, maxLength = 34) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

/** Feed header alerts only surface unread DMs; read conversations must disappear. */
export function getMentionFeedMessageAlerts(
  conversations: readonly DirectConversation[],
  _currentUserId: string,
  maxVisible = 3,
) {
  return [...conversations]
    .filter((conversation) => !conversation.archivedAt && conversation.unreadCount > 0)
    .sort((left, right) => {
      const unreadDelta = right.unreadCount - left.unreadCount;
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
      className="mention-feed-message-alerts has-unread-queue"
      aria-label="Unread direct messages"
      aria-live="polite"
    >
      <span className="mention-feed-message-alerts-summary" aria-label={`${unreadTotal} unread direct messages`}>
        <i className="mention-feed-message-alerts-pulse" aria-hidden="true" />
        {unreadTotal > 9 ? "9+" : unreadTotal} unread
      </span>
      {alerts.map((conversation) => {
        const verification = getUserVerificationSummary(conversation.participantUserId);
        const preview = truncatePreview(conversation.lastMessagePreview || "New message");
        const timeLabel = dateTimeService.formatMessageTime(conversation.updatedAt);

        return (
          <button
            key={conversation.id}
            type="button"
            className="mention-feed-message-alert has-unread"
            title={conversation.lastMessagePreview || "New direct message"}
            aria-label={`Open unread direct message. ${preview}. ${conversation.unreadCount} unread.`}
            onClick={() => onOpenConversation(conversation)}
          >
            <span className="mention-feed-message-alert-kind" aria-hidden="true">
              <AppIcon name="inbox" size="xs" />
            </span>
            <span className="mention-feed-message-alert-avatar">
              <VerifiedAvatarFrame
                userId={conversation.participantUserId}
                label={conversation.participantName}
                avatarUrl={conversation.participantAvatarUrl}
                size="compact"
                avatarSize={28}
                verification={verification}
              />
              <i className="mention-feed-message-alert-dot" aria-hidden="true" />
            </span>
            <span className="mention-feed-message-alert-copy">
              <span className="mention-feed-message-alert-top">
                <strong><ProfileDisplayName userId={conversation.participantUserId} fallback={conversation.participantName} /></strong>
                <em className="mention-feed-message-alert-label">New</em>
                <time dateTime={conversation.updatedAt}>{timeLabel}</time>
              </span>
              <span className="mention-feed-message-alert-preview">{preview}</span>
            </span>
            <span className="mention-feed-message-alert-badge" aria-hidden="true">
              {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
