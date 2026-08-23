import { useCallback, useEffect, useMemo, useState } from "react";
import type { Attachment } from "../types/community";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { mvpUiIconMap } from "./iconRegistry";
import { attachmentQuarantineService } from "../services/attachmentQuarantineService";
import { useTranslation } from "../i18n";

const overlayIcons = mvpUiIconMap.overlays;
type ImagePreviewModalProps = {
  image: Attachment;
  gallery?: readonly Attachment[];
  onClose: () => void;
  onNavigate?: (image: Attachment) => void;
};
type ContextMenuState = { x: number; y: number };

function fileNameFromAttachment(image: Attachment, imageUrl: string): string {
  const altName = image.alt?.trim();
  if (altName && /\.[a-z0-9]{2,5}$/i.test(altName)) return altName;
  try {
    const path = new URL(imageUrl, window.location.origin).pathname;
    const fromPath = path.split("/").pop();
    if (fromPath && fromPath.includes(".")) return decodeURIComponent(fromPath.split("?")[0] ?? fromPath);
  } catch {
    /* ignore invalid URL */
  }
  const extension = image.mimeType?.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return altName ? `${altName}.${extension}` : `image.${extension}`;
}

async function downloadImageUrl(imageUrl: string, fileName: string): Promise<void> {
  const trigger = (href: string, revoke?: () => void) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    revoke?.();
  };

  try {
    const response = await fetch(imageUrl, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    trigger(objectUrl, () => URL.revokeObjectURL(objectUrl));
  } catch {
    trigger(imageUrl);
  }
}

export function ImagePreviewModal({ image, gallery = [image], onClose, onNavigate }: ImagePreviewModalProps) {
  const { t } = useTranslation("feed");
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  const items = useMemo(() => (gallery.length ? gallery : [image]), [gallery, image]);
  const [activeId, setActiveId] = useState(image.id);
  const active = items.find((item) => item.id === activeId) ?? image;
  const access = attachmentQuarantineService.getAccessDecision(active);
  const imageUrl = active.publicUrl || active.url;
  const fileName = fileNameFromAttachment(active, imageUrl);
  const [downloading, setDownloading] = useState(false);
  const [broken, setBroken] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const index = Math.max(0, items.findIndex((item) => item.id === active.id));
  const hasNav = items.length > 1;

  useEffect(() => {
    setActiveId(image.id);
    setBroken(false);
  }, [image.id]);

  const go = useCallback((direction: -1 | 1) => {
    if (!hasNav) return;
    const next = items[(index + direction + items.length) % items.length];
    if (!next) return;
    setActiveId(next.id);
    setBroken(false);
    onNavigate?.(next);
  }, [hasNav, index, items, onNavigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const handleDownload = useCallback(async () => {
    if (!access.canRender || !imageUrl || downloading || broken) return;
    setDownloading(true);
    try {
      await downloadImageUrl(imageUrl, fileName);
    } finally {
      setDownloading(false);
    }
  }, [access.canRender, broken, downloading, fileName, imageUrl]);

  return (
    <div className="image-preview-backdrop" onMouseDown={onClose}>
      <figure
        ref={dialogRef}
        className="image-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("media.viewerLabel")}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-button modal-close" aria-label={t("media.close")} onClick={onClose}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        {hasNav ? (
          <>
            <button type="button" className="image-preview-nav previous" aria-label={t("media.previous")} onClick={() => go(-1)}>
              <AppIcon name="chevronRight" size="md" />
            </button>
            <button type="button" className="image-preview-nav next" aria-label={t("media.next")} onClick={() => go(1)}>
              <AppIcon name="chevronRight" size="md" />
            </button>
          </>
        ) : null}
        {access.canRender && !broken ? (
          <img
            src={imageUrl}
            alt={active.alt}
            decoding="async"
            onError={() => setBroken(true)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ x: event.clientX, y: event.clientY });
            }}
          />
        ) : (
          <div className="attachment-card-blocked" role="status">
            <strong>{broken ? t("media.broken") : access.title}</strong>
            <span>{broken ? t("media.brokenBody") : access.message}</span>
          </div>
        )}
        <figcaption>
          {hasNav ? <span className="image-preview-count">{index + 1} / {items.length}</span> : null}
          {access.canRender && !broken ? (
            <button
              type="button"
              className="image-preview-download"
              onClick={() => void handleDownload()}
              disabled={downloading}
              aria-busy={downloading}
            >
              <AppIcon name="image" size="sm" />
              {downloading ? t("media.downloading") : t("media.download")}
            </button>
          ) : null}
        </figcaption>
      </figure>
      {menu && access.canRender && !broken ? (
        <DesktopContextMenu
          x={menu.x}
          y={menu.y}
          ariaLabel="Image actions"
          items={[
            {
              label: downloading ? t("media.downloading") : t("media.download"),
              icon: "image",
              disabled: downloading,
              onSelect: () => { void handleDownload(); },
            },
          ]}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
