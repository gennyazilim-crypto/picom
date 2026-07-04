import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Community, Member, Message } from "../types/community";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type MessageListProps = {
  community: Community;
  messages: Message[];
  onContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
};

export function MessageList({ community, messages, onContextMenu, onOpenProfile, onOpenImage }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (!messages.length) {
    return (
      <div className="message-list empty-state">
        <h2>No messages yet</h2>
        <p>Send the first local message in this desktop channel.</p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((message, index) => {
        const member = community.members.find((candidate) => candidate.userId === message.authorId) ?? community.members[0];
        const role = community.roles.find((candidate) => candidate.id === member.roleId);

        return (
          <div key={message.id}>
            {index === Math.max(1, Math.floor(messages.length / 2)) ? (
              <div className="unread-divider">
                <span />Unread messages<span />
              </div>
            ) : null}
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
                <div className="message-hover-actions">
                  <button aria-label="Reply"><AppIcon name="reply" size="sm" /></button>
                  <button aria-label="React"><AppIcon name="smile" size="sm" /></button>
                  <button aria-label="More"><AppIcon name="more" size="sm" /></button>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
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
