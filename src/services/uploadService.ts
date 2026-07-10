import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";
import { attachmentThumbnailService } from "./attachmentThumbnailService";
import { attachmentScanService, type AttachmentScanStatus } from "./attachmentScanService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments" as const;

export type UploadImageAttachmentInput = Readonly<{
  communityId: string;
  channelId: string;
  file: File;
  userId?: string;
  signal?: AbortSignal;
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

function createIdSuffix(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function createPendingStoragePath(input: UploadImageAttachmentInput, userId: string): string {
  const safeName = sanitizeUploadFileName(input.file.name);
  return `communities/${input.communityId}/channels/${input.channelId}/pending/${userId}/${createIdSuffix()}-${safeName}`;
}

function isUploadCanceled(input: UploadImageAttachmentInput): boolean {
  return Boolean(input.signal?.aborted);
}

function waitForMockUpload(signal?: AbortSignal): Promise<UploadServiceResult<true>> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(uploadError("UPLOAD_CANCELED", "Upload canceled."));
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: true, data: true });
    }, 520);

    const onAbort = () => {
      globalThis.clearTimeout(timeout);
      resolve(uploadError("UPLOAD_CANCELED", "Upload canceled."));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
    const validationError = validateInput(input);
    if (validationError) return { ok: false, error: validationError };
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");
    const contentValidation = await fileService.validateContent(input.file);
    if (!contentValidation.ok) return uploadError("VALIDATION_ERROR", contentValidation.reason);
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const mockDelay = await waitForMockUpload(input.signal);
      if (!mockDelay.ok) return mockDelay;

      const userId = input.userId ?? currentUserId;
      const storagePath = createPendingStoragePath(input, userId);
      const thumbnail = attachmentThumbnailService.createThumbnailPlaceholder({
        storagePath,
        publicUrl: null,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      });
      const scan = attachmentScanService.scanFilePlaceholder({
        fileName: input.file.name,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      });
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
          scanStatus: scan.status,
        },
      };
    }

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

    const storagePath = createPendingStoragePath(input, userId);
    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");

    const { error } = await configured.data.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .upload(storagePath, input.file, {
        contentType: input.file.type,
        upsert: false,
      });

    if (isUploadCanceled(input)) return uploadError("UPLOAD_CANCELED", "Upload canceled.");

    if (error) {
      if (isRateLimitError(error)) return uploadError("RATE_LIMITED", rateLimitUserMessage);
      return uploadError("UPLOAD_FAILED", "Could not upload attachment.");
    }

    const { data: signedUrlData, error: signedUrlError } = await configured.data.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    const publicUrl = signedUrlError ? null : signedUrlData.signedUrl;
    const thumbnail = attachmentThumbnailService.createThumbnailPlaceholder({
      storagePath,
      publicUrl,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    });
    const scan = attachmentScanService.scanFilePlaceholder({
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    });

    return {
      ok: true,
      data: {
        bucket: MESSAGE_ATTACHMENTS_BUCKET,
        userId,
        storagePath,
        fileName: sanitizeUploadFileName(input.file.name),
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        publicUrl,
        thumbnailUrl: thumbnail.thumbnailUrl,
        thumbnailStoragePath: thumbnail.thumbnailStoragePath,
        width: thumbnail.width,
        height: thumbnail.height,
        blurhashPlaceholder: thumbnail.blurhashPlaceholder,
        scanStatus: scan.status,
      },
    };
  },
};
