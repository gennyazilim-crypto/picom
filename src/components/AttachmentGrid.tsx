import { useState, type KeyboardEvent } from "react";
import type { Attachment } from "../types/community";
import { attachmentQuarantineService } from "../services/attachmentQuarantineService";
import { resolveNativeImagePreviewUrl } from "../services/attachmentThumbnailService";
import { localizationService } from "../services/localizationService";

type AttachmentGridProps = {
  attachments: Attachment[];
  onOpenImage: (image: Attachment, gallery?: readonly Attachment[]) => void;
};

const MAX_VISIBLE = 4;

export function AttachmentGrid({ attachments, onOpenImage }: AttachmentGridProps) {
  const images = attachments.filter((item) => item.type === "image");
  const visibleAttachments = images.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, images.length - MAX_VISIBLE);
  const [brokenIds, setBrokenIds] = useState<ReadonlySet<string>>(() => new Set());

  if (!images.length) return null;

  const openAt = (attachment: Attachment) => {
    onOpenImage(attachment, images);
  };

  const onKeyActivate = (event: KeyboardEvent<HTMLButtonElement>, attachment: Attachment) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openAt(attachment);
  };

  return (
    <div
      className={`attachment-grid count-${Math.min(images.length, MAX_VISIBLE)}`}
      role="group"
      aria-label={localizationService.translate("feed.media.count", { count: String(images.length) })}
    >
      {visibleAttachments.map((attachment, index) => {
        const access = attachmentQuarantineService.getAccessDecision(attachment);
        const previewUrl = resolveNativeImagePreviewUrl({
          thumbnailUrl: attachment.thumbnailUrl,
          publicUrl: attachment.publicUrl,
          originalUrl: attachment.url,
        });
        const isBroken = brokenIds.has(attachment.id) || !previewUrl;
        const isOverflowTile = overflow > 0 && index === visibleAttachments.length - 1;

        if (!access.canRender) {
          return (
            <div key={attachment.id} className="attachment-card attachment-card-blocked" role="status" aria-label={access.message}>
              <strong>{access.title}</strong>
              <span>{access.message}</span>
            </div>
          );
        }

        if (isBroken) {
          return (
            <div key={attachment.id} className="attachment-card attachment-card-broken" role="status">
              <strong>{localizationService.translate("feed.media.broken")}</strong>
              <span>{localizationService.translate("feed.media.brokenBody")}</span>
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
              ? localizationService.translate("feed.media.openOverflow", { name: attachment.alt, extra: String(overflow) })
              : localizationService.translate("feed.media.open", { name: attachment.alt })}
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
