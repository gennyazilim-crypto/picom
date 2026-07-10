import { useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Attachment, Member, Message, Role } from "../types/community";
import { clipboardService } from "../services/clipboardService";
import { dateTimeService } from "../services/dateTimeService";
import { externalLinkService } from "../services/desktop/externalLinkService";
import { messageDeliveryReceiptService } from "../services/messageDeliveryReceiptService";
import { AttachmentGrid } from "./AttachmentGrid";
import { EmojiPicker } from "./EmojiPicker";
import { MemberAvatar } from "./MemberAvatar";
import { MessageHoverActions } from "./MessageHoverActions";
import { StickerMessage } from "./StickerMessage";
import { customEmojiService } from "../services/customEmojiService";
import { PollMessageCard } from "./PollMessageCard";

const messageUrlPattern = /(https?:\/\/[^\s<>"]+)/gi;
const trailingUrlPunctuationPattern = /[),.!?;:]+$/;
type ToastTone = "info" | "error" | "success";
type MessageTextPart = Readonly<{ type: "text"; value: string } | { type: "link"; value: string; href: string; domain: string }>;

function splitMessageText(body: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(messageUrlPattern)) {
    const rawMatch = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, index) });
    }

    const trimmedUrl = rawMatch.replace(trailingUrlPunctuationPattern, "");
    const trailing = rawMatch.slice(trimmedUrl.length);
    const safeUrl = externalLinkService.normalizeUrl(trimmedUrl);

    if (safeUrl) {
      parts.push({ type: "link", value: trimmedUrl, href: safeUrl, domain: externalLinkService.getDisplayDomain(safeUrl) });
    } else {
      parts.push({ type: "text", value: trimmedUrl });
    }

    if (trailing) {
      parts.push({ type: "text", value: trailing });
    }

    lastIndex = index + rawMatch.length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: body }];
}

