import { directAttachmentTypeFromMime, type DirectMessageAttachment } from "../../types/directMessages";
import { fileService, type FileValidationResult } from "../fileService";
import { sanitizeUploadFileName } from "../uploadService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

export const DIRECT_MESSAGE_ATTACHMENTS_BUCKET = "direct-message-attachments" as const;
export const DIRECT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type DirectAttachmentUploadProgress = Readonly<{ percent: number; stage: "validating" | "uploading" | "finalizing" }>;
export type DirectAttachmentUploadErrorCode = "VALIDATION_ERROR" | "AUTH_REQUIRED" | "NOT_CONFIGURED" | "UPLOAD_CANCELED" | "UPLOAD_FAILED";
export type DirectAttachmentUploadResult = Readonly<{ ok: true; data: DirectMessageAttachment }> | Readonly<{ ok: false; error: Readonly<{ code: DirectAttachmentUploadErrorCode; message: string }> }>;
export type DirectAttachmentUploadInput = Readonly<{ conversationId: string; file: File; previewUrl: string; signal?: AbortSignal; onProgress?: (progress: DirectAttachmentUploadProgress) => void }>;

const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedVideoExtensions = new Set([".mp4", ".webm", ".mov"]);
const allowedAudioMimeTypes = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"]);
const allowedAudioExtensions = new Set([".webm", ".ogg", ".mp3", ".m4a"]);
const maxVideoFileSizeBytes = 25 * 1024 * 1024;
const maxAudioFileSizeBytes = 15 * 1024 * 1024;

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function validateDirectAttachment(file: File): FileValidationResult {
  if (file.type.startsWith("audio/")) {
    if (!allowedAudioMimeTypes.has(file.type)) return { ok: false, code: "UNSUPPORTED_MIME_TYPE", reason: "Only WebM, OGG, MP3, and M4A audio files are supported." };
    if (!allowedAudioExtensions.has(extension(file.name))) return { ok: false, code: "UNSUPPORTED_EXTENSION", reason: "Audio file extension must be WebM, OGG, MP3, or M4A." };
    if (file.size > maxAudioFileSizeBytes) return { ok: false, code: "FILE_TOO_LARGE", reason: "Audio is larger than the 15 MB limit." };
    return { ok: true };
  }
  if (!file.type.startsWith("video/")) return fileService.validate(file);
  if (!allowedVideoMimeTypes.has(file.type)) return { ok: false, code: "UNSUPPORTED_MIME_TYPE", reason: "Only MP4, WebM, and MOV videos are supported." };
  if (!allowedVideoExtensions.has(extension(file.name))) return { ok: false, code: "UNSUPPORTED_EXTENSION", reason: "Video file extension must be MP4, WebM, or MOV." };
  if (file.size > maxVideoFileSizeBytes) return { ok: false, code: "FILE_TOO_LARGE", reason: "Video is larger than the 25 MB limit." };
  return { ok: true };
}

async function validateDirectAttachmentContent(file: File): Promise<FileValidationResult> {
  if (file.type.startsWith("audio/")) {
    try {
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const webm = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      const ogg = bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "OggS";
      const mp3 = (bytes.length >= 3 && String.fromCharCode(...bytes.slice(0, 3)) === "ID3")
        || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      const isoMedia = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
      if ((file.type === "audio/webm" && webm)
        || (file.type === "audio/ogg" && ogg)
        || (file.type === "audio/mpeg" && mp3)
        || (file.type === "audio/mp4" && isoMedia)) return { ok: true };
      return { ok: false, code: "INVALID_FILE_SIGNATURE", reason: "The file contents do not match the selected audio type." };
    } catch {
      return { ok: false, code: "INVALID_FILE_SIGNATURE", reason: "Picom could not verify this audio safely." };
    }
  }
  if (!file.type.startsWith("video/")) return fileService.validateContent(file);
  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isoMedia = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
    const webm = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    if ((file.type === "video/webm" && webm) || (file.type !== "video/webm" && isoMedia)) return { ok: true };
    return { ok: false, code: "INVALID_FILE_SIGNATURE", reason: "The file contents do not match the selected video type." };
  } catch {
    return { ok: false, code: "INVALID_FILE_SIGNATURE", reason: "Picom could not verify this video safely." };
  }
}

function failure(code: DirectAttachmentUploadErrorCode, message: string): DirectAttachmentUploadResult { return { ok: false, error: { code, message } }; }
function uuid(): string { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

/** True only for browser-loadable URLs — never for opaque storage object paths. */
export function isRenderableDirectAttachmentUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^(https?:|blob:|data:)/i.test(value));
}

/** Prefer storage_path; otherwise treat non-http `url` as the private object path. */
export function resolveDirectAttachmentStoragePath(url: string | null | undefined, storagePath: string | null | undefined): string | undefined {
  const path = storagePath?.trim();
  if (path) return path;
  const locator = url?.trim();
  if (locator && !isRenderableDirectAttachmentUrl(locator)) return locator;
  return undefined;
}

