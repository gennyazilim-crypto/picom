import { useEffect, useRef, useState } from "react";
import type { Attachment, Channel, Member, Message } from "../types/community";
import { attachmentService } from "../services/attachmentService";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { loggingService } from "../services/loggingService";
import { messageDraftService } from "../services/messageDraftService";
import { uploadService } from "../services/uploadService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

type ToastTone = "info" | "error" | "success";
const composerIcons = mvpUiIconMap.messageComposer;

function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

function getClipboardFiles(dataTransfer: DataTransfer): File[] {
  const directFiles = Array.from(dataTransfer.files);
  if (directFiles.length) return directFiles;

  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

type MessageComposerProps = {
  communityId: string;
  channel: Channel;
  replyToMessage?: Message | null;
  replyToMember?: Member;
  onCancelReply: () => void;
  onSendMessage: (body: string, attachments?: Attachment[], replyToMessageId?: string | null) => void | Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  disabledReason?: string;
};

const composerEmojiOptions = ["👍", "❤️", "😂", "🔥", "👀"];

export function MessageComposer({ communityId, channel, replyToMessage, replyToMember, onCancelReply, onSendMessage, onTypingStart, onTypingStop, pushToast, disabledReason }: MessageComposerProps) {
  const [body, setBody] = useState(() => messageDraftService.getDraft({ communityId, channelId: channel.id })?.text ?? "");
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<LocalAttachmentPreview[]>([]);
  const [sending, setSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<LocalAttachmentPreview[]>([]);
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef<number | null>(null);
  const onTypingStopRef = useRef(onTypingStop);
  const previousChannelIdRef = useRef(channel.id);
  const previousCommunityIdRef = useRef(communityId);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    onTypingStopRef.current = onTypingStop;
  }, [onTypingStop]);

  const stopTypingNow = () => {
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    lastTypingSentAtRef.current = 0;
    onTypingStopRef.current();
  };

  useEffect(() => () => {
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    stopTypingNow();
  }, []);

  useEffect(() => {
    if (previousChannelIdRef.current === channel.id && previousCommunityIdRef.current === communityId) return;

    previousChannelIdRef.current = channel.id;
    previousCommunityIdRef.current = communityId;
    stopTypingNow();
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    previewsRef.current = [];
    setPreviews([]);
    setEmojiPickerOpen(false);
    setBody(messageDraftService.getDraft({ communityId, channelId: channel.id })?.text ?? "");
  }, [channel.id, communityId]);

  const scheduleTypingStop = () => {
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);

    typingStopTimerRef.current = window.setTimeout(() => {
      onTypingStopRef.current();
      typingStopTimerRef.current = null;
    }, 2400);
  };

  const notifyTyping = (value: string) => {
    if (!value.trim()) {
      stopTypingNow();
      return;
    }

    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 1400) {
      onTypingStart();
      lastTypingSentAtRef.current = now;
    }

    scheduleTypingStop();
  };

  useEffect(() => {
    const preventWindowFileDrop = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
    };

    window.addEventListener("dragover", preventWindowFileDrop);
    window.addEventListener("drop", preventWindowFileDrop);

    return () => {
      window.removeEventListener("dragover", preventWindowFileDrop);
      window.removeEventListener("drop", preventWindowFileDrop);
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    if (disabledReason) {
      pushToast(disabledReason, "info");
      return;
    }

    const next: LocalAttachmentPreview[] = [];

    Array.from(files).forEach((file) => {
      const validation = fileService.validate(file);
      if (!validation.ok) {
        loggingService.logWarn("Attachment rejected before preview", {
          code: validation.code,
          mimeType: file.type || "unknown",
          sizeBytes: file.size,
        });
        pushToast(validation.reason ?? "File rejected.", "error");
        return;
      }

      next.push(fileService.createPreview(file));
    });

    if (next.length) {
      setPreviews((current) => {
        const combined = [...current, ...next];
        const kept = combined.slice(0, 4);
        combined.slice(4).forEach((preview) => fileService.revoke(preview));
        return kept;
      });
    }
  };

  const removePreview = (preview: LocalAttachmentPreview) => {
    fileService.revoke(preview);
    setPreviews((current) => current.filter((item) => item.id !== preview.id));
  };

  const send = async () => {
    if (disabledReason) {
      pushToast(disabledReason, "info");
      return;
    }

    const value = body.trim();
    if ((!value && !previews.length) || sending) return;

    setSending(true);
    const persistedAttachments = new Map<string, {
      id: string;
      publicUrl: string | null;
      storagePath: string;
      fileName: string;
      mimeType: string;
    }>();

    for (const preview of previews) {
      const result = await uploadService.uploadImageAttachment({
        communityId,
        channelId: channel.id,
        file: preview.file,
      });

      if (!result.ok) {
        pushToast(result.error.message, "error");
        setSending(false);
        return;
      }

      const metadata = await attachmentService.createPendingAttachmentMetadata({ upload: result.data });
      if (!metadata.ok) {
        pushToast(metadata.error.message, "error");
        setSending(false);
        return;
      }

      persistedAttachments.set(preview.id, {
        id: metadata.data.id,
        publicUrl: metadata.data.publicUrl ?? result.data.publicUrl,
        storagePath: metadata.data.storagePath,
        fileName: metadata.data.fileName,
        mimeType: metadata.data.mimeType,
      });
    }

    const attachments: Attachment[] = previews.map((preview) => {
      const persisted = persistedAttachments.get(preview.id);
      const uploadedUrl = persisted?.publicUrl ?? null;

      return {
        id: persisted?.id ?? preview.id,
        type: "image",
        url: uploadedUrl || preview.url,
        publicUrl: uploadedUrl,
        storagePath: persisted?.storagePath,
        mimeType: persisted?.mimeType,
        alt: persisted?.fileName ?? preview.name,
      };
    });

    await onSendMessage(value || `Shared ${attachments.length} image attachment${attachments.length > 1 ? "s" : ""}.`, attachments, replyToMessage?.id ?? null);
    messageDraftService.clearDraft({ communityId, channelId: channel.id });
    stopTypingNow();
    onCancelReply();
    setBody("");
    setPreviews([]);
    setEmojiPickerOpen(false);
    setSending(false);
  };

  return (
    <footer
      className={`message-composer ${dragging ? "dragging" : ""} ${disabledReason ? "is-disabled" : ""}`}
      aria-label="Message composer. Drop image files here to attach them."
      onDragEnter={(event) => {
        if (disabledReason) return;
        if (!isFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (disabledReason) return;
        if (!isFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (disabledReason) return;
        if (!isFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      {replyToMessage ? (
        <div className="composer-reply-preview">
          <div>
            <strong>Replying to {replyToMember?.displayName ?? "message"}</strong>
            <span>{replyToMessage.deletedAt ? "Original message was deleted." : replyToMessage.body}</span>
          </div>
          <button type="button" aria-label="Cancel reply" onClick={onCancelReply}>
            <AppIcon name={composerIcons.close} size="xs" />
          </button>
        </div>
      ) : null}
      {disabledReason ? <div className="composer-permission-hint" role="status">{disabledReason}</div> : null}
      <div className="composer-bar">
        <input
          ref={fileInputRef}
          className="composer-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button className="composer-tool" aria-label="Attach image" disabled={Boolean(disabledReason)} onClick={() => fileInputRef.current?.click()}>
          <AppIcon name={composerIcons.attach} size="lg" />
        </button>
        <textarea
          value={body}
          placeholder={disabledReason ?? `Message #${channel.name}`}
          rows={1}
          disabled={Boolean(disabledReason)}
          onChange={(event) => {
            const nextBody = event.target.value;
            setBody(nextBody);
            messageDraftService.saveDraft({ communityId, channelId: channel.id }, nextBody);
            notifyTyping(nextBody);
          }}
          onBlur={stopTypingNow}
          onPaste={(event) => {
            if (disabledReason) return;
            const files = getClipboardFiles(event.clipboardData);
            if (!files.length) return;

            event.preventDefault();
            addFiles(files);
          }}
          onKeyDown={(event) => {
            if (disabledReason) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button className="composer-tool" aria-label="Emoji" disabled={Boolean(disabledReason)} onClick={() => setEmojiPickerOpen((current) => !current)}>
          <AppIcon name={composerIcons.emoji} size="lg" />
        </button>
        <button className="composer-tool text-tool" aria-label="GIF placeholder" disabled={Boolean(disabledReason)}>GIF</button>
        <button className="send-button" disabled={Boolean(disabledReason) || sending || (!body.trim() && !previews.length)} onClick={send}>
          <AppIcon name={composerIcons.send} size="sm" /> {sending ? "Sending..." : "Send"}
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
      {emojiPickerOpen ? (
        <div className="composer-emoji-picker" role="menu" aria-label="Choose emoji">
          {composerEmojiOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                const nextBody = `${body}${emoji}`;
                setBody(nextBody);
                messageDraftService.saveDraft({ communityId, channelId: channel.id }, nextBody);
                setEmojiPickerOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      {dragging ? <div className="drop-hint"><AppIcon name={composerIcons.image} /> Drop images to attach</div> : null}
    </footer>
  );
}
