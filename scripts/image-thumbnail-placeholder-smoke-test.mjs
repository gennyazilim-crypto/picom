import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  thumbnailService: readFileSync(resolve(root, "src/services/attachmentThumbnailService.ts"), "utf8"),
  uploadService: readFileSync(resolve(root, "src/services/uploadService.ts"), "utf8"),
  attachmentService: readFileSync(resolve(root, "src/services/attachmentService.ts"), "utf8"),
  attachmentGrid: readFileSync(resolve(root, "src/components/AttachmentGrid.tsx"), "utf8"),
  communityTypes: readFileSync(resolve(root, "src/types/community.ts"), "utf8"),
  sharedAttachmentDto: readFileSync(resolve(root, "packages/shared/src/dto/attachment.ts"), "utf8"),
  doc: readFileSync(resolve(root, "docs/image-thumbnail-generation.md"), "utf8"),
};

const checks = [
  [files.thumbnailService.includes("IMAGE_PROCESSOR_NOT_CONFIGURED"), "thumbnail placeholder reason"],
  [files.thumbnailService.includes("generateThumbnailPlaceholder"), "thumbnail generation placeholder API"],
  [files.uploadService.includes("attachmentThumbnailService.createThumbnailPlaceholder"), "upload pipeline uses thumbnail placeholder"],
  [files.attachmentService.includes("thumbnail_url, width, height"), "attachment metadata selects dimensions"],
  [files.attachmentService.includes("blurhashPlaceholder"), "attachment metadata carries blurhash placeholder"],
  [files.attachmentGrid.includes("attachment.thumbnailUrl || attachment.publicUrl || attachment.url"), "AttachmentGrid prefers thumbnail"],
  [files.attachmentGrid.includes("width={attachment.width ?? undefined}"), "AttachmentGrid reserves width"],
  [files.communityTypes.includes("blurhashPlaceholder?: string | null"), "runtime attachment type has blurhash placeholder"],
  [files.sharedAttachmentDto.includes("blurhashPlaceholder?: string | null"), "shared DTO has blurhash placeholder"],
  [files.doc.includes("No `sharp`, ImageMagick, Canvas"), "docs avoid heavy renderer dependency"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Image thumbnail placeholder smoke test failed: ${failed.join(", ")}`);
}

console.log("Image thumbnail generation placeholder smoke test passed.");
