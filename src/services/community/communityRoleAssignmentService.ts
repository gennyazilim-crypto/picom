import type { Community, Member, Role } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import { canAssignCommunityRole, canManageCommunityRole, getAssignedCommunityRoles, getRolePosition, hasCommunityPermission, isOwnerRole } from "../permissions/communityPermissions";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

type AssignmentResult = { ok: true; data: Member } | { ok: false; error: { code: string; message: string } };

function safeError(message?: string): AssignmentResult {
  if (message?.includes("ROLE_HIERARCHY_DENIED")) return { ok: false, error: { code: "ROLE_HIERARCHY_DENIED", message: "You cannot manage an equal or higher role." } };
  if (message?.includes("OWNER_ROLE_TRANSFER_REQUIRED")) return { ok: false, error: { code: "OWNER_ROLE_TRANSFER_REQUIRED", message: "Use ownership transfer to change the Owner role." } };
  if (message?.includes("ROLE_ASSIGNMENT_INVALID")) return { ok: false, error: { code: "ROLE_ASSIGNMENT_INVALID", message: "That member or role is no longer available." } };
  if (message?.includes("PERMISSION_DENIED")) return { ok: false, error: { code: "PERMISSION_DENIED", message: "You do not have permission to assign this role." } };
  if (message?.includes("SELF_ROLE_CHANGE_FORBIDDEN")) return { ok: false, error: { code: "SELF_ROLE_CHANGE_FORBIDDEN", message: "You cannot change your own roles." } };
  if (message?.includes("MEMBER_UNAVAILABLE")) return { ok: false, error: { code: "MEMBER_UNAVAILABLE", message: "This member left, was banned, or is no longer available." } };
  if (message?.includes("PERMISSION_DELEGATION_DENIED")) return { ok: false, error: { code: "PERMISSION_DELEGATION_DENIED", message: "You cannot grant a permission you do not have." } };
  return { ok: false, error: { code: "ROLE_ASSIGNMENT_FAILED", message: "Picom could not update this member's role." } };
}

export const communityRoleAssignmentService = {
  async setRoles(input: { community: Community; access: CommunityAccess; member: Member; roles: Role[]; reason?: string }): Promise<AssignmentResult> {
    if (!input.roles.length || input.member.userId === input.access.userId || input.member.userId === input.community.ownerId) return safeError(input.member.userId === input.access.userId ? "SELF_ROLE_CHANGE_FORBIDDEN" : "OWNER_ROLE_TRANSFER_REQUIRED");
    const currentRoles = getAssignedCommunityRoles(input.member, input.community);
    if (input.roles.some(isOwnerRole) || [...currentRoles, ...input.roles].some((role) => !canManageCommunityRole(input.access, role))) return safeError("ROLE_HIERARCHY_DENIED");
    if (!input.access.isOwner && input.roles.some((role) => (role.capabilities ?? []).some((permission) => !hasCommunityPermission(input.access, permission as CommunityAccess["permissions"][number])))) return safeError("PERMISSION_DELEGATION_DENIED");
    const primaryRole = [...input.roles].sort((a, b) => getRolePosition(b) - getRolePosition(a))[0];
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { ...input.member, roleId: primaryRole.id, roleIds: input.roles.map((role) => role.id) } };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.rpc("set_community_member_roles", { target_community_id: input.community.id, target_member_id: input.member.id, target_role_ids: input.roles.map((role) => role.id), change_reason: input.reason?.trim().slice(0, 300) || `Updated roles for ${input.member.displayName}` });
    const assignment = data?.[0];
    if (error || !assignment) return safeError(error?.message);
    return { ok: true, data: { ...input.member, roleId: assignment.primary_role_id, roleIds: assignment.role_ids } };
  },
  async assignRole(input: { community: Community; access: CommunityAccess; member: Member; role: Role; reason?: string }): Promise<AssignmentResult> {
    if (!canAssignCommunityRole(input.access, input.community, input.member, input.role)) return safeError("ROLE_HIERARCHY_DENIED");
    return this.setRoles({ ...input, roles: [input.role] });
  },
  subscribe(communityId: string, onChange: (change: { memberId: string; roleIds: string[]; primaryRoleId: string | null }) => void): () => void {
    if (dataSourceService.getStatus().isMock) return () => undefined;
    const client = getSupabaseClient(); if (!client) return () => undefined;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const refresh = (memberId: string) => { const existing = timers.get(memberId); if (existing) clearTimeout(existing); timers.set(memberId, setTimeout(() => { timers.delete(memberId); void client.from("community_member_roles").select("role_id, is_primary").eq("member_id", memberId).then(({ data }) => { const assignments = data ?? []; onChange({ memberId, roleIds: assignments.map((row) => row.role_id), primaryRoleId: assignments.find((row) => row.is_primary)?.role_id ?? assignments[0]?.role_id ?? null }); }); }, 80)); };
    const channel = client.channel(`community:member-roles:${communityId}`).on("postgres_changes", { event: "*", schema: "public", table: "community_member_roles", filter: `community_id=eq.${communityId}` }, (payload) => { const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { member_id?: string }; if (row.member_id) refresh(row.member_id); }).subscribe();
    return () => { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); void client.removeChannel(channel); };
  },
};
