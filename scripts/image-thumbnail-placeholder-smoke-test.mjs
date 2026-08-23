import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  thumbnailService: readFileSync(resolve(root, "src/services/attachmentThumbnailService.ts"), "utf8"),
  uploadService: readFileSync(resolve(root, "src/services/uploadService.ts"), "utf8"),
  attachmentService: readFileSync(resolve(root, "src/services/attachmentService.ts"), "utf8"),
  attachmentGrid: readFileSync(resolve(root, "src/components/AttachmentGrid.tsx"), "utf8"),
  imagePreview: readFileSync(resolve(root, "src/components/ImagePreviewModal.tsx"), "utf8"),
  communityTypes: readFileSync(resolve(root, "src/types/community.ts"), "utf8"),
  feedAttachment: readFileSync(resolve(root, "src/services/feed/feedAttachmentModel.ts"), "utf8"),
  doc: readFileSync(resolve(root, "docs/image-thumbnail-generation.md"), "utf8"),
};

const checks = [
  [files.thumbnailService.includes("NATIVE_ORIGINAL_PREVIEW"), "native preview processor"],
  [files.thumbnailService.includes("THUMBNAIL_PIPELINE_NOT_CONFIGURED_USE_NATIVE"), "native preview reason"],
  [!files.thumbnailService.includes("EDGE_FUNCTION_PLACEHOLDER"), "no edge placeholder processor"],
  [files.uploadService.includes("attachmentThumbnailService.createNativePreviewMetadata"), "upload uses native preview metadata"],
  [files.attachmentService.includes("thumbnail_url, width, height"), "attachment metadata selects dimensions"],
  [files.attachmentGrid.includes("resolveNativeImagePreviewUrl"), "AttachmentGrid uses native preview resolver"],
  [files.attachmentGrid.includes("width={attachment.width ?? undefined}"), "AttachmentGrid reserves width"],
  [files.imagePreview.includes("image.publicUrl || image.url") || files.imagePreview.includes("active.publicUrl || active.url"), "preview uses full image"],
  [files.imagePreview.includes("attachmentQuarantineService.getAccessDecision"), "preview rechecks quarantine"],
  [files.feedAttachment.includes("thumbnailUrl"), "Feed attachment model has thumbnailUrl"],
  [files.doc.includes("Approach B") || files.doc.includes("native"), "docs describe native preview approach"],
  [files.doc.includes("No `sharp`, ImageMagick, Canvas"), "docs avoid heavy renderer dependency"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Image thumbnail native-preview smoke test failed: ${failed.join(", ")}`);
}

const compiled = ts.transpileModule(files.thumbnailService, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const thumbnailModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
if (thumbnailModule.createThumbnailStoragePath("communities/c1/channels/ch1/pending/u1/image.png") !== "communities/c1/channels/ch1/pending/u1/thumbnails/image.png.webp") {
  throw new Error("deterministic sibling object path failed");
}
if (thumbnailModule.createThumbnailStoragePath("../private/image.png") !== null) {
  throw new Error("traversal-safe object path failed");
}
const preview = thumbnailModule.attachmentThumbnailService.createNativePreviewMetadata({
  storagePath: "communities/c1/channels/ch1/pending/u1/image.png",
  publicUrl: null,
  mimeType: "image/jpeg",
  sizeBytes: 1024,
});
if (preview.thumbnailUrl !== null || preview.generated !== false) {
  throw new Error("native preview must not invent thumbnail URLs");
}
if (thumbnailModule.resolveNativeImagePreviewUrl({ thumbnailUrl: null, publicUrl: "https://x/a.jpg" }) !== "https://x/a.jpg") {
  throw new Error("native preview must fall back to original URL");
}

console.log("Image thumbnail native-preview smoke test passed.");
