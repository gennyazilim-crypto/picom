import { settingsService } from "./settingsService";

export type LocalDataMigrationScope = "settings" | "drafts" | "cache" | "manifest";
export type LocalDataMigrationResult = Readonly<{
  ok: boolean;
  fromVersion: number;
  toVersion: number;
  migratedScopes: LocalDataMigrationScope[];
  resetScopes: LocalDataMigrationScope[];
  backupKeys: string[];
}>;

type LocalDataMigration = Readonly<{ fromVersion: number; toVersion: number; migrate: (context: MigrationContext) => void }>;
type MigrationContext = { migratedScopes: LocalDataMigrationScope[]; resetScopes: LocalDataMigrationScope[]; backupKeys: string[] };

const CURRENT_SCHEMA_VERSION = 2;
const MANIFEST_KEY = "picom:local-data-schema:v2";
const SETTINGS_KEY = "picom-settings";
const DRAFTS_KEY = "picom.messageDrafts.v1";
const REMOTE_CONFIG_CACHE_KEY = "picom.remoteConfig.v1";
const BACKUP_PREFIX = "picom:local-data-backup:v2";
const MAX_BACKUP_CHARS = 12_000;
const MAX_BACKUPS = 5;
const LEGACY_CACHE_KEYS = ["picom:image-cache:v0", "picom:message-cache:v0", "picom:remote-config:v0"] as const;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

function pruneBackups(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  keys.sort().slice(0, Math.max(0, keys.length - MAX_BACKUPS)).forEach((key) => storage.removeItem(key));
}

function backupAllowedScope(storage: Storage, scope: LocalDataMigrationScope, raw: string | null, context: MigrationContext): void {
  if (!raw) return;
  try {
    const key = `${BACKUP_PREFIX}:${Date.now()}:${scope}`;
    storage.setItem(key, raw.slice(0, MAX_BACKUP_CHARS));
    context.backupKeys.push(key);
    pruneBackups(storage);
  } catch {
    // A quota/policy failure must not block basic Safe Mode startup.
  }
}

function migrateSettings(storage: Storage, context: MigrationContext): void {
  try {
    settingsService.getSettings();
    context.migratedScopes.push("settings");
  } catch {
    backupAllowedScope(storage, "settings", storage.getItem(SETTINGS_KEY), context);
    storage.removeItem(SETTINGS_KEY);
    settingsService.getDefaultSettings();
    context.resetScopes.push("settings");
  }
}

function migrateDrafts(storage: Storage, context: MigrationContext): void {
  const raw = storage.getItem(DRAFTS_KEY);
  if (!raw) { context.migratedScopes.push("drafts"); return; }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid draft map");
    const migrated: Record<string, { text: string; updatedAt: string }> = {};
    for (const [storedKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      if (typeof record.text !== "string" || !record.text.trim()) continue;
      const updatedAt = typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : new Date(0).toISOString();
      const keyParts = storedKey.split(":");
      const normalizedKey = keyParts.length === 2 ? `community:${keyParts[0]}:channel:${keyParts[1]}` : storedKey;
      if (!normalizedKey.startsWith("community:") && !normalizedKey.startsWith("dm:")) continue;
      migrated[normalizedKey] = { text: record.text.slice(0, 4000), updatedAt };
    }
    storage.setItem(DRAFTS_KEY, JSON.stringify(migrated));
    context.migratedScopes.push("drafts");
  } catch {
    backupAllowedScope(storage, "drafts", raw, context);
    storage.removeItem(DRAFTS_KEY);
    context.resetScopes.push("drafts");
  }
}

function migrateCache(storage: Storage, context: MigrationContext): void {
  const raw = storage.getItem(REMOTE_CONFIG_CACHE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { schemaVersion?: unknown; cachedAt?: unknown };
      if (parsed.schemaVersion !== 1 || typeof parsed.cachedAt !== "number") throw new Error("invalid cache metadata");
    } catch {
      backupAllowedScope(storage, "cache", raw, context);
      storage.removeItem(REMOTE_CONFIG_CACHE_KEY);
      context.resetScopes.push("cache");
    }
  }
  LEGACY_CACHE_KEYS.forEach((key) => storage.removeItem(key));
  if (!context.resetScopes.includes("cache")) context.migratedScopes.push("cache");
}

export const localDataMigrations: LocalDataMigration[] = [
  { fromVersion: 0, toVersion: 1, migrate: (context) => { const storage = getStorage(); if (storage) { migrateSettings(storage, context); migrateDrafts(storage, context); } } },
  { fromVersion: 1, toVersion: 2, migrate: (context) => { const storage = getStorage(); if (storage) migrateCache(storage, context); } },
];

function readManifestVersion(storage: Storage, context: MigrationContext): number {
  const raw = storage.getItem(MANIFEST_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
    return typeof parsed.schemaVersion === "number" && Number.isInteger(parsed.schemaVersion) ? parsed.schemaVersion : 0;
  } catch {
    backupAllowedScope(storage, "manifest", raw, context);
    storage.removeItem(MANIFEST_KEY);
    context.resetScopes.push("manifest");
    return 0;
  }
}

export const localDataMigrationService = {
  getCurrentSchemaVersion(): number { return CURRENT_SCHEMA_VERSION; },
  migrateOnStartup(): LocalDataMigrationResult {
    const storage = getStorage();
    const context: MigrationContext = { migratedScopes: [], resetScopes: [], backupKeys: [] };
    if (!storage) return { ok: true, fromVersion: CURRENT_SCHEMA_VERSION, toVersion: CURRENT_SCHEMA_VERSION, ...context };
    const fromVersion = readManifestVersion(storage, context);
    let version = fromVersion > CURRENT_SCHEMA_VERSION ? 0 : fromVersion;
    if (fromVersion > CURRENT_SCHEMA_VERSION) {
      backupAllowedScope(storage, "manifest", storage.getItem(MANIFEST_KEY), context);
      storage.removeItem(MANIFEST_KEY);
      context.resetScopes.push("manifest");
    }
    while (version < CURRENT_SCHEMA_VERSION) {
      const migration = localDataMigrations.find((candidate) => candidate.fromVersion === version);
      if (!migration) break;
      try { migration.migrate(context); } catch { context.resetScopes.push("manifest"); break; }
      version = migration.toVersion;
    }
    const ok = version === CURRENT_SCHEMA_VERSION;
    try {
      storage.setItem(MANIFEST_KEY, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, migratedAt: new Date().toISOString(), ok }));
      return { ok, fromVersion, toVersion: CURRENT_SCHEMA_VERSION, ...context };
    } catch {
      return { ok: false, fromVersion, toVersion: CURRENT_SCHEMA_VERSION, ...context };
    }
  },
};
