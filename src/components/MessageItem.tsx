import type { MouseEvent } from "react";
import type { Attachment, Member, Message, Role } from "../types/community";
import { MemberAvatar } from "./MemberAvatar";
import { MessageHoverActions } from "./MessageHoverActions";

type MessageItemProps = {
  message: Message;
  member: Member;
  role?: Role;
  onContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
};

export function MessageItem({ message, member, role, onContextMenu, onOpenProfile, onOpenImage }: MessageItemProps) {
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
        </div>
        <p>{message.body}</p>
        {message.attachments?.length ? <AttachmentGrid attachments={message.attachments} onOpenImage={onOpenImage} /> : null}
        {message.reactions?.length ? (
          <div className="reaction-row">
            {message.reactions.map((reaction) => (
              <button key={reaction.emoji}>{reaction.emoji} {reaction.count}</button>
            ))}
          </div>
        ) : null}
        <MessageHoverActions />
      </div>
    </article>
  );
}

function AttachmentGrid({ attachments, onOpenImage }: { attachments: Attachment[]; onOpenImage: (image: Attachment) => void }) {
  return (
    <div className={`attachment-grid count-${Math.min(attachments.length, 4)}`}>
      {attachments.slice(0, 4).map((attachment) => (
        <button key={attachment.id} className="attachment-card" onClick={() => onOpenImage(attachment)} aria-label={`Open ${attachment.alt}`}>
          <img src={attachment.url} alt={attachment.alt} loading="lazy" />
        </button>
      ))}
    </div>
  );
}
