import { currentUserId, mockCommunities } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { savedMessageService } from "./savedMessageService";
import { settingsService, type PicomSettings } from "./settingsService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.dataExport.v4";
const MAX_SECTION_ROWS = 5000;
const excluded = ["password hashes", "session tokens", "auth and refresh tokens", "cookies", "authorization headers", "service keys", "LiveKit credentials", "signing keys", "raw storage paths", "raw IP addresses", "audit logs", "other users' private data"];

type Stored = { exportId: string | null; requestedAt: string | null; expiresAt: string | null; status: "not_requested" | "processing" | "ready" | "failed" };
export type DataExportStatus = Stored & { message: string; canDownload: boolean };
export type DataExportProfileInput = { displayName?: string; statusText?: string; bio?: string };
type ExportRecord = Readonly<Record<string, string | number | boolean | null>>;
export type DataExportPayload = Readonly<{
  schemaVersion: 1;
  exportId: string;
  requestedAt: string;
  generatedAt: string;
  expiresAt: string | null;
  profile: ExportRecord | null;
  communityMemberships: ExportRecord[];
  ownMessages: ExportRecord[];
  attachmentMetadata: ExportRecord[];
  follows: ExportRecord[];
  savedMessages: ExportRecord[];
  localDesktopSettings: PicomSettings;
  truncated: Record<string, boolean>;
  excluded: string[];
  note: string;
}>;
export type DataExportResult<T> = { ok: true; data: T } | { ok: false; message: string };

let latestPayload: DataExportPayload | null = null;

function read(): Stored {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Stored>;
    const validStatus = value.status === "processing" || value.status === "ready" || value.status === "failed" ? value.status : "not_requested";
    return { exportId: typeof value.exportId === "string" ? value.exportId : null, requestedAt: typeof value.requestedAt === "string" ? value.requestedAt : null, expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : null, status: validStatus };
  } catch { return { exportId: null, requestedAt: null, expiresAt: null, status: "not_requested" }; }
}

function write(value: Stored): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* request metadata only; restricted fallback */ }
}

function isExpired(payload: DataExportPayload | null): boolean {
  return Boolean(payload?.expiresAt && Date.parse(payload.expiresAt) <= Date.now());
}

function status(value: Stored): DataExportStatus {
  const expired = isExpired(latestPayload) || Boolean(value.expiresAt && Date.parse(value.expiresAt) <= Date.now());
  const message = value.status === "processing"
    ? "Export is being generated under your account permissions."
    : value.status === "ready"
      ? expired
        ? "This in-memory export expired. Request a fresh export."
        : latestPayload
          ? "Your export is ready for this session."
          : "A previous export expired from memory. Request a fresh export to download."
      : value.status === "failed" ? "The last export failed safely. You can try again." : "No data export has been requested.";
  return { ...value, message, canDownload: value.status === "ready" && latestPayload !== null && !expired };
}

function safe(value?: string, max = 500): string | null {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function pick(record: Record<string, unknown>, fields: readonly string[]): ExportRecord {
  const result: Record<string, string | number | boolean | null> = {};
  for (const field of fields) {
    const value = record[field];
    if (value === null || typeof value === "boolean" || typeof value === "number") result[field] = value;
    else if (typeof value === "string") result[field] = safe(value, field === "body" ? 4000 : 1000);
  }
  return result;
}

function normalizeRows(value: unknown, fields: readonly string[]): ExportRecord[] | null {
  if (!Array.isArray(value) || value.length > MAX_SECTION_ROWS) return null;
  return value.filter(isRecord).map((record) => pick(record, fields));
}

function normalizeServerPayload(value: unknown): Omit<DataExportPayload, "localDesktopSettings"> | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.exportId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.exportId)) return null;
  if (!validTimestamp(value.requestedAt) || !validTimestamp(value.generatedAt) || (value.expiresAt !== null && !validTimestamp(value.expiresAt))) return null;
  const profile = isRecord(value.profile) ? pick(value.profile, ["id", "username", "display_name", "avatar_url", "status", "status_text", "bio", "accent_color", "onboarding_completed", "created_at", "updated_at"]) : null;
  const communityMemberships = normalizeRows(value.communityMemberships, ["id", "community_id", "role_id", "joined_at"]);
  const ownMessages = normalizeRows(value.ownMessages, ["id", "community_id", "channel_id", "body", "client_message_id", "created_at", "edited_at", "deleted_at", "webhook_id"]);
  const attachmentMetadata = normalizeRows(value.attachmentMetadata, ["id", "message_id", "file_name", "mime_type", "size_bytes", "attachment_type", "width", "height", "status", "created_at"]);
  const follows = normalizeRows(value.follows, ["id", "followed_id", "created_at"]);
  const savedMessages = normalizeRows(value.savedMessages, ["id", "message_id", "created_at"]);
  if (!communityMemberships || !ownMessages || !attachmentMetadata || !follows || !savedMessages) return null;
  const truncation = isRecord(value.truncated) ? value.truncated : {};
  return {
    schemaVersion: 1,
    exportId: value.exportId,
    requestedAt: value.requestedAt,
    generatedAt: value.generatedAt,
    expiresAt: value.expiresAt as string | null,
    profile,
    communityMemberships,
    ownMessages,
    attachmentMetadata,
    follows,
    savedMessages,
    truncated: Object.fromEntries(["communityMemberships", "ownMessages", "attachmentMetadata", "follows", "savedMessages"].map((key) => [key, truncation[key] === true])),
    excluded: [...excluded],
    note: "Server data was allowlisted under the authenticated user's RLS context. Local desktop settings were merged in memory.",
  };
}

