import type { Attachment, AttachmentScanStatus } from "../../types/community";
import type { Json } from "../supabase/database.types";

/** Canonical Feed media attachment — components must not parse raw Storage/RPC rows. */
export type FeedAttachmentKind = "image" | "video" | "audio" | "file";
export type FeedAttachmentModerationState = "clean" | "pending" | "quarantined" | "removed";
export type FeedAttachmentAvailability = "available" | "unavailable" | "broken" | "expired" | "revoked";

export type FeedAttachment = Readonly<{
  id: string;
  messageId: string | null;
  kind: FeedAttachmentKind;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** Private bucket object key; used to mint short-lived signed URLs (never persist signed URLs). */
  storagePath: string | null;
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  altText: string;
  moderationState: FeedAttachmentModerationState;
  availabilityState: FeedAttachmentAvailability;
}>;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function moderationFromScan(scan: string | null): FeedAttachmentModerationState {
  if (scan === "clean" || scan === "skipped_development") return "clean";
  if (scan === "suspicious" || scan === "failed") return "quarantined";
  if (scan === "pending") return "pending";
  return "removed";
}

function kindFromMime(mime: string | null, fallback: FeedAttachmentKind = "image"): FeedAttachmentKind {
  if (!mime) return fallback;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

/** Prefer real thumbnail when present; otherwise native original for safe lazy preview (Approach B). */
export function resolveFeedPreviewUrl(attachment: Pick<FeedAttachment, "thumbnailUrl" | "previewUrl" | "originalUrl" | "moderationState" | "availabilityState">): string | null {
  if (attachment.moderationState !== "clean" || attachment.availabilityState !== "available") return null;
  return attachment.thumbnailUrl || attachment.previewUrl || attachment.originalUrl;
}

export function mapRpcAttachmentToFeed(row: unknown, messageId: string | null = null): FeedAttachment | null {
  const object = asObject(row);
  if (!object) return null;
  const id = asString(object.id);
  const storagePath = asString(object.storage_path) ?? asString(object.storagePath);
  const originalUrl = asString(object.public_url) ?? asString(object.url);
  // Private bucket rows expose storage_path with null public_url; signed URL hydration fills originalUrl.
  if (!id || (!originalUrl && !storagePath)) return null;
  const scan = asString(object.scan_status);
  const moderationState = moderationFromScan(scan);
  if (moderationState !== "clean") return null;
  const mimeType = asString(object.mime_type) ?? asString(object.mimeType);
  const thumbnailUrl = asString(object.thumbnail_url) ?? asString(object.thumbnailUrl);
  // Never invent a fake thumbnail URL — null means native original preview.
  return {
    id,
    messageId: asString(object.message_id) ?? messageId,
    kind: kindFromMime(mimeType, "image"),
    mimeType,
    width: asNumber(object.width),
    height: asNumber(object.height),
    durationMs: asNumber(object.duration_ms) ?? asNumber(object.durationMs),
    storagePath,
    originalUrl,
    previewUrl: originalUrl,
    thumbnailUrl,
    fileName: asString(object.file_name) ?? asString(object.fileName) ?? asString(object.alt),
    fileSize: asNumber(object.size_bytes) ?? asNumber(object.fileSize),
    altText: asString(object.alt) ?? asString(object.file_name) ?? "Shared media",
    moderationState,
    availabilityState: originalUrl ? "available" : "unavailable",
  };
}

/** Apply batch-signed Storage URLs for private Feed attachments. */
export function applySignedUrlsToFeedAttachments(
  items: readonly FeedAttachment[],
  signedByPath: ReadonlyMap<string, string>,
): FeedAttachment[] {
  return items.map((item) => {
    if (item.originalUrl) return item;
    const signed = item.storagePath ? signedByPath.get(item.storagePath) : undefined;
    if (!signed) return item;
    return {
      ...item,
      originalUrl: signed,
      previewUrl: signed,
      availabilityState: "available" as const,
    };
  });
}

export function mapRpcAttachments(value: Json | unknown, messageId: string | null = null): FeedAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: FeedAttachment[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const mapped = mapRpcAttachmentToFeed(row, messageId);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    out.push(mapped);
  }
  return out;
}

export function feedAttachmentToUiAttachment(item: FeedAttachment): Attachment | null {
  if (item.kind !== "image" || !item.originalUrl) return null;
  const scanStatus: AttachmentScanStatus = item.moderationState === "clean" ? "clean" : item.moderationState === "pending" ? "pending" : "suspicious";
  return {
    id: item.id,
    type: "image",
    url: item.originalUrl,
    publicUrl: item.originalUrl,
    thumbnailUrl: item.thumbnailUrl,
    mimeType: item.mimeType ?? undefined,
    alt: item.altText,
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    scanStatus,
  };
}

export function uiAttachmentsToFeed(items: readonly Attachment[] | undefined, messageId: string | null = null): FeedAttachment[] {
  if (!items?.length) return [];
  return items.flatMap((item) => {
    if (!item?.id || !(item.publicUrl || item.url)) return [];
    const originalUrl = item.publicUrl || item.url;
    const moderationState = moderationFromScan(item.scanStatus ?? null);
    if (moderationState !== "clean") return [];
    return [{
      id: item.id,
      messageId,
      kind: "image" as const,
      mimeType: item.mimeType ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      durationMs: null,
      storagePath: null,
      originalUrl,
      previewUrl: originalUrl,
      thumbnailUrl: item.thumbnailUrl ?? null,
      fileName: item.alt || null,
      fileSize: null,
      altText: item.alt || "Shared image",
      moderationState,
      availabilityState: "available" as const,
    }];
  });
}

export function partitionFeedAttachments(items: readonly FeedAttachment[]) {
  const images: FeedAttachment[] = [];
  const other: FeedAttachment[] = [];
  for (const item of items) {
    if (item.kind === "image") images.push(item);
    else other.push(item);
  }
  return { images, other } as const;
}
