import type { Community, Member, Role } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import { canAssignCommunityRole } from "../permissions/communityPermissions";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

type AssignmentResult = { ok: true; data: Member } | { ok: false; error: { code: string; message: string } };

function safeError(message?: string): AssignmentResult {
  if (message?.includes("ROLE_HIERARCHY_DENIED")) return { ok: false, error: { code: "ROLE_HIERARCHY_DENIED", message: "You cannot manage an equal or higher role." } };
  if (message?.includes("OWNER_ROLE_TRANSFER_REQUIRED")) return { ok: false, error: { code: "OWNER_ROLE_TRANSFER_REQUIRED", message: "Use ownership transfer to change the Owner role." } };
  if (message?.includes("ROLE_ASSIGNMENT_INVALID")) return { ok: false, error: { code: "ROLE_ASSIGNMENT_INVALID", message: "That member or role is no longer available." } };
  if (message?.includes("PERMISSION_DENIED")) return { ok: false, error: { code: "PERMISSION_DENIED", message: "You do not have permission to assign this role." } };
  return { ok: false, error: { code: "ROLE_ASSIGNMENT_FAILED", message: "Picom could not update this member's role." } };
}

export const communityRoleAssignmentService = {
  async assignRole(input: { community: Community; access: CommunityAccess; member: Member; role: Role; reason?: string }): Promise<AssignmentResult> {
    if (!canAssignCommunityRole(input.access, input.community, input.member, input.role)) return safeError("ROLE_HIERARCHY_DENIED");
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { ...input.member, roleId: input.role.id } };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.rpc("assign_community_member_role", {
      target_community_id: input.community.id,
      target_member_id: input.member.id,
      target_role_id: input.role.id,
      change_reason: input.reason?.trim().slice(0, 300) || "Role assigned in community admin panel",
    });
    const membership = data?.[0];
    if (error || !membership) return safeError(error?.message);
    return { ok: true, data: { ...input.member, roleId: membership.role_id } };
  },
};