function buildMockPayload(profile: DataExportProfileInput, exportId: string, requestedAt: string): DataExportPayload {
  const memberships = mockCommunities.filter((community) => community.members.some((member) => member.userId === currentUserId));
  const ownMessages = memberships.flatMap((community) => community.messages.filter((message) => message.authorId === currentUserId).map((message) => ({ id: message.id, communityId: community.id, channelId: message.channelId, body: message.body, createdAt: message.createdAt, editedAt: message.editedAt ?? null })));
  const attachmentMetadata = memberships.flatMap((community) => community.messages.filter((message) => message.authorId === currentUserId).flatMap((message) => (message.attachments ?? []).map((attachment) => ({ id: attachment.id, messageId: message.id, type: attachment.type, width: attachment.width ?? null, height: attachment.height ?? null }))));
  return {
    schemaVersion: 1, exportId, requestedAt, generatedAt: new Date().toISOString(), expiresAt: null,
    profile: { id: currentUserId, displayName: safe(profile.displayName), statusText: safe(profile.statusText), bio: safe(profile.bio) },
    communityMemberships: memberships.map((community) => ({ communityId: community.id, roleId: community.members.find((member) => member.userId === currentUserId)?.roleId ?? null })),
    ownMessages, attachmentMetadata, follows: [],
    savedMessages: savedMessageService.listSavedMessages().map((item) => ({ id: item.id, messageId: item.messageId, createdAt: item.createdAt })),
    localDesktopSettings: settingsService.getSettings(),
    truncated: { communityMemberships: false, ownMessages: false, attachmentMetadata: false, follows: false, savedMessages: false },
    excluded: [...excluded],
    note: "Mock-mode export generated locally from the current Picom test identity. No credentials are included.",
  };
}

export const dataExportService = {
  getStatus(): DataExportStatus { return status(read()); },
  async refreshStatus(): Promise<DataExportStatus> {
    if (dataSourceService.getStatus().isMock) return status(read());
    const client = getSupabaseClient();
    if (!client) return status(read());
    const { data, error } = await client.from("data_export_requests").select("id,status,requested_at,expires_at").order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return status(read());
    if (latestPayload?.exportId !== data.id) latestPayload = null;
    const next: Stored = { exportId: data.id, requestedAt: data.requested_at, expiresAt: data.expires_at, status: data.status === "processing" || data.status === "ready" || data.status === "failed" ? data.status : "processing" };
    write(next);
    return status(next);
  },
  async requestExport(profile: DataExportProfileInput): Promise<DataExportResult<DataExportStatus>> {
    const requestedAt = new Date().toISOString();
    latestPayload = null;
    write({ exportId: null, requestedAt, expiresAt: null, status: "processing" });
    if (dataSourceService.getStatus().isMock) {
      const exportId = `export_${crypto.randomUUID()}`;
      latestPayload = buildMockPayload(profile, exportId, requestedAt);
      const next: Stored = { exportId, requestedAt, expiresAt: null, status: "ready" };
      write(next);
      return { ok: true, data: status(next) };
    }
    const client = getSupabaseClient();
    if (!client) { const failed: Stored = { exportId: null, requestedAt, expiresAt: null, status: "failed" }; write(failed); return { ok: false, message: "Data export is unavailable." }; }
    const { data, error } = await client.functions.invoke("user-data-export", { body: {} });
    const server = error ? null : normalizeServerPayload(data);
    if (!server) { const failed: Stored = { exportId: null, requestedAt, expiresAt: null, status: "failed" }; write(failed); return { ok: false, message: "Picom could not validate and generate your data export." }; }
    latestPayload = { ...server, localDesktopSettings: settingsService.getSettings() };
    const next: Stored = { exportId: latestPayload.exportId, requestedAt: latestPayload.requestedAt, expiresAt: latestPayload.expiresAt, status: "ready" };
    write(next);
    return { ok: true, data: status(next) };
  },
  downloadExportJson(): DataExportResult<{ fileName: string }> {
    if (!latestPayload || isExpired(latestPayload)) return { ok: false, message: "Request a fresh data export before downloading." };
    const fileName = `picom-data-export-${latestPayload.exportId}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; anchor.rel = "noopener"; anchor.click(); URL.revokeObjectURL(url);
    return { ok: true, data: { fileName } };
  },
};
