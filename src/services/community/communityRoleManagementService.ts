import type { Community, Role } from "../../types/community";
import type { CommunityAccess, CommunityPermissionKey } from "../../types/communityAccess";
import { ALL_COMMUNITY_PERMISSION_KEYS } from "../permissions/communityPermissionCatalog";
import { canDeleteCommunityRole, canManageCommunityRole, getRolePosition, hasCommunityPermission, isOwnerRole } from "../permissions/communityPermissions";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type CommunityRoleDraft = { name: string; color: string; icon?: string; level: number; capabilities: CommunityPermissionKey[] };
type RoleMutationResult = { ok: true; data: { roles: Role[]; selectedRoleId?: string } } | { ok: false; error: { code: string; message: string } };

function failure(code: string, message: string): RoleMutationResult { return { ok: false, error: { code, message } }; }
function permissionsObject(capabilities: readonly CommunityPermissionKey[]): Record<string, boolean> {
  const enabled = new Set(capabilities);
  return Object.fromEntries(ALL_COMMUNITY_PERMISSION_KEYS.map((key) => [key, enabled.has(key)]));
}
function normalizeRow(row: Record<string, unknown>): Role {
  const permissionValues = typeof row.permissions === "object" && row.permissions ? row.permissions as Record<string, boolean> : {};
  return { id: String(row.id), name: String(row.name), color: String(row.color), level: Number(row.level), capabilities: Object.entries(permissionValues).filter(([, allowed]) => allowed === true).map(([key]) => key), permissionValues, systemKey: row.system_key as Role["systemKey"], isDefault: Boolean(row.is_default), permissionsVersion: Number(row.permissions_version ?? 2), icon: typeof row.icon === "string" ? row.icon : undefined, displayOrder: Number(row.display_order ?? Number(row.level) * 100) };
}
function mergeRoles(roles: readonly Role[], changed: readonly Role[]): Role[] { const byId = new Map(roles.map((role) => [role.id, role])); for (const role of changed) byId.set(role.id, role); return [...byId.values()]; }
function firstRow(value: unknown): Record<string, unknown> | null { const row = Array.isArray(value) ? value[0] : value; return row && typeof row === "object" ? row as Record<string, unknown> : null; }
function rows(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : []; }
function safeName(base: string, roles: readonly Role[]): string { let name = `${base} copy`.slice(0, 40); let index = 2; const names = new Set(roles.map((role) => role.name.toLowerCase())); while (names.has(name.toLowerCase())) name = `${base} copy ${index++}`.slice(0, 40); return name; }
function validateDraft(access: CommunityAccess, draft: CommunityRoleDraft): RoleMutationResult | null {
  if (!hasCommunityPermission(access, "manageRoles")) return failure("PERMISSION_DENIED", "You do not have permission to manage roles.");
  if (!draft.name.trim() || draft.name.trim().length > 40 || !/^#[0-9a-f]{6}$/i.test(draft.color)) return failure("ROLE_INVALID", "Enter a role name and valid color.");
  const actorPosition = access.isOwner ? 101 : getRolePosition(access.role);
  if (draft.level < 0 || draft.level >= actorPosition || draft.level >= 100) return failure("ROLE_HIERARCHY_DENIED", "Role position must remain below your own role.");
  return null;
}
function errorResult(message?: string): RoleMutationResult {
  if (message?.includes("ROLE_HIERARCHY_DENIED")) return failure("ROLE_HIERARCHY_DENIED", "You cannot manage an equal or higher role.");
  if (message?.includes("PERMISSION_DELEGATION_DENIED")) return failure("PERMISSION_DELEGATION_DENIED", "You cannot grant a permission you do not have.");
  if (message?.includes("ROLE_IN_USE")) return failure("ROLE_IN_USE", "Move members to another role before deleting this role.");
  if (message?.includes("SYSTEM_ROLE_MUTATION_FORBIDDEN") || message?.includes("OWNER_ROLE")) return failure("SYSTEM_ROLE_MUTATION_FORBIDDEN", "This protected system role cannot be changed that way.");
  return failure("ROLE_MANAGEMENT_FAILED", "Picom could not save this role change.");
}

export const communityRoleManagementService = {
  async createRole(input: { community: Community; access: CommunityAccess; draft: CommunityRoleDraft; reason: string }): Promise<RoleMutationResult> {
    const invalid = validateDraft(input.access, input.draft); if (invalid) return invalid;
    if (dataSourceService.getStatus().isMock) { const role: Role = { id: crypto.randomUUID(), ...input.draft, name: input.draft.name.trim(), permissionValues: permissionsObject(input.draft.capabilities), displayOrder: Math.max(0, ...input.community.roles.map((item) => item.displayOrder ?? item.level * 100)) + 100 }; return { ok: true, data: { roles: [...input.community.roles, role], selectedRoleId: role.id } }; }
    const client = getSupabaseClient(); if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("create_community_role", { target_community_id: input.community.id, target_name: input.draft.name.trim(), target_color: input.draft.color, target_icon: input.draft.icon || null, target_level: input.draft.level, target_permissions: permissionsObject(input.draft.capabilities), change_reason: input.reason });
    const row = firstRow(data); if (error || !row) return errorResult(error?.message); const role = normalizeRow(row); return { ok: true, data: { roles: [...input.community.roles, role], selectedRoleId: role.id } };
  },
  async updateRole(input: { community: Community; access: CommunityAccess; role: Role; draft: CommunityRoleDraft; reason: string }): Promise<RoleMutationResult> {
    if (!canManageCommunityRole(input.access, input.role)) return failure("ROLE_HIERARCHY_DENIED", "You cannot edit this role."); const invalid = validateDraft(input.access, input.draft); if (invalid) return invalid;
    if (dataSourceService.getStatus().isMock) { const updated: Role = { ...input.role, ...input.draft, name: input.draft.name.trim(), permissionValues: permissionsObject(input.draft.capabilities) }; return { ok: true, data: { roles: mergeRoles(input.community.roles, [updated]), selectedRoleId: updated.id } }; }
    const client = getSupabaseClient(); if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("update_community_role", { target_community_id: input.community.id, target_role_id: input.role.id, target_name: input.draft.name.trim(), target_color: input.draft.color, target_icon: input.draft.icon || null, target_level: input.draft.level, target_permissions: permissionsObject(input.draft.capabilities), change_reason: input.reason });
    const row = firstRow(data); if (error || !row) return errorResult(error?.message); const updated = normalizeRow(row); return { ok: true, data: { roles: mergeRoles(input.community.roles, [updated]), selectedRoleId: updated.id } };
  },
  duplicateRole(input: { community: Community; access: CommunityAccess; role: Role }): Promise<RoleMutationResult> { const capabilities = (input.role.capabilities ?? []).filter((key): key is CommunityPermissionKey => ALL_COMMUNITY_PERMISSION_KEYS.includes(key as CommunityPermissionKey)); return this.createRole({ community: input.community, access: input.access, draft: { name: safeName(input.role.name, input.community.roles), color: input.role.color, icon: input.role.icon, level: Math.max(0, Math.min(input.role.level, (input.access.isOwner ? 100 : getRolePosition(input.access.role)) - 1)), capabilities }, reason: `Duplicated role ${input.role.name}` }); },
  async swapRoleOrder(input: { community: Community; access: CommunityAccess; role: Role; adjacentRole: Role }): Promise<RoleMutationResult> {
    if (!canManageCommunityRole(input.access, input.role) || !canManageCommunityRole(input.access, input.adjacentRole)) return failure("ROLE_HIERARCHY_DENIED", "You cannot reorder one of these roles.");
    if (dataSourceService.getStatus().isMock) { const firstOrder = input.role.displayOrder ?? input.role.level * 100; const secondOrder = input.adjacentRole.displayOrder ?? input.adjacentRole.level * 100; return { ok: true, data: { roles: mergeRoles(input.community.roles, [{ ...input.role, displayOrder: secondOrder }, { ...input.adjacentRole, displayOrder: firstOrder }]), selectedRoleId: input.role.id } }; }
    const client = getSupabaseClient(); if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("swap_community_role_order", { target_community_id: input.community.id, target_role_id: input.role.id, adjacent_role_id: input.adjacentRole.id, change_reason: `Reordered ${input.role.name} and ${input.adjacentRole.name}` });
    if (error) return errorResult(error.message); return { ok: true, data: { roles: mergeRoles(input.community.roles, rows(data).map(normalizeRow)), selectedRoleId: input.role.id } };
  },
  async deleteRole(input: { community: Community; access: CommunityAccess; role: Role }): Promise<RoleMutationResult> {
    if (!canDeleteCommunityRole(input.access, input.community, input.role) || isOwnerRole(input.role)) return failure("ROLE_DELETE_FORBIDDEN", "Protected, default, or assigned roles cannot be deleted.");
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { roles: input.community.roles.filter((role) => role.id !== input.role.id) } };
    const client = getSupabaseClient(); if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("delete_community_role", { target_community_id: input.community.id, target_role_id: input.role.id, change_reason: `Deleted role ${input.role.name}` });
    if (error || data !== true) return errorResult(error?.message); return { ok: true, data: { roles: input.community.roles.filter((role) => role.id !== input.role.id) } };
  },
};