function renderMessageText(body: string, onOpenLink: (url: string) => void) {
  return splitMessageText(body).map((part, index) => {
    if (part.type === "text") {
      return <span key={`${index}-text`}>{part.value}</span>;
    }

    return (
      <button
        key={`${index}-link`}
        type="button"
        className="message-link-button"
        title={`Open external link: ${part.domain}`}
        aria-label={`Open external link: ${part.domain}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenLink(part.href);
        }}
      >
        {part.value}
      </button>
    );
  });
}
type MessageItemProps = {
  message: Message;
  member: Member;
  role?: Role;
  replyToMessage?: Message | null;
  replyToMember?: Member;
  currentUserId: string;
  readReceiptsEnabled: boolean;
  canEdit: boolean;
  canDelete: boolean;
  editing: boolean;
  onContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
  onReply: (message: Message) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (message: Message, body: string) => void;
  onDelete: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  pushToast?: (message: string, tone?: ToastTone) => void;
  communityId: string;
};

export function MessageItem({
  message,
  member,
  role,
  replyToMessage,
  replyToMember,
  currentUserId,
  readReceiptsEnabled,
  canEdit,
  canDelete,
  editing,
  onContextMenu,
  onOpenProfile,
  onOpenImage,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleReaction,
  pushToast,
  communityId,
}: MessageItemProps) {
  const [draft, setDraft] = useState(message.body);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const deleted = Boolean(message.deletedAt);
  const ownMessage = message.authorId === currentUserId;
  const deliveryStatus = messageDeliveryReceiptService.normalize(message.localStatus);
  const deliveryTone = messageDeliveryReceiptService.getTone(deliveryStatus);
  const showDeliveryStatus = ownMessage && !deleted;
  const showRecoveryActions = showDeliveryStatus && messageDeliveryReceiptService.isRecoverable(deliveryStatus);

  useEffect(() => {
    if (editing) setDraft(message.body);
  }, [editing, message.body]);

  const saveEdit = () => {
    const nextBody = draft.trim();
    if (!nextBody || nextBody === message.body) {
      onCancelEdit();
      return;
    }

    onSaveEdit(message, nextBody);
  };

  const openMessageLink = async (url: string) => {
    const result = await externalLinkService.openExternalUrl(url);
    if (!result.ok) {
      pushToast?.(externalLinkService.getUserFriendlyError(result.reason), "error");
    }
  };

  const copyMessageBody = async () => {
    const result = await clipboardService.copyText(message.body);
    pushToast?.(result.ok ? "Message text copied." : result.reason, result.ok ? "success" : "error");
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelEdit();
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    }
  };

  return (
    <article className="message-item" onContextMenu={(event) => onContextMenu(event, message)}>
      <button className="avatar-button" onClick={(event) => onOpenProfile(event, member)} aria-label={`Open ${member.displayName} profile`}>
        <MemberAvatar member={member} size={42} />
      </button>
      <div className="message-content">
        <div className="message-meta">
          <button className="message-author-button" type="button" onClick={(event) => onOpenProfile(event, member)}>
            {member.displayName}
          </button>
          {member.isBot ? <span className="bot-badge">BOT</span> : null}
          {message.webhookId ? <span className="webhook-badge" title={message.webhookName ?? "Webhook message"}>WEBHOOK</span> : null}
          {role ? <span className="role-label" style={{ color: role.color }}>{role.name}</span> : null}
          <time title={dateTimeService.formatFullTimestamp(message.createdAt)}>{dateTimeService.formatMessageTime(message.createdAt)}</time>
          {message.editedAt && !deleted ? <span className="message-edited-label">edited</span> : null}
          {ownMessage ? <span className="message-own-label">you</span> : null}
          {ownMessage && !deleted && readReceiptsEnabled ? (
            <span className="message-read-receipt-placeholder" title="Read receipts placeholder is enabled. Detailed reader lists are not shown.">
              Reads on
            </span>
          ) : null}
          {showDeliveryStatus ? (
            <span
              className={`message-delivery-status status-${deliveryStatus}`}
              data-tone={deliveryTone}
              title={messageDeliveryReceiptService.getDescription(deliveryStatus)}
            >
              {messageDeliveryReceiptService.getLabel(deliveryStatus)}
            </span>
          ) : null}
        </div>
        {message.replyToMessageId ? (
          <div className="message-reply-preview">
            <span>{replyToMember?.displayName ?? "Unknown member"}</span>
            <p>{replyToMessage?.deletedAt ? "Original message was deleted." : replyToMessage?.body ?? "Original message unavailable."}</p>
          </div>
        ) : null}
        {deleted ? (
          <p className="message-deleted-placeholder">Message deleted.</p>
        ) : editing ? (
          <div className="message-edit-box">
            <textarea value={draft} autoFocus rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={onEditKeyDown} />
            <div>
              <button type="button" onClick={saveEdit}>Save</button>
              <button type="button" onClick={onCancelEdit}>Cancel</button>
            </div>
            <small>Enter saves, Escape cancels, Shift Enter adds a new line.</small>
          </div>
        ) : (
          /^\[sticker:([a-z0-9-]+)\]$/.test(message.body) ? <StickerMessage stickerId={/^\[sticker:([a-z0-9-]+)\]$/.exec(message.body)?.[1] ?? ""} /> : <p className="message-text">{renderMessageText(message.body, (url) => { void openMessageLink(url); })}</p>
        )}
        {!deleted && message.attachments?.length ? <AttachmentGrid attachments={message.attachments} onOpenImage={onOpenImage} /> : null}
        {!deleted && message.poll ? <PollMessageCard initialPoll={message.poll} currentUserId={currentUserId} onNotice={pushToast} /> : null}
        {!deleted && message.reactions?.length ? (
          <div className="reaction-row">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className={reaction.reactedByCurrentUser ? "active" : ""}
                type="button"
                onClick={() => onToggleReaction(message, reaction.emoji)}
              >
                {customEmojiService.resolve(communityId, reaction.emoji) ? <img className="reaction-custom-emoji" src={customEmojiService.resolve(communityId, reaction.emoji)?.imageUrl} alt={reaction.emoji} /> : reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
        {showRecoveryActions ? (
          <div className="message-delivery-actions" aria-label="Message delivery recovery actions">
            <button type="button" onClick={() => pushToast?.("Retry placeholder is ready for the offline queue.", "info")}>Retry placeholder</button>
            <button type="button" onClick={() => void copyMessageBody()}>Copy text</button>
            <button type="button" onClick={() => pushToast?.("Remove placeholder is ready for failed local messages.", "info")}>Remove placeholder</button>
          </div>
        ) : null}
        {!deleted && reactionPickerOpen ? (
          <EmojiPicker
            className="message-reaction-picker"
            label="Choose reaction"
            onClose={() => setReactionPickerOpen(false)}
            communityId={communityId}
            onSelect={(emoji) => {
              onToggleReaction(message, emoji);
              setReactionPickerOpen(false);
            }}
          />
        ) : null}
        {!deleted ? (
          <MessageHoverActions
            canEdit={canEdit}
            canDelete={canDelete}
            onReply={() => onReply(message)}
            onReact={() => setReactionPickerOpen((current) => !current)}
            onEdit={() => onStartEdit(message)}
            onDelete={() => onDelete(message)}
            onMore={() => undefined}
          />
        ) : null}
      </div>
    </article>
  );
}

