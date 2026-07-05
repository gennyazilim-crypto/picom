const STORAGE_KEY = "picom.privateChannelPermissions.v1";
const SCHEMA_VERSION = 1;

export type PrivateChannelPermissionRecord = Readonly<{
  channelId: string;
  allowedRoleIds: string[];
  updatedAt: string;
  source: "local_placeholder";
}>;

type StoredPrivateChannelPermissions = Record<string, PrivateChannelPermissionRecord>;

function readStore(): StoredPrivateChannelPermissions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredPrivateChannelPermissions };
    if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.records) return {};
    return parsed.records;
  } catch {
    return {};
  }
}

function writeStore(records: StoredPrivateChannelPermissions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

export const privateChannelPermissionService = {
  getChannelPermissions(channelId: string): PrivateChannelPermissionRecord | null {
    return readStore()[channelId] ?? null;
  },

  saveChannelPermissions(channelId: string, allowedRoleIds: string[]): PrivateChannelPermissionRecord {
    const record: PrivateChannelPermissionRecord = {
      channelId,
      allowedRoleIds: Array.from(new Set(allowedRoleIds.filter(Boolean))),
      updatedAt: new Date().toISOString(),
      source: "local_placeholder",
    };

    writeStore({
      ...readStore(),
      [channelId]: record,
    });

    return record;
  },
};