import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";

type ToastTone = "info" | "error" | "success";
const composerIcons = mvpUiIconMap.messageComposer;

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
      <ChatHeader channel={channel} membersVisible={membersVisible} onToggleMembers={onToggleMembers} />

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
        <button className="composer-tool" aria-label="Attach"><AppIcon name={composerIcons.attach} size="lg" /></button>
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
        <button className="composer-tool" aria-label="Emoji"><AppIcon name={composerIcons.emoji} size="lg" /></button>
        <button className="composer-tool text-tool" aria-label="GIF placeholder">GIF</button>
        <button className="send-button" disabled={!body.trim() && !previews.length} onClick={send}>
          <AppIcon name={composerIcons.send} size="sm" /> Send
        </button>
      </div>
      {previews.length ? (
        <div className="composer-previews">
          {previews.map((preview) => (
            <div key={preview.id}>
              <img src={preview.url} alt={preview.name} />
              <button aria-label={`Remove ${preview.name}`} onClick={() => removePreview(preview)}><AppIcon name={composerIcons.close} size="xs" /></button>
            </div>
          ))}
        </div>
      ) : null}
      {dragging ? <div className="drop-hint"><AppIcon name={composerIcons.image} /> Drop images to attach</div> : null}
    </footer>
  );
}


