export interface LocalAttachmentPreview { id: string; name: string; url: string; type: string; size: number; }
export const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const maxSize = 8 * 1024 * 1024;

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex).toLowerCase();
}

export const fileService = {
  validate(file: File) {
    if (!allowedImageMimeTypes.has(file.type)) return { ok: false, reason: "Only PNG, JPEG, WEBP, and GIF images are supported in the MVP." };
    if (!allowedImageExtensions.has(getFileExtension(file.name))) return { ok: false, reason: "Image file extension must be PNG, JPG, JPEG, WEBP, or GIF." };
    if (file.size > maxSize) return { ok: false, reason: "Image is larger than the 8 MB MVP limit." };
    return { ok: true };
  },
  createPreview(file: File): LocalAttachmentPreview {
    return { id: `local-file-${Date.now()}-${file.name}`, name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) };
  },
  revoke(preview: LocalAttachmentPreview) { URL.revokeObjectURL(preview.url); }
};
