export interface LocalAttachmentPreview { id: string; name: string; url: string; type: string; size: number; file: File; }
export const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const maxImageFileSizeBytes = 10 * 1024 * 1024;
export const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm"]);
export const allowedVideoExtensions = new Set([".mp4", ".webm"]);
export const maxVideoFileSizeBytes = 50 * 1024 * 1024;
export const allowedMessageAttachmentMimeTypes = new Set([...allowedImageMimeTypes, ...allowedVideoMimeTypes]);

export type FileValidationErrorCode = "UNSUPPORTED_MIME_TYPE" | "UNSUPPORTED_EXTENSION" | "FILE_TOO_LARGE" | "INVALID_FILE_SIGNATURE";

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

function matchesImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function matchesVideoSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "video/mp4") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  if (mimeType === "video/webm") return bytes.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((value, index) => bytes[index] === value);
  return false;
}

export const fileService = {
  validate(file: File): FileValidationResult {
    if (!allowedMessageAttachmentMimeTypes.has(file.type)) {
      return {
        ok: false,
        code: "UNSUPPORTED_MIME_TYPE",
        reason: "Only PNG, JPEG, WEBP, GIF, MP4, and WebM files are supported.",
      };
    }

    const isImage = allowedImageMimeTypes.has(file.type);
    const allowedExtensions = isImage ? allowedImageExtensions : allowedVideoExtensions;
    if (!allowedExtensions.has(getFileExtension(file.name))) {
      return {
        ok: false,
        code: "UNSUPPORTED_EXTENSION",
        reason: isImage ? "Image file extension must be PNG, JPG, JPEG, WEBP, or GIF." : "Video file extension must be MP4 or WebM.",
      };
    }

    const maximumBytes = isImage ? maxImageFileSizeBytes : maxVideoFileSizeBytes;
    if (file.size > maximumBytes) {
      return {
        ok: false,
        code: "FILE_TOO_LARGE",
        reason: isImage ? "Image is larger than the 10 MB limit." : "Video is larger than the 50 MB limit.",
      };
    }

    return { ok: true };
  },
  async validateContent(file: File): Promise<FileValidationResult> {
    try {
      const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
      const valid = allowedImageMimeTypes.has(file.type) ? matchesImageSignature(bytes, file.type) : matchesVideoSignature(bytes, file.type);
      if (!valid) {
        return {
          ok: false,
          code: "INVALID_FILE_SIGNATURE",
          reason: "The file contents do not match the selected media type.",
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        code: "INVALID_FILE_SIGNATURE",
      reason: "Picom could not verify this media file safely.",
      };
    }
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
      const separatorIndex = pickedFile.dataUrl.indexOf(",");
      if (separatorIndex < 0) {
        throw new Error("The selected image could not be read.");
      }

      const metadata = pickedFile.dataUrl.slice(0, separatorIndex);
      const encoded = pickedFile.dataUrl.slice(separatorIndex + 1);
      const mimeMatch = /^data:([^;,]+)(?:;[^,]*)?;base64$/i.exec(metadata);
      const mimeType = mimeMatch?.[1] ?? pickedFile.type;

      if (!encoded || !mimeType) {
        throw new Error("The selected image is empty or has an unsupported format.");
      }

      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      if (bytes.byteLength === 0) {
        throw new Error("The selected image is empty.");
      }

      return new File([bytes], pickedFile.name, {
        type: mimeType,
        lastModified: Date.now(),
      });
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
