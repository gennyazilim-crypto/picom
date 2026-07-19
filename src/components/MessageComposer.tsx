import { useEffect, useRef, useState } from "react";
import type { Attachment, Channel, Member, Message } from "../types/community";
import { attachmentService } from "../services/attachmentService";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { loggingService } from "../services/loggingService";
import { messageDraftService } from "../services/messageDraftService";
import { uploadService } from "../services/uploadService";
import { AppIcon } from "./AppIcon";
import { EmojiPicker } from "./EmojiPicker";
import { mvpUiIconMap } from "./iconRegistry";
import { slashCommandService, type SlashCommand } from "../services/slashCommandService";
import { SlashCommandPopover } from "./SlashCommandPopover";
import type { CreatePollDraft } from "../types/polls";
import { analyticsService } from "../services/analyticsService";

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
  onSendMessage: (body: string, attachments?: Attachment[], replyToMessageId?: string | null, poll?: CreatePollDraft) => void | Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  disabledReason?: string;
  disabledActionLabel?: string;
  onDisabledAction?: () => void;
  canInvite?: boolean;
  canEditTopic?: boolean;
  canCreatePoll?: boolean;
  onOpenInvite?: () => void;
  onOpenTopic?: () => void;
  onOpenPoll?: () => void;
};

type ComposerUploadStatus = "pending" | "uploading" | "uploaded" | "failed" | "canceled";

type ComposerAttachmentItem = LocalAttachmentPreview & {
  status: ComposerUploadStatus;
  progress: number;
  error?: string;
  attachment?: Attachment;
};

function getUploadStatusLabel(status: ComposerUploadStatus): string {
  if (status === "pending") return "Ready";
  if (status === "uploading") return "Uploading";
  if (status === "uploaded") return "Uploaded";
  if (status === "failed") return "Failed";
  return "Canceled";
}

function createComposerAttachmentItem(preview: LocalAttachmentPreview): ComposerAttachmentItem {
  return { ...preview, status: "pending", progress: 0 };
}

