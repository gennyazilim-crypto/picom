export const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const maxImageFileSizeBytes = 10 * 1024 * 1024;

export type FileValidationResult =
  | { ok: true; sanitizedFileName: string }
  | { ok: false; code: "UNSUPPORTED_MIME_TYPE" | "UNSUPPORTED_EXTENSION" | "FILE_TOO_LARGE" | "VALIDATION_ERROR"; message: string };

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 96);

  return cleaned || "attachment";
}

export function validateImageMetadata(fileName: unknown, mimeType: unknown, sizeBytes: unknown): FileValidationResult {
  if (typeof fileName !== "string" || typeof mimeType !== "string" || typeof sizeBytes !== "number") {
    return { ok: false, code: "VALIDATION_ERROR", message: "fileName, mimeType, and sizeBytes are required." };
  }

  if (!allowedImageMimeTypes.has(mimeType)) {
    return { ok: false, code: "UNSUPPORTED_MIME_TYPE", message: "Only PNG, JPEG, WEBP, and GIF images are supported in the MVP." };
  }

  if (!allowedImageExtensions.has(getExtension(fileName))) {
    return { ok: false, code: "UNSUPPORTED_EXTENSION", message: "Image file extension must be PNG, JPG, JPEG, WEBP, or GIF." };
  }

  if (sizeBytes <= 0 || sizeBytes > maxImageFileSizeBytes) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "Image is larger than the 10 MB MVP limit." };
  }

  return { ok: true, sanitizedFileName: sanitizeFileName(fileName) };
}
