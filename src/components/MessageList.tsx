import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Community, Member, Message } from "../types/community";
import { MessageItem } from "./MessageItem";
import { UnreadDivider } from "./UnreadDivider";

type MessageListProps = {
  community: Community;
  messages: Message[];
  currentUserId: string;
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
};

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
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;
  const currentMember = community.members.find((member) => member.userId === currentUserId);
  const currentRole = community.roles.find((role) => role.id === currentMember?.roleId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lastMessageId]);

  if (!messages.length) {
    return (
      <div className="message-list empty-state">
        <h2>No messages yet</h2>
        <p>{typingNames.length ? formatTypingNames(typingNames) : "Send the first local message in this desktop channel."}</p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((message, index) => {
        const member = community.members.find((candidate) => candidate.userId === message.authorId) ?? community.members[0];
        const role = community.roles.find((candidate) => candidate.id === member.roleId);
        const replyToMessage = message.replyToMessageId ? messages.find((candidate) => candidate.id === message.replyToMessageId) : null;
        const replyToMember = replyToMessage ? community.members.find((candidate) => candidate.userId === replyToMessage.authorId) : undefined;
        const ownMessage = message.authorId === currentUserId;

        return (
          <div key={message.id}>
            {index === Math.max(1, Math.floor(messages.length / 2)) ? <UnreadDivider /> : null}
            <MessageItem
              message={message}
              member={member}
              role={role}
              replyToMessage={replyToMessage}
              replyToMember={replyToMember}
              currentUserId={currentUserId}
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
            />
          </div>
        );
      })}
      {typingNames.length ? <div className="typing-indicator">{formatTypingNames(typingNames)}</div> : null}
    </div>
  );
}
