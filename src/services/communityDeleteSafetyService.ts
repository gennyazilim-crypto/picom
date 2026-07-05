import type { Community, Member } from "../types/community";

const STORAGE_KEY = "picom.communityDeleteSafety.v1";
const SCHEMA_VERSION = 1;

export type CommunityDeleteSafetyStatus = Readonly<{
  communityId: string;
  requestedAt: string;
  requestedByUserId: string;
  status: "soft_delete_placeholder";
  message: string;
}>;

type StoredCommunityDeleteSafety = Record<string, CommunityDeleteSafetyStatus>;

export type CommunityDeleteSafetyResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function readStore(): StoredCommunityDeleteSafety {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredCommunityDeleteSafety };
    if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.records) return {};
    return parsed.records;
  } catch {
    return {};
  }
}

function writeStore(records: StoredCommunityDeleteSafety): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function isOwner(community: Community, member: Member): boolean {
  return community.roles.find((role) => role.id === member.roleId)?.name === "Owner";
}

export const communityDeleteSafetyService = {
  getStatus(communityId: string): CommunityDeleteSafetyStatus | null {
    return readStore()[communityId] ?? null;
  },

  requestSoftDeletePlaceholder(community: Community, currentUser: Member, confirmationName: string): CommunityDeleteSafetyResult<CommunityDeleteSafetyStatus> {
    if (!isOwner(community, currentUser)) {
      return {
        ok: false,
        message: "Only the community owner can prepare a delete placeholder.",
      };
    }

    if (confirmationName.trim() !== community.name) {
      return {
        ok: false,
        message: "Type the exact community name before preparing the delete placeholder.",
      };
    }

    const next: CommunityDeleteSafetyStatus = {
      communityId: community.id,
      requestedAt: new Date().toISOString(),
      requestedByUserId: currentUser.userId,
      status: "soft_delete_placeholder",
      message: "Community delete placeholder recorded locally. The community was not deleted.",
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

  clearPlaceholder(communityId: string): CommunityDeleteSafetyResult<{ message: string }> {
    const records = readStore();
    delete records[communityId];
    writeStore(records);

    return {
      ok: true,
      data: {
        message: "Community delete placeholder cleared.",
      },
    };
  },
};