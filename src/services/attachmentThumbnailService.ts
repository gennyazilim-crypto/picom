export type AttachmentThumbnailPlaceholder = Readonly<{
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  width: number | null;
  height: number | null;
  blurhashPlaceholder: string | null;
  generated: false;
  reason: "IMAGE_PROCESSOR_NOT_CONFIGURED";
}>;

export type AttachmentThumbnailInput = Readonly<{
  storagePath: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
}>;

export const attachmentThumbnailService = {
  createThumbnailPlaceholder(input: AttachmentThumbnailInput): AttachmentThumbnailPlaceholder {
    const normalizedPath = input.storagePath.trim();

    return {
      thumbnailUrl: null,
      thumbnailStoragePath: normalizedPath ? `${normalizedPath}.thumbnail-placeholder` : null,
      width: null,
      height: null,
      blurhashPlaceholder: null,
      generated: false,
      reason: "IMAGE_PROCESSOR_NOT_CONFIGURED",
    };
  },

  // Future production integration point: generateThumbnailPlaceholder() can be
  // replaced by Sharp/ImageMagick/Edge Function processing after storage and
  // private-channel access rules are finalized. Do not add heavy image
  // processing dependencies in the renderer.
  generateThumbnailPlaceholder(input: AttachmentThumbnailInput): AttachmentThumbnailPlaceholder {
    return this.createThumbnailPlaceholder(input);
  },
};
