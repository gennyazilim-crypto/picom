import type { Community, Member, UserId } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityOwnershipTransfer.v2";
const SCHEMA_VERSION = 2;

export type OwnershipTransferStatus = Readonly<{
  communityId: string;
  transferredAt: string;
  fromUserId: UserId;
  toUserId: UserId;
  targetDisplayName: string;
  status: "completed";
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
    return parsed.schemaVersion === SCHEMA_VERSION && parsed.transfers ? parsed.transfers : {};
  } catch {
    return {};
  }
}

function writeStore(transfers: StoredOwnershipTransfers): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, transfers }));
  } catch {
    // Restricted desktop fallback: completion still remains in component state.
  }
}

function getRoleName(community: Community, member: Member): string | null {
  return community.roles.find((role) => role.id === member.roleId)?.name ?? null;
}

function validateTransfer(community: Community, currentUser: Member, targetUserId: UserId, confirmationName: string): OwnershipTransferResult<Member> {
  if (getRoleName(community, currentUser) !== "Owner") return { ok: false, message: "Only the current owner can transfer community ownership." };
  if (confirmationName.trim() !== community.name) return { ok: false, message: "Type the exact community name before transferring ownership." };
  if (targetUserId === currentUser.userId) return { ok: false, message: "Choose another community member as the target owner." };
  const target = community.members.find((member) => member.userId === targetUserId);
  return target ? { ok: true, data: target } : { ok: false, message: "Target user must be a current community member." };
}

export const communityOwnershipTransferService = {
  getStatus(communityId: string): OwnershipTransferStatus | null {
    return readStore()[communityId] ?? null;
  },

  async transferOwnership(community: Community, currentUser: Member, targetUserId: UserId, confirmationName: string): Promise<OwnershipTransferResult<OwnershipTransferStatus>> {
    const validation = validateTransfer(community, currentUser, targetUserId, confirmationName);
    if (!validation.ok) return validation;

    let transferredAt = new Date().toISOString();
    if (!dataSourceService.getStatus().isMock) {
      const client = getSupabaseClient();
      if (!client) return { ok: false, message: "Ownership transfer is unavailable until Supabase is configured." };
      const { data, error } = await client.rpc("transfer_community_ownership", {
        target_community_id: community.id,
        target_new_owner_id: targetUserId,
        confirmation_community_name: confirmationName.trim(),
      });
      const row = data?.[0];
      if (error || !row) return { ok: false, message: "Picom could not complete the ownership transfer." };
      transferredAt = row.transferred_at;
    }

    const next: OwnershipTransferStatus = {
      communityId: community.id,
      transferredAt,
      fromUserId: currentUser.userId,
      toUserId: validation.data.userId,
      targetDisplayName: validation.data.displayName,
      status: "completed",
      message: `Ownership transferred to ${validation.data.displayName}.`,
    };
    writeStore({ ...readStore(), [community.id]: next });
    return { ok: true, data: next };
  },
};
