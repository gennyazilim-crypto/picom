import { useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Community, Member, Message } from "../types/community";
import { MessageItem } from "./MessageItem";
import { UnreadDivider } from "./UnreadDivider";

type ToastTone = "info" | "error" | "success";

type MessageListProps = {
  community: Community;
  messages: Message[];
  currentUserId: string;
  readReceiptsEnabled: boolean;
  highlightedMessageId?: string | null;
  editingMessageId: string | null;
  typingNames: string[];
  onContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
  onReply: (message: Message) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (message: Message, body: string) => void;
  onDelete: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  onRetrySend: (message: Message) => void;
  onRemoveFailed: (message: Message) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  blockedUserIds?: string[];
  announcement?: boolean;
  onNearBottomChange?: (nearBottom: boolean) => void;
};

const READ_BOTTOM_THRESHOLD_PX = 96;

function formatTypingNames(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing...`;
}

function canModerate(roleLevel: number | undefined) {
  return (roleLevel ?? 0) >= 60;
}

export function MessageList({
  community,
  messages,
  currentUserId,
  readReceiptsEnabled,
  highlightedMessageId,
  editingMessageId,
  typingNames,
  onContextMenu,
  onOpenProfile,
  onOpenImage,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleReaction,
  onRetrySend,
  onRemoveFailed,
  pushToast,
  blockedUserIds = [],
  announcement = false,
  onNearBottomChange,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastMessageId = messages[messages.length - 1]?.id;
  const memberByUserId = useMemo(() => new Map(community.members.map((member) => [member.userId, member])), [community.members]);
  const roleById = useMemo(() => new Map(community.roles.map((role) => [role.id, role])), [community.roles]);
  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const blockedUserIdSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const currentMember = memberByUserId.get(currentUserId);
  const currentRole = roleById.get(currentMember?.roleId ?? "");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!nearBottomRef.current) return;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      onNearBottomChange?.(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lastMessageId, onNearBottomChange]);

  useEffect(() => {
    nearBottomRef.current = true;
    onNearBottomChange?.(true);
  }, [community.id, onNearBottomChange]);

  const handleScroll = () => {
    const element = listRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= READ_BOTTOM_THRESHOLD_PX;
    if (nearBottomRef.current === nearBottom) return;
    nearBottomRef.current = nearBottom;
    onNearBottomChange?.(nearBottom);
  };

  useEffect(() => {
    if (!highlightedMessageId) return;

    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])
        .find((element) => element.dataset.messageId === highlightedMessageId);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightedMessageId, messages.length]);

  if (!messages.length) {
    return (
      <div className="message-list empty-state">
        <h2>No messages yet</h2>
        <p>{typingNames.length ? formatTypingNames(typingNames) : "Send the first local message in this desktop channel."}</p>
      </div>
    );
  }

  return (
    <div className={`message-list ${announcement ? "announcement-message-list" : ""}`} ref={listRef} onScroll={handleScroll}>
      {messages.map((message, index) => {
        const resolvedMember = memberByUserId.get(message.authorId);
        const member: Member = resolvedMember ?? { id: `deleted-${message.authorId}`, userId: message.authorId, displayName: "Deleted User", username: "deleted-account", avatarSeed: "deleted-user", status: "offline", statusText: "Account deleted", roleId: "member" };
        const profileUnavailable = !resolvedMember || member.displayName.trim().toLowerCase() === "deleted user";
        const role = roleById.get(member.roleId);
        const replyToMessage = message.replyToMessageId ? messageById.get(message.replyToMessageId) ?? null : null;
        const replyToMember = replyToMessage ? memberByUserId.get(replyToMessage.authorId) : undefined;
        const ownMessage = message.authorId === currentUserId;
        const blockedUserMessage = !ownMessage && blockedUserIdSet.has(member.userId);

        if (blockedUserMessage) {
          return (
            <div key={message.id} data-message-id={message.id} className={message.id === highlightedMessageId ? "message-search-highlight" : undefined}>
              {index === Math.max(1, Math.floor(messages.length / 2)) ? <UnreadDivider /> : null}
              <div className="blocked-message-placeholder">
                <strong>Blocked user message</strong>
                <span>Message hidden from {member.displayName}. Open their profile to unblock.</span>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} data-message-id={message.id} className={message.id === highlightedMessageId ? "message-search-highlight" : undefined}>
            {index === Math.max(1, Math.floor(messages.length / 2)) ? <UnreadDivider /> : null}
            <MessageItem
              communityId={community.id}
              profileUnavailable={profileUnavailable}
              message={message}
              member={member}
              role={role}
              replyToMessage={replyToMessage}
              replyToMember={replyToMember}
              currentUserId={currentUserId}
              readReceiptsEnabled={readReceiptsEnabled}
              canEdit={ownMessage && !message.deletedAt}
              canDelete={(ownMessage || canModerate(currentRole?.level)) && !message.deletedAt}
              editing={editingMessageId === message.id}
              onContextMenu={onContextMenu}
              onOpenProfile={onOpenProfile}
              onOpenImage={onOpenImage}
              onReply={onReply}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              onToggleReaction={onToggleReaction}
              onRetrySend={onRetrySend}
              onRemoveFailed={onRemoveFailed}
              pushToast={pushToast}
            />
          </div>
        );
      })}
      {typingNames.length ? <div className="typing-indicator">{formatTypingNames(typingNames)}</div> : null}
    </div>
  );
}
