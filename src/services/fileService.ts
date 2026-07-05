export interface LocalAttachmentPreview { id: string; name: string; url: string; type: string; size: number; file: File; }
export const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const maxImageFileSizeBytes = 10 * 1024 * 1024;

export type FileValidationErrorCode = "UNSUPPORTED_MIME_TYPE" | "UNSUPPORTED_EXTENSION" | "FILE_TOO_LARGE";

export type FileValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: FileValidationErrorCode; reason: string }>;
export type NativeImagePickResult =
  | Readonly<{ ok: true; canceled: boolean; files: File[] }>
  | Readonly<{ ok: false; reason: string }>;
export type NativeTextSaveResult =
  | Readonly<{ ok: true; canceled: boolean }>
  | Readonly<{ ok: false; reason: string }>;

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex).toLowerCase();
}

export const fileService = {
  validate(file: File): FileValidationResult {
    if (!allowedImageMimeTypes.has(file.type)) {
      return {
        ok: false,
        code: "UNSUPPORTED_MIME_TYPE",
        reason: "Only PNG, JPEG, WEBP, and GIF images are supported in the MVP.",
      };
    }

    if (!allowedImageExtensions.has(getFileExtension(file.name))) {
      return {
        ok: false,
        code: "UNSUPPORTED_EXTENSION",
        reason: "Image file extension must be PNG, JPG, JPEG, WEBP, or GIF.",
      };
    }

    if (file.size > maxImageFileSizeBytes) {
      return {
        ok: false,
        code: "FILE_TOO_LARGE",
        reason: "Image is larger than the 10 MB MVP limit.",
      };
    }

    return { ok: true };
  },
  createPreview(file: File): LocalAttachmentPreview {
    return { id: `local-file-${Date.now()}-${file.name}`, name: file.name, type: file.type, size: file.size, file, url: URL.createObjectURL(file) };
  },
  revoke(preview: LocalAttachmentPreview) { URL.revokeObjectURL(preview.url); },
  async pickImages(): Promise<NativeImagePickResult> {
    const bridge = window.picomDesktop?.file?.pickImages;
    if (!bridge) return { ok: false, reason: "Native image picker is unavailable in this runtime." };

    const result = await bridge().catch(() => null);
    if (!result?.ok) return { ok: false, reason: "Native image picker failed safely." };

    const files = await Promise.all(
      result.files.map(async (pickedFile) => {
        const response = await fetch(pickedFile.dataUrl);
        const blob = await response.blob();
        return new File([blob], pickedFile.name, { type: pickedFile.type });
      })
    );

    return { ok: true, canceled: result.canceled, files };
  },
  async saveText(defaultPath: string, content: string): Promise<NativeTextSaveResult> {
    const bridge = window.picomDesktop?.file?.saveText;
    if (!bridge) return { ok: false, reason: "Native save dialog is unavailable in this runtime." };

    const result = await bridge({ defaultPath, content }).catch(() => null);
    if (!result?.ok) return { ok: false, reason: "Native save failed safely." };

    return { ok: true, canceled: result.canceled };
  }
};
