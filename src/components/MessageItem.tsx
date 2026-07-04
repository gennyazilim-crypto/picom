import { useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Attachment, Member, Message, Role } from "../types/community";
import { AttachmentGrid } from "./AttachmentGrid";
import { MemberAvatar } from "./MemberAvatar";
import { MessageHoverActions } from "./MessageHoverActions";

const reactionOptions = ["👍", "❤️", "😂", "🔥", "👀"];

type MessageItemProps = {
  message: Message;
  member: Member;
  role?: Role;
  replyToMessage?: Message | null;
  replyToMember?: Member;
  currentUserId: string;
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
};

export function MessageItem({
  message,
  member,
  role,
  replyToMessage,
  replyToMember,
  currentUserId,
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
}: MessageItemProps) {
  const [draft, setDraft] = useState(message.body);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const deleted = Boolean(message.deletedAt);

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
          <strong>{member.displayName}</strong>
          {role ? <span className="role-label" style={{ color: role.color }}>{role.name}</span> : null}
          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
          {message.editedAt && !deleted ? <span className="message-edited-label">edited</span> : null}
          {message.authorId === currentUserId ? <span className="message-own-label">you</span> : null}
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
          <p>{message.body}</p>
        )}
        {!deleted && message.attachments?.length ? <AttachmentGrid attachments={message.attachments} onOpenImage={onOpenImage} /> : null}
        {!deleted && message.reactions?.length ? (
          <div className="reaction-row">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className={reaction.reactedByCurrentUser ? "active" : ""}
                type="button"
                onClick={() => onToggleReaction(message, reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
        {!deleted && reactionPickerOpen ? (
          <div className="message-reaction-picker" role="menu" aria-label="Choose reaction">
            {reactionOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggleReaction(message, emoji);
                  setReactionPickerOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
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
