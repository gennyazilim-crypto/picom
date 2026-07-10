import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import type { AttachmentScanStatus } from "./attachmentScanService";
import type { UploadedAttachmentSummary } from "./uploadService";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";

export const ATTACHMENT_METADATA_SELECT = "id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes, attachment_type, public_url, thumbnail_url, width, height, scan_status, status, created_at" as const;

export type AttachmentMetadataRow = Readonly<{
  id: string;
  message_id: string | null;
  uploader_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  attachment_type: "image";
  public_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  scan_status: AttachmentScanStatus;
  status: "pending" | "attached" | "failed";
  created_at: string;
}>;

export type AttachmentMetadataSummary = Readonly<{
  id: string;
  messageId: string | null;
  uploaderId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  attachmentType: "image";
  publicUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  blurhashPlaceholder: string | null;
  scanStatus: AttachmentScanStatus;
  status: "pending" | "attached" | "failed";
  createdAt: string;
}>;

export type CreatePendingAttachmentMetadataInput = Readonly<{
  upload: UploadedAttachmentSummary;
}>;

export type AttachmentServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "ATTACHMENT_METADATA_CREATE_FAILED";

export type AttachmentServiceError = Readonly<{
  code: AttachmentServiceErrorCode;
  message: string;
}>;

export type AttachmentServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: AttachmentServiceError }>;

function attachmentError(code: AttachmentServiceErrorCode, message: string): AttachmentServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function mapAttachmentMetadataRow(row: AttachmentMetadataRow): AttachmentMetadataSummary {
  return {
    id: row.id,
    messageId: row.message_id,
    uploaderId: row.uploader_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    attachmentType: row.attachment_type,
    publicUrl: row.public_url,
    thumbnailUrl: row.thumbnail_url,
    width: row.width,
    height: row.height,
    blurhashPlaceholder: null,
    scanStatus: row.scan_status,
    status: row.status,
    createdAt: row.created_at,
  };
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return attachmentError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return attachmentError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const attachmentService = {
  async createPendingAttachmentMetadata(input: CreatePendingAttachmentMetadataInput): Promise<AttachmentServiceResult<AttachmentMetadataSummary>> {
    const upload = input.upload;

    if (!upload.storagePath.trim()) {
      return attachmentError("VALIDATION_ERROR", "Storage path is required.");
    }

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return {
        ok: true,
        data: {
          id: `mock-attachment-${Date.now()}`,
          messageId: null,
          uploaderId: upload.userId || currentUserId,
          storagePath: upload.storagePath,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          attachmentType: "image",
          publicUrl: upload.publicUrl,
          thumbnailUrl: upload.thumbnailUrl,
          width: upload.width,
          height: upload.height,
          blurhashPlaceholder: upload.blurhashPlaceholder,
          scanStatus: upload.scanStatus,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    let uploaderId = upload.userId;
    if (!uploaderId) {
      const { data, error } = await configured.data.auth.getUser();
      uploaderId = data.user?.id ?? "";

      if (error || !uploaderId) {
        return attachmentError("AUTH_REQUIRED", "Sign in before saving attachment metadata.");
      }
    }

    const { data, error } = await configured.data
      .from("attachments")
      .insert({
        uploader_id: uploaderId,
        storage_path: upload.storagePath,
        file_name: upload.fileName,
        mime_type: upload.mimeType,
        size_bytes: upload.sizeBytes,
        attachment_type: "image",
        // The bucket is private. Persist the storage path, never an expiring signed URL.
        public_url: null,
        thumbnail_url: null,
        width: upload.width,
        height: upload.height,
        status: "pending",
      })
      .select(ATTACHMENT_METADATA_SELECT)
      .single();

    if (error || !data) {
      if (isRateLimitError(error)) return attachmentError("RATE_LIMITED", rateLimitUserMessage);
      return attachmentError("ATTACHMENT_METADATA_CREATE_FAILED", "Could not save attachment metadata.");
    }

    return {
      ok: true,
      data: mapAttachmentMetadataRow(data),
    };
  },
};
