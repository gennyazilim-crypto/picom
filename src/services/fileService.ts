export interface LocalAttachmentPreview { id: string; name: string; url: string; type: string; size: number; }
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxSize = 8 * 1024 * 1024;
export const fileService = {
  validate(file: File) {
    if (!allowedTypes.has(file.type)) return { ok: false, reason: "Only PNG, JPEG, WEBP, and GIF images are supported in the MVP." };
    if (file.size > maxSize) return { ok: false, reason: "Image is larger than the 8 MB MVP limit." };
    return { ok: true };
  },
  createPreview(file: File): LocalAttachmentPreview {
    return { id: `local-file-${Date.now()}-${file.name}`, name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) };
  },
  revoke(preview: LocalAttachmentPreview) { URL.revokeObjectURL(preview.url); }
};