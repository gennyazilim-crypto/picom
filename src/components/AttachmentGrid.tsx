import { useState, type KeyboardEvent } from "react";
import type { Attachment } from "../types/community";
import { attachmentQuarantineService } from "../services/attachmentQuarantineService";
import { resolveNativeImagePreviewUrl } from "../services/attachmentThumbnailService";
import { useTranslation } from "../i18n";
import { attachmentService } from "../services/attachmentService";

type AttachmentGridProps = {
  attachments: Attachment[];
  onOpenImage: (image: Attachment, gallery?: readonly Attachment[]) => void;
};

const MAX_VISIBLE = 4;

export function AttachmentGrid({ attachments, onOpenImage }: AttachmentGridProps) {
  const { t } = useTranslation("feed");
  const { t: errorText } = useTranslation("errors");
  const media = attachments.filter((item) => item.type === "image" || item.type === "video");
  const visibleAttachments = media.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, media.length - MAX_VISIBLE);
  const [brokenIds, setBrokenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [scanOverrides, setScanOverrides] = useState<Readonly<Record<string, Readonly<{ scanStatus: "clean" | "skipped_development"; url: string | null }>>>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!media.length) return null;

  const openAt = (attachment: Attachment) => {
    onOpenImage(attachment, media.filter((item) => item.type === "image"));
  };

  const onKeyActivate = (event: KeyboardEvent<HTMLButtonElement>, attachment: Attachment) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openAt(attachment);
  };

  const retrySafetyCheck = async (attachment: Attachment) => {
    setRetryingId(attachment.id);
    setRetryError(null);
    const checked = await attachmentService.completePendingAttachmentSafetyCheck(attachment.id);
    if (!checked.ok) {
      setRetryError(errorText("attachment.retryFailed"));
      setRetryingId(null);
      return;
    }
    if (checked.data !== "clean" && checked.data !== "skipped_development") {
      setRetryError(errorText("attachment.retryFailed"));
      setRetryingId(null);
      return;
    }
    const safeScanStatus: "clean" | "skipped_development" = checked.data === "clean" ? "clean" : "skipped_development";
    const signed = attachment.storagePath ? await attachmentService.createVerifiedAttachmentUrl(attachment.storagePath) : null;
    setScanOverrides((current) => ({
      ...current,
      [attachment.id]: { scanStatus: safeScanStatus, url: signed?.ok ? signed.data : null },
    }));
    setRetryingId(null);
  };

  return (
    <div
      className={`attachment-grid count-${Math.min(media.length, MAX_VISIBLE)}`}
      role="group"
      aria-label={t("media.count", { count: media.length })}
    >
      {visibleAttachments.map((attachment, index) => {
        const override = scanOverrides[attachment.id];
        const effectiveAttachment = override ? { ...attachment, scanStatus: override.scanStatus, publicUrl: override.url ?? attachment.publicUrl, url: override.url ?? attachment.url } : attachment;
        const access = attachmentQuarantineService.getAccessDecision(effectiveAttachment);
        const previewUrl = resolveNativeImagePreviewUrl({
          thumbnailUrl: effectiveAttachment.thumbnailUrl,
          publicUrl: effectiveAttachment.publicUrl,
          originalUrl: effectiveAttachment.url,
        });
        const isBroken = brokenIds.has(attachment.id) || !previewUrl;
        const isOverflowTile = overflow > 0 && index === visibleAttachments.length - 1;

        if (!access.canRender) {
          return (
            <div key={attachment.id} className="attachment-card attachment-card-blocked" role="status" aria-label={access.message}>
              <strong>{errorText(access.status === "pending" ? "attachment.pendingTitle" : "attachment.blockedTitle")}</strong>
              <span>{errorText(access.status === "pending" ? "attachment.pendingBody" : "attachment.blockedBody")}</span>
              {access.status === "pending" ? <button type="button" disabled={retryingId === attachment.id} onClick={() => void retrySafetyCheck(attachment)}>{retryingId === attachment.id ? errorText("attachment.retrying") : errorText("attachment.retry")}</button> : null}
              {retryError ? <span>{retryError}</span> : null}
            </div>
          );
        }

        if (isBroken) {
          return (
            <div key={attachment.id} className="attachment-card attachment-card-broken" role="status">
              <strong>{t("media.broken")}</strong>
              <span>{t("media.brokenBody")}</span>
            </div>
          );
        }

        if (attachment.type === "video") {
          return (
            <div key={attachment.id} className={`attachment-card attachment-card-video${isOverflowTile ? " attachment-card-overflow" : ""}`}>
              <video
                src={previewUrl}
                controls
                preload="metadata"
                aria-label={attachment.alt}
                onError={() => setBrokenIds((current) => new Set(current).add(attachment.id))}
              />
              {isOverflowTile ? <span className="attachment-card-overflow-label" aria-hidden="true">+{overflow}</span> : null}
            </div>
          );
        }

        return (
          <button
            key={attachment.id}
            type="button"
            className={`attachment-card${isOverflowTile ? " attachment-card-overflow" : ""}`}
            onClick={() => openAt(attachment)}
            onKeyDown={(event) => onKeyActivate(event, attachment)}
            aria-label={isOverflowTile
              ? t("media.openOverflow", { name: attachment.alt, extra: overflow })
              : t("media.open", { name: attachment.alt })}
          >
            <img
              src={previewUrl}
              alt={attachment.alt}
              width={attachment.width ?? undefined}
              height={attachment.height ?? undefined}
              loading="lazy"
              decoding="async"
              onError={() => setBrokenIds((current) => new Set(current).add(attachment.id))}
            />
            {isOverflowTile ? <span className="attachment-card-overflow-label" aria-hidden="true">+{overflow}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
