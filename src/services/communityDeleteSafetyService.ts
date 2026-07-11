import type { Community, Member } from "../types/community";
import { authService } from "./authService";
import { auditLogService } from "./auditLogService";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityDeleteSafety.v3";
const SCHEMA_VERSION = 3;
const MIN_REASON_LENGTH = 10;

export type CommunityDeleteSafetyStatus = Readonly<{
  communityId: string;
  archivedAt: string;
  archivedByUserId: string;
  status: "archived";
  message: string;
}>;

type StoredCommunityArchives = Record<string, CommunityDeleteSafetyStatus>;
export type CommunityDeleteSafetyResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; message: string }>;

function readStore(): StoredCommunityArchives {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredCommunityArchives };
    return parsed.schemaVersion === SCHEMA_VERSION && parsed.records ? parsed.records : {};
  } catch {
    return {};
  }
}

function writeStore(records: StoredCommunityArchives): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
  } catch {
    // Restricted desktop fallback: completion still remains in component state.
  }
}

function isOwner(community: Community, member: Member): boolean {
  return community.roles.find((role) => role.id === member.roleId)?.name === "Owner";
}

export const communityDeleteSafetyService = {
  getStatus(communityId: string): CommunityDeleteSafetyStatus | null {
    return readStore()[communityId] ?? null;
  },

  async archiveCommunity(community: Community, currentUser: Member, confirmationName: string, reason: string, currentPassword: string): Promise<CommunityDeleteSafetyResult<CommunityDeleteSafetyStatus>> {
    if (!isOwner(community, currentUser)) return { ok: false, message: "Only the community owner can archive this community." };
    if (confirmationName.trim() !== community.name) return { ok: false, message: "Type the exact community name before archiving it." };
    const cleanReason = reason.trim();
    if (cleanReason.length < MIN_REASON_LENGTH || cleanReason.length > 500) return { ok: false, message: "Provide an archive reason between 10 and 500 characters." };

    const reauthentication = await authService.reauthenticateCurrentUser(currentPassword);
    if (!reauthentication.ok) return { ok: false, message: reauthentication.error.message };

    let archivedAt = new Date().toISOString();
    if (!dataSourceService.getStatus().isMock) {
      const client = getSupabaseClient();
      if (!client) return { ok: false, message: "Community archive is unavailable until Supabase is configured." };
      const { data, error } = await client.rpc("archive_community", {
        target_community_id: community.id,
        confirmation_community_name: confirmationName.trim(),
        archive_reason: cleanReason,
      });
      const row = data?.[0];
      if (error || !row) return { ok: false, message: "Picom could not archive the community safely. No lifecycle changes were applied." };
      archivedAt = row.archived_at;
    } else {
      const audit = await auditLogService.append({
        communityId: community.id,
        actorId: currentUser.userId,
        actionType: "community_update",
        targetType: "community_archive",
        targetId: community.id,
        reason: cleanReason,
      });
      if (!audit.ok) return { ok: false, message: "Community archive could not be audited, so no mock completion was recorded." };
    }

    const next: CommunityDeleteSafetyStatus = {
      communityId: community.id,
      archivedAt,
      archivedByUserId: currentUser.userId,
      status: "archived",
      message: "Community archived. Content and append-only audit history were retained for controlled recovery.",
    };
    writeStore({ ...readStore(), [community.id]: next });
    return { ok: true, data: next };
  },
};
