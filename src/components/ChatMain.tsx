import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { AppIcon } from "./AppIcon";

type ToastTone = "info" | "error" | "success";

const avatarPalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"];
const hash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

function Avatar({ member, size = 36 }: { member?: Member; size?: number }) {
  const text = member?.displayName ?? "P";
  const color = avatarPalette[hash(text) % avatarPalette.length];
  const initials = text
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className="generated-avatar"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))` }}
    >
      {initials}
    </span>
  );
}

type ChatMainProps = {
  community: Community;
  channel: Channel;
  messages: Message[];
  onSendMessage: (body: string, attachments?: Attachment[]) => void;
  onToggleMembers: () => void;
  membersVisible: boolean;
  onMessageContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function ChatMain({ community, channel, messages, onSendMessage, onToggleMembers, membersVisible, onMessageContextMenu, onOpenProfile, onOpenImage, pushToast }: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);

  return (
    <main className="chat-main">
      <header className="chat-header">
        <div className="chat-title">
          <AppIcon name={channel.type === "voice" ? "voice" : "hash"} size="lg" />
          <div>
            <strong>{channel.name}</strong>
            <span>{channel.topic ?? "Picom desktop channel"}</span>
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-button" aria-label="Pinned">
            <AppIcon name="pin" />
          </button>
          <button className="icon-button" aria-label="Notifications">
            <AppIcon name="bell" />
          </button>
          <button className="icon-button" aria-label="Inbox">
            <AppIcon name="inbox" />
          </button>
          <button className={`icon-button ${membersVisible ? "active" : ""}`} aria-label="Toggle members" onClick={onToggleMembers}>
            <AppIcon name="users" />
          </button>
          <button className="icon-button" aria-label="Search">
            <AppIcon name="search" />
          </button>
          <button className="icon-button" aria-label="More">
            <AppIcon name="more" />
          </button>
        </div>
      </header>

      {channel.type === "voice" ? (
        <div className="voice-placeholder">
          <span className="voice-orb">
            <AppIcon name="voice" size="xl" />
          </span>
          <h2>{channel.name}</h2>
          <p>Voice rooms are placeholders in the MVP. Text chat remains the first stable path.</p>
        </div>
      ) : (
        <>
          <MessageList community={community} messages={channelMessages} onContextMenu={onMessageContextMenu} onOpenProfile={onOpenProfile} onOpenImage={onOpenImage} />
          <MessageComposer channel={channel} onSendMessage={onSendMessage} pushToast={pushToast} />
        </>
      )}
    </main>
  );
}

function MessageList({ community, messages, onContextMenu, onOpenProfile, onOpenImage }: { community: Community; messages: Message[]; onContextMenu: (event: MouseEvent, message: Message) => void; onOpenProfile: (event: MouseEvent, member: Member) => void; onOpenImage: (image: Attachment) => void }) {
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
                <Avatar member={member} size={42} />
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

function MessageComposer({ channel, onSendMessage, pushToast }: { channel: Channel; onSendMessage: (body: string, attachments?: Attachment[]) => void; pushToast: (message: string, tone?: ToastTone) => void }) {
  const [body, setBody] = useState("");
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<LocalAttachmentPreview[]>([]);

  const addFiles = (files: FileList | File[]) => {
    const next: LocalAttachmentPreview[] = [];
    Array.from(files).forEach((file) => {
      const validation = fileService.validate(file);
      if (!validation.ok) {
        pushToast(validation.reason ?? "File rejected.", "error");
        return;
      }
      next.push(fileService.createPreview(file));
    });
    if (next.length) setPreviews((current) => [...current, ...next].slice(0, 4));
  };

  const removePreview = (preview: LocalAttachmentPreview) => {
    fileService.revoke(preview);
    setPreviews((current) => current.filter((item) => item.id !== preview.id));
  };

  const send = () => {
    const value = body.trim();
    if (!value && !previews.length) return;
    const attachments: Attachment[] = previews.map((preview) => ({ id: preview.id, type: "image", url: preview.url, alt: preview.name }));
    onSendMessage(value || `Shared ${attachments.length} image attachment${attachments.length > 1 ? "s" : ""}.`, attachments);
    setBody("");
    setPreviews([]);
  };

  return (
    <footer
      className={`message-composer ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <div className="composer-bar">
        <button className="composer-tool" aria-label="Attach"><AppIcon name="paperclip" size="lg" /></button>
        <textarea
          value={body}
          placeholder={`Message #${channel.name}`}
          rows={1}
          onChange={(event) => setBody(event.target.value)}
          onPaste={(event) => {
            if (event.clipboardData.files.length) addFiles(event.clipboardData.files);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button className="composer-tool" aria-label="Emoji"><AppIcon name="smile" size="lg" /></button>
        <button className="composer-tool text-tool" aria-label="GIF placeholder">GIF</button>
        <button className="send-button" disabled={!body.trim() && !previews.length} onClick={send}>
          <AppIcon name="send" size="sm" /> Send
        </button>
      </div>
      {previews.length ? (
        <div className="composer-previews">
          {previews.map((preview) => (
            <div key={preview.id}>
              <img src={preview.url} alt={preview.name} />
              <button aria-label={`Remove ${preview.name}`} onClick={() => removePreview(preview)}><AppIcon name="close" size="xs" /></button>
            </div>
          ))}
        </div>
      ) : null}
      {dragging ? <div className="drop-hint"><AppIcon name="image" /> Drop images to attach</div> : null}
    </footer>
  );
}