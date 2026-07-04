import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Community, Member, Message } from "../types/community";
import { MessageItem } from "./MessageItem";

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
