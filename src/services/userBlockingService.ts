import type { Member, UserId } from "../types/community";

const STORAGE_KEY = "picom.userBlockingPlaceholder.v1";
const SCHEMA_VERSION = 1;

export type BlockedUserRecord = Readonly<{
  userId: UserId;
  displayName: string;
  username: string;
  blockedAt: string;
  source: "local_placeholder";
}>;

type StoredBlockedUsers = Record<UserId, BlockedUserRecord>;

function readStore(): StoredBlockedUsers {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredBlockedUsers };
    if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.records) return {};
    return parsed.records;
  } catch {
    return {};
  }
}

function writeStore(records: StoredBlockedUsers): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

export const userBlockingService = {
  listBlockedUsers(): BlockedUserRecord[] {
    return Object.values(readStore()).sort((left, right) => right.blockedAt.localeCompare(left.blockedAt));
  },

  listBlockedUserIds(): UserId[] {
    return Object.keys(readStore());
  },

  isBlocked(userId: UserId): boolean {
    return Boolean(readStore()[userId]);
  },

  blockUser(member: Pick<Member, "userId" | "displayName" | "username">): BlockedUserRecord {
    const record: BlockedUserRecord = {
      userId: member.userId,
      displayName: member.displayName,
      username: member.username,
      blockedAt: new Date().toISOString(),
      source: "local_placeholder",
    };

    writeStore({
      ...readStore(),
      [member.userId]: record,
    });

    return record;
  },

  unblockUser(userId: UserId): void {
    const records = readStore();
    delete records[userId];
    writeStore(records);
  },

  toggleBlockedUser(member: Pick<Member, "userId" | "displayName" | "username">): { blocked: boolean; record?: BlockedUserRecord } {
    if (this.isBlocked(member.userId)) {
      this.unblockUser(member.userId);
      return { blocked: false };
    }

    return { blocked: true, record: this.blockUser(member) };
  },
};