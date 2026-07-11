import type { DirectMessageAttachment } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import { fileService } from "../fileService";
import { sanitizeUploadFileName } from "../uploadService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

export const DIRECT_MESSAGE_ATTACHMENTS_BUCKET = "direct-message-attachments" as const;

export type DirectAttachmentUploadProgress = Readonly<{ percent: number; stage: "validating" | "uploading" | "finalizing" }>;
export type DirectAttachmentUploadErrorCode = "VALIDATION_ERROR" | "AUTH_REQUIRED" | "NOT_CONFIGURED" | "UPLOAD_CANCELED" | "UPLOAD_FAILED";
export type DirectAttachmentUploadResult = Readonly<{ ok: true; data: DirectMessageAttachment }> | Readonly<{ ok: false; error: Readonly<{ code: DirectAttachmentUploadErrorCode; message: string }> }>;
export type DirectAttachmentUploadInput = Readonly<{ conversationId: string; file: File; previewUrl: string; signal?: AbortSignal; onProgress?: (progress: DirectAttachmentUploadProgress) => void }>;

function failure(code: DirectAttachmentUploadErrorCode, message: string): DirectAttachmentUploadResult { return { ok: false, error: { code, message } }; }
function uuid(): string { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function isRenderableDirectAttachmentUrl(value: string): boolean { return /^(https?:|blob:|data:)/i.test(value); }

function fileToDataUrl(file: File, signal?: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(null); return; }
    const reader = new FileReader();
    const abort = () => { reader.abort(); resolve(null); };
    signal?.addEventListener("abort", abort, { once: true });
    reader.onload = () => { signal?.removeEventListener("abort", abort); resolve(typeof reader.result === "string" ? reader.result : null); };
    reader.onerror = () => { signal?.removeEventListener("abort", abort); resolve(null); };
    reader.onabort = () => { signal?.removeEventListener("abort", abort); resolve(null); };
    reader.readAsDataURL(file);
  });
}

export const directAttachmentUploadService = {
  async upload(input: DirectAttachmentUploadInput): Promise<DirectAttachmentUploadResult> {
    if (!input.conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation is required before uploading an image.");
    const validation = fileService.validate(input.file); if (!validation.ok) return failure("VALIDATION_ERROR", validation.reason);
    input.onProgress?.({ percent: 8, stage: "validating" });
    const content = await fileService.validateContent(input.file); if (!content.ok) return failure("VALIDATION_ERROR", content.reason);
    if (input.signal?.aborted) return failure("UPLOAD_CANCELED", "Upload canceled.");
    const attachmentId = uuid();

    if (dataSourceService.getStatus().isMock) {
      input.onProgress?.({ percent: 42, stage: "uploading" });
      const url = await fileToDataUrl(input.file, input.signal);
      if (!url || input.signal?.aborted) return failure("UPLOAD_CANCELED", "Upload canceled.");
      input.onProgress?.({ percent: 100, stage: "finalizing" });
      return { ok: true, data: { id: attachmentId, type: "image", url, name: sanitizeUploadFileName(input.file.name), mimeType: input.file.type, fileSize: input.file.size, width: undefined, height: undefined, createdAt: new Date().toISOString() } };
    }

    const status = getSupabaseClientStatus(); const client = getSupabaseClient();
    if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
    const auth = await client.auth.getUser(); const userId = auth.data.user?.id;
    if (auth.error || !userId) return failure("AUTH_REQUIRED", "Sign in before uploading direct-message images.");
    const storagePath = `${input.conversationId}/${attachmentId}/${userId}/${sanitizeUploadFileName(input.file.name)}`;
    input.onProgress?.({ percent: 24, stage: "uploading" });
    const uploaded = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (input.signal?.aborted) { if (!uploaded.error) await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath]); return failure("UPLOAD_CANCELED", "Upload canceled."); }
    if (uploaded.error) return failure("UPLOAD_FAILED", "Picom could not upload this private image. Try again.");
    input.onProgress?.({ percent: 86, stage: "finalizing" });
    const signed = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) { await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath]); return failure("UPLOAD_FAILED", "Picom could not prepare a private image preview."); }
    input.onProgress?.({ percent: 100, stage: "finalizing" });
    return { ok: true, data: { id: attachmentId, type: "image", url: signed.data.signedUrl, storagePath, name: sanitizeUploadFileName(input.file.name), mimeType: input.file.type, fileSize: input.file.size, createdAt: new Date().toISOString() } };
  },

  async removePending(attachment: DirectMessageAttachment): Promise<void> {
    if (!attachment.storagePath || dataSourceService.getStatus().isMock) return;
    const client = getSupabaseClient(); if (!client) return;
    await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  },

  async resolveDisplayUrl(attachment: DirectMessageAttachment): Promise<DirectMessageAttachment> {
    const path = attachment.storagePath ?? (!isRenderableDirectAttachmentUrl(attachment.url) ? attachment.url : undefined);
    if (!path || dataSourceService.getStatus().isMock) return attachment;
    const client = getSupabaseClient(); if (!client) return attachment;
    const signed = await client.storage.from(DIRECT_MESSAGE_ATTACHMENTS_BUCKET).createSignedUrl(path, 60 * 60);
    return signed.data?.signedUrl ? { ...attachment, storagePath: path, url: signed.data.signedUrl } : attachment;
  },
};
