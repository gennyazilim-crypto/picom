import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Community, Member, Message } from "../types/community";
import { MessageItem } from "./MessageItem";
import { UnreadDivider } from "./UnreadDivider";

type MessageListProps = {
  community: Community;
  messages: Message[];
  onContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
};

export function MessageList({ community, messages, onContextMenu, onOpenProfile, onOpenImage }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

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
            {index === Math.max(1, Math.floor(messages.length / 2)) ? <UnreadDivider /> : null}
            <MessageItem
              message={message}
              member={member}
              role={role}
              onContextMenu={onContextMenu}
              onOpenProfile={onOpenProfile}
              onOpenImage={onOpenImage}
            />
          </div>
        );
      })}
    </div>
  );
}
