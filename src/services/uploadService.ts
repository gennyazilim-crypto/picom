import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments" as const;

export type UploadImageAttachmentInput = Readonly<{
  communityId: string;
  channelId: string;
  file: File;
  userId?: string;
}>;

export type UploadedAttachmentSummary = Readonly<{
  bucket: typeof MESSAGE_ATTACHMENTS_BUCKET;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string | null;
}>;

export type UploadServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
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

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const userId = input.userId ?? currentUserId;
      const storagePath = createPendingStoragePath(input, userId);
      return {
        ok: true,
        data: {
          bucket: MESSAGE_ATTACHMENTS_BUCKET,
          storagePath,
          fileName: sanitizeUploadFileName(input.file.name),
          mimeType: input.file.type,
          sizeBytes: input.file.size,
          publicUrl: null,
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
    const { error } = await configured.data.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .upload(storagePath, input.file, {
        contentType: input.file.type,
        upsert: false,
      });

    if (error) {
      return uploadError("UPLOAD_FAILED", "Could not upload attachment.");
    }

    return {
      ok: true,
      data: {
        bucket: MESSAGE_ATTACHMENTS_BUCKET,
        storagePath,
        fileName: sanitizeUploadFileName(input.file.name),
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        publicUrl: null,
      },
    };
  },
};
