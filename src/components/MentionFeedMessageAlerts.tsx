import { useMemo } from "react";
import type { DirectConversation } from "../types/directMessages";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { ProfileDisplayName } from "./ProfileDisplayName";
import { useTranslation } from "../i18n";

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
  const { t } = useTranslation("feed");
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
      aria-label={t("alerts.aria")}
      aria-live="polite"
    >
      <span className="mention-feed-message-alerts-summary" aria-label={t("alerts.summaryAria", { count: unreadTotal })}>
        <i className="mention-feed-message-alerts-pulse" aria-hidden="true" />
        {t("alerts.unreadLabel", { count: unreadTotal > 9 ? "9+" : unreadTotal })}
      </span>
      {alerts.map((conversation) => {
        const verification = getUserVerificationSummary(conversation.participantUserId);
        const preview = truncatePreview(conversation.lastMessagePreview || t("alerts.newMessage"));
        const timeLabel = dateTimeService.formatMessageTime(conversation.updatedAt);

        return (
          <button
            key={conversation.id}
            type="button"
            className="mention-feed-message-alert has-unread"
            title={conversation.lastMessagePreview || t("alerts.newDirectMessage")}
            aria-label={t("alerts.openAria", { preview, count: conversation.unreadCount })}
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
                <em className="mention-feed-message-alert-label">{t("alerts.new")}</em>
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
