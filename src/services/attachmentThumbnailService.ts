export type AttachmentThumbnailPlaceholder = Readonly<{
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  width: number | null;
  height: number | null;
  blurhashPlaceholder: string | null;
  processor: "EDGE_FUNCTION_PLACEHOLDER";
  generated: false;
  reason: "IMAGE_PROCESSOR_NOT_CONFIGURED";
}>;

export type AttachmentThumbnailInput = Readonly<{
  storagePath: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
}>;

const supportedThumbnailMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function createThumbnailStoragePath(storagePath: string): string | null {
  const normalized = storagePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) return null;

  const separatorIndex = normalized.lastIndexOf("/");
  const directory = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "attachments";
  const fileName = normalized.slice(separatorIndex + 1);
  return `${directory}/thumbnails/${fileName}.webp`;
}

export const attachmentThumbnailService = {
  createThumbnailPlaceholder(input: AttachmentThumbnailInput): AttachmentThumbnailPlaceholder {
    const thumbnailStoragePath = supportedThumbnailMimeTypes.has(input.mimeType)
      ? createThumbnailStoragePath(input.storagePath)
      : null;

    return {
      thumbnailUrl: null,
      thumbnailStoragePath,
      width: null,
      height: null,
      blurhashPlaceholder: null,
      processor: "EDGE_FUNCTION_PLACEHOLDER",
      generated: false,
      reason: "IMAGE_PROCESSOR_NOT_CONFIGURED",
    };
  },

  // Future production integration point: generateThumbnailPlaceholder() can be
  // replaced by a trusted Edge Function/worker after storage and private-channel
  // access rules are finalized. Do not add heavy image processing dependencies
  // in the Electron renderer.
  generateThumbnailPlaceholder(input: AttachmentThumbnailInput): AttachmentThumbnailPlaceholder {
    return this.createThumbnailPlaceholder(input);
  },
};