export function MessageComposer({ communityId, channel, replyToMessage, replyToMember, onCancelReply, onSendMessage, onTypingStart, onTypingStop, pushToast, disabledReason, disabledActionLabel, onDisabledAction, canInvite = false, canEditTopic = false, canCreatePoll = false, onOpenInvite, onOpenTopic, onOpenPoll }: MessageComposerProps) {
  const [body, setBody] = useState(() => messageDraftService.getDraft({ communityId, channelId: channel.id })?.text ?? "");
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<ComposerAttachmentItem[]>([]);
  const [sending, setSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<ComposerAttachmentItem[]>([]);
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef<number | null>(null);
  const onTypingStopRef = useRef(onTypingStop);
  const previousChannelIdRef = useRef(channel.id);
  const previousCommunityIdRef = useRef(communityId);
  const slashPermissionContext = { invite: canInvite, topic: canEditTopic, poll: canCreatePoll } as const;
  const slashSuggestions = slashDismissed ? [] : slashCommandService.getSuggestions(body, slashPermissionContext);

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
    uploadControllersRef.current.forEach((controller) => controller.abort());
    uploadControllersRef.current.clear();
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    stopTypingNow();
  }, []);

  useEffect(() => {
    if (previousChannelIdRef.current === channel.id && previousCommunityIdRef.current === communityId) return;

    previousChannelIdRef.current = channel.id;
    previousCommunityIdRef.current = communityId;
    stopTypingNow();
    uploadControllersRef.current.forEach((controller) => controller.abort());
    uploadControllersRef.current.clear();
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    previewsRef.current = [];
    setPreviews([]);
    setEmojiPickerOpen(false);
    setSlashDismissed(false);
    setSlashSelectedIndex(0);
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

    const next: ComposerAttachmentItem[] = [];

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

      next.push(createComposerAttachmentItem(fileService.createPreview(file)));
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
    uploadControllersRef.current.get(preview.id)?.abort();
    uploadControllersRef.current.delete(preview.id);
    fileService.revoke(preview);
    setPreviews((current) => current.filter((item) => item.id !== preview.id));
  };

  const updatePreview = (id: string, patch: Partial<ComposerAttachmentItem>) => {
    setPreviews((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const cancelPreviewUpload = (preview: ComposerAttachmentItem) => {
    uploadControllersRef.current.get(preview.id)?.abort();
    uploadControllersRef.current.delete(preview.id);
    updatePreview(preview.id, { status: "canceled", progress: 0, error: "Upload canceled." });
  };

  const uploadPreview = async (previewId: string, forceRetry = false): Promise<Attachment | null> => {
    const preview = previewsRef.current.find((item) => item.id === previewId);
    if (!preview) return null;
    if (preview.status === "uploaded" && preview.attachment) return preview.attachment;
    if (!forceRetry && (preview.status === "failed" || preview.status === "canceled")) {
      pushToast("Retry or remove failed uploads before sending.", "error");
      return null;
    }

    const controller = new AbortController();
    uploadControllersRef.current.set(preview.id, controller);
    updatePreview(preview.id, { status: "uploading", progress: 12, error: undefined, attachment: undefined });

    const progressTimer = globalThis.setInterval(() => {
      setPreviews((current) => current.map((item) => {
        if (item.id !== preview.id || item.status !== "uploading") return item;
        return { ...item, progress: Math.min(92, item.progress + 18) };
      }));
    }, 140);

    const result = await uploadService.uploadImageAttachment({
      communityId,
      channelId: channel.id,
      file: preview.file,
      signal: controller.signal,
    });

    globalThis.clearInterval(progressTimer);
    uploadControllersRef.current.delete(preview.id);

    if (!result.ok) {
      const status = result.error.code === "UPLOAD_CANCELED" ? "canceled" : "failed";
      updatePreview(preview.id, { status, progress: 0, error: result.error.message });
      return null;
    }

    if (controller.signal.aborted) {
      updatePreview(preview.id, { status: "canceled", progress: 0, error: "Upload canceled." });
      return null;
    }

    const metadata = await attachmentService.createPendingAttachmentMetadata({ upload: result.data });
    if (!metadata.ok) {
      updatePreview(preview.id, { status: "failed", progress: 0, error: metadata.error.message });
      return null;
    }

    const uploadedUrl = metadata.data.publicUrl ?? result.data.publicUrl ?? null;
    const attachment: Attachment = {
      id: metadata.data.id,
      type: "image",
      url: uploadedUrl || preview.url,
      publicUrl: uploadedUrl,
      storagePath: metadata.data.storagePath,
      mimeType: metadata.data.mimeType,
      thumbnailUrl: metadata.data.thumbnailUrl,
      width: metadata.data.width ?? undefined,
      height: metadata.data.height ?? undefined,
      blurhashPlaceholder: metadata.data.blurhashPlaceholder,
      scanStatus: metadata.data.scanStatus,
      alt: metadata.data.fileName,
    };

    updatePreview(preview.id, { status: "uploaded", progress: 100, attachment, error: undefined });
    analyticsService.trackEvent("upload_success", { kind: "image", sizeBucket: preview.size < 1024 * 1024 ? "under_1mb" : "1mb_plus" });
    return attachment;
  };

  const retryPreviewUpload = async (preview: ComposerAttachmentItem) => {
    if (preview.status === "uploading") return;
    updatePreview(preview.id, { status: "pending", progress: 0, error: undefined, attachment: undefined });
    const attachment = await uploadPreview(preview.id, true);
    if (attachment) pushToast(`${preview.name} uploaded.`, "success");
  };

  const send = async () => {
    if (disabledReason) {
      pushToast(disabledReason, "info");
      return;
    }

    const value = slashCommandService.transformBeforeSend(body.trim());
    if ((!value && !previews.length) || sending) return;

    setSending(true);
    const attachments: Attachment[] = [];

    for (const preview of previewsRef.current) {
      const attachment = await uploadPreview(preview.id);
      if (!attachment) {
        setSending(false);
        return;
      }

      attachments.push(attachment);
    }

    await onSendMessage(value || `Shared ${attachments.length} image attachment${attachments.length > 1 ? "s" : ""}.`, attachments, replyToMessage?.id ?? null);
    messageDraftService.clearDraft({ communityId, channelId: channel.id });
    stopTypingNow();
    onCancelReply();
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    setBody("");
    setPreviews([]);
    setEmojiPickerOpen(false);
    setSending(false);
  };

  const applySlashCommand = (command: SlashCommand) => {
    if (!slashCommandService.canUseCommand(command, slashPermissionContext)) { pushToast("You do not have permission to use this command.", "error"); setSlashDismissed(true); return; }
    if (command.name === "help") { pushToast("Built-ins: /help /invite /me /shrug /tableflip /topic /poll", "info"); setBody(""); }
    else if (command.name === "invite") { if (canInvite && onOpenInvite) onOpenInvite(); else pushToast("You do not have permission to create invites.", "error"); setBody(""); }
    else if (command.name === "topic") { if (canEditTopic && onOpenTopic) onOpenTopic(); else pushToast("You do not have permission to edit this channel topic.", "error"); setBody(""); }
    else if (command.name === "poll") { if (canCreatePoll && onOpenPoll) onOpenPoll(); else pushToast("Poll creation is not available in this channel.", "info"); setBody(""); }
    else { const text = slashCommandService.applyTextCommand(command.name); if (text !== null) setBody(text); }
    setSlashDismissed(true); setSlashSelectedIndex(0); messageDraftService.saveDraft({ communityId, channelId: channel.id }, command.name === "me" ? "/me " : slashCommandService.applyTextCommand(command.name) ?? "");
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
      {disabledReason ? (
        <div className="composer-permission-hint" role="status">
          <span>{disabledReason}</span>
          {disabledActionLabel && onDisabledAction ? <button type="button" onClick={onDisabledAction}>{disabledActionLabel}</button> : null}
        </div>
      ) : null}
      {previews.length ? (
        <div className="composer-previews">
          {previews.map((preview) => (
            <div key={preview.id} className={`composer-preview-item status-${preview.status}`}>
              <img src={preview.url} alt={preview.name} />
              <span className="composer-preview-progress" aria-hidden="true"><span style={{ width: `${preview.progress}%` }} /></span>
              <span className="composer-preview-status">{preview.error ?? getUploadStatusLabel(preview.status)}</span>
              {preview.status === "uploading" ? (
                <button aria-label={`Cancel upload for ${preview.name}`} onClick={() => cancelPreviewUpload(preview)}><AppIcon name={composerIcons.close} size="xs" /></button>
              ) : preview.status === "failed" || preview.status === "canceled" ? (
                <>
                  <button className="composer-preview-retry-button" aria-label={`Retry upload for ${preview.name}`} onClick={() => void retryPreviewUpload(preview)}>Retry</button>
                  <button className="composer-preview-remove-button" aria-label={`Remove failed upload ${preview.name}`} onClick={() => removePreview(preview)}><AppIcon name="trash" size="xs" /></button>
                </>
              ) : (
                <button aria-label={`Remove ${preview.name}`} onClick={() => removePreview(preview)}><AppIcon name={composerIcons.close} size="xs" /></button>
              )}
            </div>
          ))}
        </div>
      ) : null}
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
        <div className="composer-leading">
          <button className="composer-tool" aria-label="Attach image" disabled={Boolean(disabledReason)} onClick={() => fileInputRef.current?.click()}>
            <AppIcon name={composerIcons.attach} size="md" />
          </button>
        </div>
        <div className="composer-input-wrap">
          <textarea
            value={body}
            placeholder={disabledReason ?? `Message #${channel.name}`}
            rows={1}
            disabled={Boolean(disabledReason)}
            onChange={(event) => {
              const nextBody = event.target.value;
              setBody(nextBody);
              setSlashDismissed(false);
              setSlashSelectedIndex(0);
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
              if (slashSuggestions.length && event.key === "ArrowDown") { event.preventDefault(); setSlashSelectedIndex((index) => (index + 1) % slashSuggestions.length); return; }
              if (slashSuggestions.length && event.key === "ArrowUp") { event.preventDefault(); setSlashSelectedIndex((index) => (index - 1 + slashSuggestions.length) % slashSuggestions.length); return; }
              if (slashSuggestions.length && event.key === "Escape") { event.preventDefault(); setSlashDismissed(true); return; }
              if (slashSuggestions.length && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); applySlashCommand(slashSuggestions[Math.min(slashSelectedIndex, slashSuggestions.length - 1)]); return; }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
        </div>
        <div className="composer-actions">
          <div className="composer-secondary-actions" aria-label="Composer tools">
            <button className="composer-tool" aria-label="Emoji" disabled={Boolean(disabledReason)} onClick={() => setEmojiPickerOpen((current) => !current)}>
              <AppIcon name={composerIcons.emoji} size="md" />
            </button>
            <button className="composer-tool composer-chip" type="button" aria-label="GIF placeholder" disabled={Boolean(disabledReason)}>GIF</button>
          </div>
          <button
            className="send-button"
            type="button"
            disabled={Boolean(disabledReason) || sending || previews.some((preview) => preview.status === "uploading") || (!body.trim() && !previews.length)}
            onClick={send}
          >
            <AppIcon name={composerIcons.send} size="sm" />
            <span>{sending ? "Sending..." : "Send"}</span>
          </button>
        </div>
      </div>
      <SlashCommandPopover commands={slashSuggestions} selectedIndex={Math.min(slashSelectedIndex, Math.max(0, slashSuggestions.length - 1))} onSelect={applySlashCommand} />
      {emojiPickerOpen ? (
        <EmojiPicker
          className="composer-emoji-picker"
          label="Choose emoji for message"
          mode="composer"
          onClose={() => setEmojiPickerOpen(false)}
          onSelect={(emoji) => {
            const nextBody = `${body}${emoji}`;
            setBody(nextBody);
            messageDraftService.saveDraft({ communityId, channelId: channel.id }, nextBody);
            setEmojiPickerOpen(false);
          }}
          communityId={communityId}
        />
      ) : null}
      {dragging ? <div className="drop-hint"><AppIcon name={composerIcons.image} /> Drop images to attach</div> : null}
    </footer>
  );
}
