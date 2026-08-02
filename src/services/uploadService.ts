import { fileService } from "./fileService";
import { attachmentThumbnailService } from "./attachmentThumbnailService";
import type { AttachmentScanStatus } from "./attachmentScanService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments" as const;

export type UploadImageAttachmentInput = Readonly<{
  communityId: string;
  channelId: string;
  file: File;
  userId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: Readonly<{ percent: number; stage: "validating" | "uploading" | "finalizing" }>) => void;
}>;

export type UploadedAttachmentSummary = Readonly<{
  bucket: typeof MESSAGE_ATTACHMENTS_BUCKET;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string | null;
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  width: number | null;
  height: number | null;
  blurhashPlaceholder: string | null;
  scanStatus: AttachmentScanStatus;
}>;

export type UploadServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UPLOAD_CANCELED"
  | "UPLOAD_FAILED";

export type UploadServiceError = Readonly<{
  code: UploadServiceErrorCode;
  message: string;
}>;

export type UploadServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: UploadServiceError }>;

type SignedAttachmentUploadResponse = Readonly<{
  path?: string;
  token?: string;
  code?: string;
  message?: string;
}>;

function uploadError(code: UploadServiceErrorCode, message: string): UploadServiceResult<never> {
  return { ok: false, error: { code, message } };
}

export function sanitizeUploadFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 96);

  return cleaned || "attachment";
}

function validateInput(input: UploadImageAttachmentInput): UploadServiceError | null {
  if (!input.communityId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  }

  if (!input.channelId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Channel ID is required." };
  }

  const validation = fileService.validate(input.file);
  if (!validation.ok) {
    return { code: "VALIDATION_ERROR", message: "reason" in validation ? validation.reason ?? "Invalid attachment." : "Invalid attachment." };
  }

  return null;
}

function isUploadCanceled(input: UploadImageAttachmentInput): boolean {
  return Boolean(input.signal?.aborted);
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return uploadError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return uploadError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const uploadService = {
  sanitizeUploadFileName,

  async uploadImageAttachment(input: UploadImageAttachmentInput): Promise<UploadServiceResult<UploadedAttachmentSummary>> {
    input.onProgress?.({ percent: 5, stage: "validating" });
    const validationError = validateInput(input);
    if (validationError) return { ok: false, error: validationError };
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");
    const contentValidation = await fileService.validateContent(input.file);
    if (!contentValidation.ok) return uploadError("VALIDATION_ERROR", contentValidation.reason);
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    let userId = input.userId?.trim();
    if (!userId) {
      const { data, error } = await configured.data.auth.getUser();
      userId = data.user?.id;

      if (error || !userId) {
        return uploadError("AUTH_REQUIRED", "Sign in before uploading attachments.");
      }
    }

    const signedUpload = await configured.data.functions.invoke<SignedAttachmentUploadResponse>("create-message-attachment-upload", {
      body: {
        communityId: input.communityId,
        channelId: input.channelId,
        fileName: sanitizeUploadFileName(input.file.name),
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      },
    });

    if (signedUpload.error || !signedUpload.data?.path || !signedUpload.data.token) {
      if (isRateLimitError(signedUpload.error)) return uploadError("RATE_LIMITED", rateLimitUserMessage);
      return uploadError("UPLOAD_FAILED", signedUpload.data?.message ?? "Picom could not authorize this attachment upload.");
    }

    const storagePath = signedUpload.data.path;
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");

    input.onProgress?.({ percent: 30, stage: "uploading" });
    const { error } = await configured.data.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .uploadToSignedUrl(storagePath, signedUpload.data.token, input.file, {
        contentType: input.file.type,
        upsert: false,
      });

    if (isUploadCanceled(input)) {
      if (!error) await configured.data.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath]);
      return uploadError("UPLOAD_CANCELED", "Upload canceled.");
    }

    if (error) {
      if (isRateLimitError(error)) return uploadError("RATE_LIMITED", rateLimitUserMessage);
      return uploadError("UPLOAD_FAILED", "Picom could not upload this attachment to protected storage.");
    }

    const thumbnail = attachmentThumbnailService.createNativePreviewMetadata({
      storagePath,
      publicUrl: null,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    });
    input.onProgress?.({ percent: 100, stage: "finalizing" });
    return {
      ok: true,
      data: {
        bucket: MESSAGE_ATTACHMENTS_BUCKET,
        userId,
        storagePath,
        fileName: sanitizeUploadFileName(input.file.name),
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        publicUrl: null,
        thumbnailUrl: thumbnail.thumbnailUrl,
        thumbnailStoragePath: thumbnail.thumbnailStoragePath,
        width: thumbnail.width,
        height: thumbnail.height,
        blurhashPlaceholder: thumbnail.blurhashPlaceholder,
        scanStatus: "pending",
      },
    };
  },

  async removePending(storagePath: string): Promise<boolean> {
    const normalized = storagePath.trim().replace(/\\/g, "/");
    if (!normalized.includes("/pending/")) return false;
    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return false;
    const { error } = await configured.data.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([normalized]);
    return !error;
  },
};
