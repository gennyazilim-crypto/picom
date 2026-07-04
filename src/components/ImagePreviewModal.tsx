import { useEffect } from "react";
import type { Attachment } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;

type ImagePreviewModalProps = {
  image: Attachment;
  onClose: () => void;
};

export function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const imageUrl = image.publicUrl || image.url;
  const sourceLabel = image.publicUrl ? "Uploaded image" : "Local preview";
  const metaLabel = image.mimeType ? `${sourceLabel} • ${image.mimeType}` : sourceLabel;

  return (
    <div className="image-preview-backdrop" onMouseDown={onClose}>
      <figure className="image-preview-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close image preview" onClick={onClose}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        <img src={imageUrl} alt={image.alt} decoding="async" />
        <figcaption>
          <strong>{image.alt}</strong>
          <span>{metaLabel}</span>
        </figcaption>
      </figure>
    </div>
  );
}
