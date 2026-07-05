import type { Community, Member, UserId } from "../types/community";

const STORAGE_KEY = "picom.communityOwnershipTransfer.v1";
const SCHEMA_VERSION = 1;

export type OwnershipTransferStatus = Readonly<{
  communityId: string;
  requestedAt: string;
  fromUserId: UserId;
  toUserId: UserId;
  targetDisplayName: string;
  status: "pending_placeholder";
  message: string;
}>;

type StoredOwnershipTransfers = Record<string, OwnershipTransferStatus>;

export type OwnershipTransferResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function readStore(): StoredOwnershipTransfers {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as { schemaVersion?: number; transfers?: StoredOwnershipTransfers };
    if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.transfers) return {};
    return parsed.transfers;
  } catch {
    return {};
  }
}

function writeStore(transfers: StoredOwnershipTransfers): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, transfers }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function getRoleName(community: Community, member: Member): string | null {
  return community.roles.find((role) => role.id === member.roleId)?.name ?? null;
}

export const communityOwnershipTransferService = {
  getStatus(communityId: string): OwnershipTransferStatus | null {
    return readStore()[communityId] ?? null;
  },

  requestTransferPlaceholder(community: Community, currentUser: Member, targetUserId: UserId, confirmationName: string): OwnershipTransferResult<OwnershipTransferStatus> {
    if (getRoleName(community, currentUser) !== "Owner") {
      return {
        ok: false,
        message: "Only the current owner can prepare an ownership transfer placeholder.",
      };
    }

    if (confirmationName.trim() !== community.name) {
      return {
        ok: false,
        message: "Type the exact community name before preparing ownership transfer.",
      };
    }

    if (targetUserId === currentUser.userId) {
      return {
        ok: false,
        message: "Choose another community member as the target owner.",
      };
    }

    const target = community.members.find((member) => member.userId === targetUserId);
    if (!target) {
      return {
        ok: false,
        message: "Target user must be a current community member.",
      };
    }

    const next: OwnershipTransferStatus = {
      communityId: community.id,
      requestedAt: new Date().toISOString(),
      fromUserId: currentUser.userId,
      toUserId: target.userId,
      targetDisplayName: target.displayName,
      status: "pending_placeholder",
      message: "Ownership transfer placeholder recorded locally. Roles were not changed.",
    };

    writeStore({
      ...readStore(),
      [community.id]: next,
    });

    return {
      ok: true,
      data: next,
    };
  },

  clearPlaceholder(communityId: string): OwnershipTransferResult<{ message: string }> {
    const store = readStore();
    delete store[communityId];
    writeStore(store);

    return {
      ok: true,
      data: {
        message: "Ownership transfer placeholder cleared.",
      },
    };
  },
};