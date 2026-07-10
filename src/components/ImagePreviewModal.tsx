import type { Attachment } from "../types/community";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;
type ImagePreviewModalProps = { image: Attachment; onClose: () => void };

export function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  const imageUrl = image.publicUrl || image.url;
  const sourceLabel = image.publicUrl ? "Uploaded image" : "Local preview";
  const metaLabel = image.mimeType ? `${sourceLabel} - ${image.mimeType}` : sourceLabel;

  return <div className="image-preview-backdrop" onMouseDown={onClose}>
    <figure ref={dialogRef} className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="icon-button modal-close" aria-label="Close image preview" onClick={onClose}><AppIcon name={overlayIcons.close} size="lg" /></button>
      <img src={imageUrl} alt={image.alt} decoding="async" />
      <figcaption><strong id="image-preview-title">{image.alt}</strong><span>{metaLabel}</span></figcaption>
    </figure>
  </div>;
}
