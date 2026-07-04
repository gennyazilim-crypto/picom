import { useEffect, useRef, useState } from "react";
import type { Attachment, Channel } from "../types/community";
import { attachmentService } from "../services/attachmentService";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { loggingService } from "../services/loggingService";
import { uploadService } from "../services/uploadService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

type ToastTone = "info" | "error" | "success";
const composerIcons = mvpUiIconMap.messageComposer;

type MessageComposerProps = {
  communityId: string;
  channel: Channel;
  onSendMessage: (body: string, attachments?: Attachment[]) => void | Promise<void>;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function MessageComposer({ communityId, channel, onSendMessage, pushToast }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<LocalAttachmentPreview[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<LocalAttachmentPreview[]>([]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => () => {
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
  }, []);

  const addFiles = (files: FileList | File[]) => {
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

    await onSendMessage(value || `Shared ${attachments.length} image attachment${attachments.length > 1 ? "s" : ""}.`, attachments);
    setBody("");
    setPreviews([]);
    setSending(false);
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
        <button className="composer-tool" aria-label="Attach image" onClick={() => fileInputRef.current?.click()}>
          <AppIcon name={composerIcons.attach} size="lg" />
        </button>
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
        <button className="send-button" disabled={sending || (!body.trim() && !previews.length)} onClick={send}>
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
      {dragging ? <div className="drop-hint"><AppIcon name={composerIcons.image} /> Drop images to attach</div> : null}
    </footer>
  );
}
