import { currentUserId, mockCommunities } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { savedMessageService } from "./savedMessageService";
import { settingsService, type PicomSettings } from "./settingsService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.dataExport.v3";
const excluded = ["password hashes", "session tokens", "auth and refresh tokens", "cookies", "authorization headers", "service keys", "LiveKit credentials", "signing keys", "raw storage paths", "raw IP addresses", "audit logs", "other users' private data"];

type Stored = { exportId: string | null; requestedAt: string | null; status: "not_requested" | "processing" | "ready" | "failed" };
export type DataExportStatus = Stored & { message: string; canDownload: boolean };
export type DataExportProfileInput = { displayName?: string; statusText?: string; bio?: string };
export type DataExportPayload = Readonly<{
  schemaVersion: number;
  exportId: string;
  requestedAt: string;
  generatedAt: string;
  expiresAt: string | null;
  profile: unknown;
  communityMemberships: unknown[];
  ownMessages: unknown[];
  attachmentMetadata: unknown[];
  follows: unknown[];
  savedMessages: unknown[];
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
    return { exportId: typeof value.exportId === "string" ? value.exportId : null, requestedAt: typeof value.requestedAt === "string" ? value.requestedAt : null, status: validStatus };
  } catch { return { exportId: null, requestedAt: null, status: "not_requested" }; }
}

function write(value: Stored): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* restricted fallback */ }
}

function status(value: Stored): DataExportStatus {
  const message = value.status === "processing" ? "Export is being generated under your account permissions." : value.status === "ready" ? latestPayload ? "Your export is ready for this session." : "A previous export expired from memory. Request a fresh export to download." : value.status === "failed" ? "The last export failed safely. You can try again." : "No data export has been requested.";
  return { ...value, message, canDownload: value.status === "ready" && latestPayload !== null };
}

function safe(value?: string): string | null {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function buildMockPayload(profile: DataExportProfileInput, exportId: string, requestedAt: string): DataExportPayload {
  const memberships = mockCommunities.filter((community) => community.members.some((member) => member.userId === currentUserId));
  const ownMessages = memberships.flatMap((community) => community.messages.filter((message) => message.authorId === currentUserId).map((message) => ({ id: message.id, communityId: community.id, channelId: message.channelId, body: message.body, createdAt: message.createdAt, editedAt: message.editedAt ?? null })));
  const attachmentMetadata = memberships.flatMap((community) => community.messages.filter((message) => message.authorId === currentUserId).flatMap((message) => (message.attachments ?? []).map((attachment) => ({ id: attachment.id, messageId: message.id, type: attachment.type, width: attachment.width ?? null, height: attachment.height ?? null }))));
  return {
    schemaVersion: 1,
    exportId,
    requestedAt,
    generatedAt: new Date().toISOString(),
    expiresAt: null,
    profile: { id: currentUserId, displayName: safe(profile.displayName), statusText: safe(profile.statusText), bio: safe(profile.bio) },
    communityMemberships: memberships.map((community) => ({ communityId: community.id, roleId: community.members.find((member) => member.userId === currentUserId)?.roleId ?? null })),
    ownMessages,
    attachmentMetadata,
    follows: [],
    savedMessages: savedMessageService.listSavedMessages().map((item) => ({ id: item.id, messageId: item.messageId, createdAt: item.createdAt })),
    localDesktopSettings: settingsService.getSettings(),
    truncated: { communityMemberships: false, ownMessages: false, attachmentMetadata: false, follows: false, savedMessages: false },
    excluded: [...excluded],
    note: "Mock-mode export generated locally from the current Picom test identity. No credentials are included.",
  };
}

export const dataExportService = {
  getStatus(): DataExportStatus { return status(read()); },

  async requestExport(profile: DataExportProfileInput): Promise<DataExportResult<DataExportStatus>> {
    const requestedAt = new Date().toISOString();
    latestPayload = null;
    write({ exportId: null, requestedAt, status: "processing" });

    if (dataSourceService.getStatus().isMock) {
      const exportId = `export_${crypto.randomUUID()}`;
      latestPayload = buildMockPayload(profile, exportId, requestedAt);
      const next: Stored = { exportId, requestedAt, status: "ready" };
      write(next);
      return { ok: true, data: status(next) };
    }

    const client = getSupabaseClient();
    if (!client) {
      const failed: Stored = { exportId: null, requestedAt, status: "failed" };
      write(failed);
      return { ok: false, message: "Data export is unavailable." };
    }
    const { data, error } = await client.functions.invoke("user-data-export", { body: {} });
    if (error || !data || typeof data !== "object") {
      const failed: Stored = { exportId: null, requestedAt, status: "failed" };
      write(failed);
      return { ok: false, message: "Picom could not generate your data export." };
    }

    const server = data as Omit<DataExportPayload, "localDesktopSettings">;
    latestPayload = { ...server, localDesktopSettings: settingsService.getSettings(), excluded: Array.isArray(server.excluded) ? server.excluded : [...excluded] };
    const next: Stored = { exportId: latestPayload.exportId, requestedAt: latestPayload.requestedAt, status: "ready" };
    write(next);
    return { ok: true, data: status(next) };
  },

  downloadExportJson(): DataExportResult<{ fileName: string }> {
    if (!latestPayload) return { ok: false, message: "Request a fresh data export before downloading." };
    const fileName = `picom-data-export-${latestPayload.exportId}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true, data: { fileName } };
  },
};

