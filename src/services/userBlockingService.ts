import type { Member, UserId } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.userBlockingPlaceholder.v1";
const SCHEMA_VERSION = 1;

export type BlockedUserRecord = Readonly<{ userId: UserId; displayName: string; username: string; blockedAt: string; source: "local_placeholder" | "supabase" }>;
type StoredBlockedUsers = Record<UserId, BlockedUserRecord>;
const listeners = new Set<() => void>();

function notifyBlockedUsersChanged(): void { listeners.forEach((listener) => listener()); }

function readStore(): StoredBlockedUsers {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return {}; const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredBlockedUsers }; return parsed.schemaVersion === SCHEMA_VERSION && parsed.records ? parsed.records : {}; } catch { return {}; }
}
function writeStore(records: StoredBlockedUsers): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records })); } catch { /* Safe restricted-runtime fallback. */ } }

async function persistBlock(userId: string, blocked: boolean): Promise<boolean> {
  if (!dataSourceService.getStatus().isSupabase) return true;
  const client = getSupabaseClient(); if (!client) return false;
  const { data } = await client.auth.getUser(); if (!data.user) return false;
  const result = blocked ? await client.rpc("block_user", { target_user_id: userId }) : await client.rpc("unblock_user", { target_user_id: userId });
  if (result.error) loggingService.logWarn("Blocked user sync failed", { code: result.error.code, operation: blocked ? "block" : "unblock" }, "privacy");
  return !result.error && result.data;
}

export const userBlockingService = {
  listBlockedUsers(): BlockedUserRecord[] { return Object.values(readStore()).sort((left, right) => right.blockedAt.localeCompare(left.blockedAt)); },
  getBlockedUsers(): BlockedUserRecord[] { return this.listBlockedUsers(); },
  listBlockedUserIds(): UserId[] { return Object.keys(readStore()); },
  isBlocked(userId: UserId): boolean { return Boolean(readStore()[userId]); },
  canMessageUser(userId: UserId): boolean { return !this.isBlocked(userId); },
  blockUser(member: Pick<Member, "userId" | "displayName" | "username">): BlockedUserRecord {
    const record: BlockedUserRecord = { userId: member.userId, displayName: member.displayName, username: member.username, blockedAt: new Date().toISOString(), source: "local_placeholder" };
    writeStore({ ...readStore(), [member.userId]: record }); notifyBlockedUsersChanged(); void persistBlock(member.userId, true); return record;
  },
  unblockUser(userId: UserId): void { const records = readStore(); delete records[userId]; writeStore(records); notifyBlockedUsersChanged(); void persistBlock(userId, false); },
  toggleBlockedUser(member: Pick<Member, "userId" | "displayName" | "username">): { blocked: boolean; record?: BlockedUserRecord } {
    if (this.isBlocked(member.userId)) { this.unblockUser(member.userId); return { blocked: false }; }
    return { blocked: true, record: this.blockUser(member) };
  },
  async setBlockedUser(member: Pick<Member, "userId" | "displayName" | "username">, blocked: boolean): Promise<boolean> {
    const before = readStore();
    if (blocked) {
      const record: BlockedUserRecord = { userId: member.userId, displayName: member.displayName, username: member.username, blockedAt: new Date().toISOString(), source: dataSourceService.getStatus().isSupabase ? "supabase" : "local_placeholder" };
      writeStore({ ...before, [member.userId]: record });
    } else {
      const next = { ...before }; delete next[member.userId]; writeStore(next);
    }
    notifyBlockedUsersChanged();
    const persisted = await persistBlock(member.userId, blocked);
    if (!persisted) { writeStore(before); notifyBlockedUsersChanged(); }
    return persisted;
  },
  async refreshRemoteBlocks(): Promise<BlockedUserRecord[]> {
    if (!dataSourceService.getStatus().isSupabase) return this.listBlockedUsers();
    const client = getSupabaseClient(); if (!client) return this.listBlockedUsers();
    const { data, error } = await client.rpc("list_blocked_users", {});
    if (error) { loggingService.logWarn("Blocked user list refresh failed", { code: error.code }, "privacy"); return this.listBlockedUsers(); }
    const records: StoredBlockedUsers = {};
    for (const row of data ?? []) records[row.user_id] = { userId: row.user_id, displayName: row.display_name, username: row.username, blockedAt: row.blocked_at, source: "supabase" };
    writeStore(records);
    notifyBlockedUsersChanged();
    return Object.values(records).sort((left, right) => right.blockedAt.localeCompare(left.blockedAt));
  },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
};
