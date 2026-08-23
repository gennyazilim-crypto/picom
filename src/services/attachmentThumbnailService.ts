/**
 * Feed / message image preview policy (Approach B).
 * No Edge/thumbnail processor is configured in production.
 * Cards use the scanned original (or a real thumbnail_url when Storage provides one).
 * Never invent placeholder thumbnail URLs.
 */

export type AttachmentNativePreview = Readonly<{
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  width: number | null;
  height: number | null;
  blurhashPlaceholder: string | null;
  processor: "NATIVE_ORIGINAL_PREVIEW";
  generated: false;
  reason: "THUMBNAIL_PIPELINE_NOT_CONFIGURED_USE_NATIVE";
}>;

export type AttachmentThumbnailInput = Readonly<{
  storagePath: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
}>;

const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Deterministic sibling path reserved for a future server-side thumbnail worker. Not written today. */
export function createThumbnailStoragePath(storagePath: string): string | null {
  const normalized = storagePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) return null;

  const separatorIndex = normalized.lastIndexOf("/");
  const directory = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "attachments";
  const fileName = normalized.slice(separatorIndex + 1);
  return `${directory}/thumbnails/${fileName}.webp`;
}

export function resolveNativeImagePreviewUrl(input: Readonly<{
  thumbnailUrl?: string | null;
  publicUrl?: string | null;
  originalUrl?: string | null;
}>): string | null {
  const realThumb = typeof input.thumbnailUrl === "string" && input.thumbnailUrl.trim() ? input.thumbnailUrl.trim() : null;
  if (realThumb) return realThumb;
  const original = (typeof input.publicUrl === "string" && input.publicUrl.trim())
    || (typeof input.originalUrl === "string" && input.originalUrl.trim())
    || null;
  return original;
}

export const attachmentThumbnailService = {
  /** Upload finalization: do not fabricate thumbnail URLs. */
  createNativePreviewMetadata(input: AttachmentThumbnailInput): AttachmentNativePreview {
    const thumbnailStoragePath = supportedImageMimeTypes.has(input.mimeType)
      ? createThumbnailStoragePath(input.storagePath)
      : null;

    return {
      thumbnailUrl: null,
      thumbnailStoragePath,
      width: null,
      height: null,
      blurhashPlaceholder: null,
      processor: "NATIVE_ORIGINAL_PREVIEW",
      generated: false,
      reason: "THUMBNAIL_PIPELINE_NOT_CONFIGURED_USE_NATIVE",
    };
  },

  resolvePreviewUrl: resolveNativeImagePreviewUrl,
};

/** @deprecated Use createNativePreviewMetadata — kept name aliases only for call-site migration. */
export type AttachmentThumbnailPlaceholder = AttachmentNativePreview;