/**
 * Batch-sign private DM attachment paths to real HTTPS URLs.
 * Never returns a storage path as a display URL.
 */
export async function signDirectAttachmentPaths(paths: readonly string[], ttlSeconds = DIRECT_ATTACHMENT_SIGNED_URL_TTL_SECONDS): Promise<Map<string, string>> {
  const unique = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  const signedByPath = new Map<string, string>();
  if (!unique.length) return signedByPath;
  const client = getSupabaseClient();
  if (!client) return signedByPath;

  const batch = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).createSignedUrls(unique, ttlSeconds);
  for (const item of batch.data ?? []) {
    if (item.path && item.signedUrl && !item.error) signedByPath.set(item.path, item.signedUrl);
  }

  const missing = unique.filter((path) => !signedByPath.has(path));
  if (missing.length) {
    await Promise.all(missing.map(async (path) => {
      const single = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).createSignedUrl(path, ttlSeconds);
      if (single.data?.signedUrl) signedByPath.set(path, single.data.signedUrl);
    }));
  }
  return signedByPath;
}

export function displayUrlForDirectAttachment(
  url: string | null | undefined,
  storagePath: string | null | undefined,
  signedByPath: ReadonlyMap<string, string>,
): { url: string; storagePath?: string } {
  const path = resolveDirectAttachmentStoragePath(url, storagePath);
  if (path) {
    const signed = signedByPath.get(path);
    return { url: signed ?? "", storagePath: path };
  }
  return { url: isRenderableDirectAttachmentUrl(url) ? (url as string) : "" };
}

export async function resolveDirectAttachmentDisplayUrls<T extends { url: string; storagePath?: string | null }>(
  attachments: readonly T[],
): Promise<Array<T & { url: string; storagePath?: string }>> {
  const paths = attachments
    .map((item) => resolveDirectAttachmentStoragePath(item.url, item.storagePath))
    .filter((path): path is string => Boolean(path));
  const signedByPath = await signDirectAttachmentPaths(paths);
  return attachments.map((item) => {
    const display = displayUrlForDirectAttachment(item.url, item.storagePath, signedByPath);
    return { ...item, url: display.url, storagePath: display.storagePath };
  });
}

export const directAttachmentUploadService = {
  validateFile: validateDirectAttachment,

  async upload(input: DirectAttachmentUploadInput): Promise<DirectAttachmentUploadResult> {
    if (!input.conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation is required before uploading media.");
    const validation = validateDirectAttachment(input.file); if (!validation.ok) return failure("VALIDATION_ERROR", validation.reason);
    input.onProgress?.({ percent: 8, stage: "validating" });
    const content = await validateDirectAttachmentContent(input.file); if (!content.ok) return failure("VALIDATION_ERROR", content.reason);
    if (input.signal?.aborted) return failure("UPLOAD_CANCELED", "Upload canceled.");
    const attachmentId = uuid();

    const status = getSupabaseClientStatus(); const client = getSupabaseClient();
    if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
    const auth = await client.auth.getUser(); const userId = auth.data.user?.id;
    if (auth.error || !userId) return failure("AUTH_REQUIRED", "Sign in before uploading direct-message media.");
    const storagePath = `${input.conversationId}/${attachmentId}/${userId}/${sanitizeUploadFileName(input.file.name)}`;
    input.onProgress?.({ percent: 24, stage: "uploading" });
    const uploaded = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (input.signal?.aborted) { if (!uploaded.error) await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath]); return failure("UPLOAD_CANCELED", "Upload canceled."); }
    if (uploaded.error) return failure("UPLOAD_FAILED", "Picom could not upload this private media file. Try again.");
    input.onProgress?.({ percent: 86, stage: "finalizing" });
    const signed = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).createSignedUrl(storagePath, DIRECT_ATTACHMENT_SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) { await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath]); return failure("UPLOAD_FAILED", "Picom could not prepare a private media preview."); }
    input.onProgress?.({ percent: 100, stage: "finalizing" });
    return { ok: true, data: { id: attachmentId, type: directAttachmentTypeFromMime(input.file.type), url: signed.data.signedUrl, storagePath, name: sanitizeUploadFileName(input.file.name), mimeType: input.file.type, fileSize: input.file.size, createdAt: new Date().toISOString(), scanStatus: "clean" } };
  },

  async removePending(attachment: DirectMessageAttachment): Promise<void> {
    if (!attachment.storagePath) return;
    const client = getSupabaseClient(); if (!client) return;
    await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  },

  async resolveDisplayUrl(attachment: DirectMessageAttachment): Promise<DirectMessageAttachment> {
    const [resolved] = await resolveDirectAttachmentDisplayUrls([attachment]);
    return resolved ?? { ...attachment, url: isRenderableDirectAttachmentUrl(attachment.url) ? attachment.url : "" };
  },

  resolveDisplayUrls: resolveDirectAttachmentDisplayUrls,
  signPaths: signDirectAttachmentPaths,
};
