import type { Attachment } from "../types/community";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { attachmentQuarantineService } from "../services/attachmentQuarantineService";

const overlayIcons = mvpUiIconMap.overlays;
type ImagePreviewModalProps = { image: Attachment; onClose: () => void };

export function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  const access = attachmentQuarantineService.getAccessDecision(image);
  const imageUrl = image.publicUrl || image.url;
  const sourceLabel = image.publicUrl ? "Uploaded image" : "Local preview";
  const metaLabel = image.mimeType ? `${sourceLabel} - ${image.mimeType}` : sourceLabel;

  return <div className="image-preview-backdrop" onMouseDown={onClose}>
    <figure ref={dialogRef} className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="icon-button modal-close" aria-label="Close image preview" onClick={onClose}><AppIcon name={overlayIcons.close} size="lg" /></button>
      {access.canRender ? <img src={imageUrl} alt={image.alt} decoding="async" /> : <div className="attachment-card-blocked" role="status"><strong id="image-preview-title">{access.title}</strong><span>{access.message}</span></div>}
      <figcaption>{access.canRender ? <><strong id="image-preview-title">{image.alt}</strong><span>{metaLabel}</span></> : null}</figcaption>
    </figure>
  </div>;
}
