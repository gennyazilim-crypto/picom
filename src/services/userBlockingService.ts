import type { Member, UserId } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.userBlockingPlaceholder.v1";
const SCHEMA_VERSION = 1;

export type BlockedUserRecord = Readonly<{ userId: UserId; displayName: string; username: string; blockedAt: string; source: "local_placeholder" | "supabase" }>;
type StoredBlockedUsers = Record<UserId, BlockedUserRecord>;

function readStore(): StoredBlockedUsers {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return {}; const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredBlockedUsers }; return parsed.schemaVersion === SCHEMA_VERSION && parsed.records ? parsed.records : {}; } catch { return {}; }
}
function writeStore(records: StoredBlockedUsers): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records })); } catch { /* Safe restricted-runtime fallback. */ } }

async function persistBlock(userId: string, blocked: boolean) {
  if (!dataSourceService.getStatus().isSupabase) return;
  const client = getSupabaseClient(); if (!client) return;
  const { data } = await client.auth.getUser(); if (!data.user) return;
  const result = blocked
    ? await client.from("blocked_users").upsert({ blocker_id: data.user.id, blocked_user_id: userId }, { onConflict: "blocker_id,blocked_user_id" })
    : await client.from("blocked_users").delete().eq("blocker_id", data.user.id).eq("blocked_user_id", userId);
  if (result.error) loggingService.logWarn("Blocked user sync failed", { code: result.error.code, operation: blocked ? "block" : "unblock" }, "privacy");
}

export const userBlockingService = {
  listBlockedUsers(): BlockedUserRecord[] { return Object.values(readStore()).sort((left, right) => right.blockedAt.localeCompare(left.blockedAt)); },
  getBlockedUsers(): BlockedUserRecord[] { return this.listBlockedUsers(); },
  listBlockedUserIds(): UserId[] { return Object.keys(readStore()); },
  isBlocked(userId: UserId): boolean { return Boolean(readStore()[userId]); },
  canMessageUser(userId: UserId): boolean { return !this.isBlocked(userId); },
  blockUser(member: Pick<Member, "userId" | "displayName" | "username">): BlockedUserRecord {
    const record: BlockedUserRecord = { userId: member.userId, displayName: member.displayName, username: member.username, blockedAt: new Date().toISOString(), source: "local_placeholder" };
    writeStore({ ...readStore(), [member.userId]: record }); void persistBlock(member.userId, true); return record;
  },
  unblockUser(userId: UserId): void { const records = readStore(); delete records[userId]; writeStore(records); void persistBlock(userId, false); },
  toggleBlockedUser(member: Pick<Member, "userId" | "displayName" | "username">): { blocked: boolean; record?: BlockedUserRecord } {
    if (this.isBlocked(member.userId)) { this.unblockUser(member.userId); return { blocked: false }; }
    return { blocked: true, record: this.blockUser(member) };
  },
};
