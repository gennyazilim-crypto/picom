import { useEffect, useMemo, useState } from "react";
import type { Community, Member, Role } from "../../types/community";
import type { CommunityAccess, CommunityPermissionKey } from "../../types/communityAccess";
import { communityRoleAssignmentService } from "../../services/community/communityRoleAssignmentService";
import { ALL_COMMUNITY_PERMISSION_KEYS, getPermissionGroupsForKind } from "../../services/permissions/communityPermissionCatalog";
import { canManageCommunityRole, getAssignedCommunityRoles, getDefaultCommunityRolePermissions, getRolePosition, isOwnerRole } from "../../services/permissions/communityPermissions";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import "./CommunityMemberRoleAssignment.css";

function effectivePermissions(roles: readonly Role[], community: Community): Set<CommunityPermissionKey> {
  const values = new Set<CommunityPermissionKey>();
  for (const role of roles) {
    for (const key of getDefaultCommunityRolePermissions(role, community.kind)) values.add(key);
    for (const key of role.capabilities ?? []) if (ALL_COMMUNITY_PERMISSION_KEYS.includes(key as CommunityPermissionKey)) values.add(key as CommunityPermissionKey);
    if (role.permissionValues) for (const [key, allowed] of Object.entries(role.permissionValues)) if (allowed && ALL_COMMUNITY_PERMISSION_KEYS.includes(key as CommunityPermissionKey)) values.add(key as CommunityPermissionKey);
  }
  return values;
}

function MemberRoleDialog({ community, access, member, onClose, onSaved }: { community: Community; access: CommunityAccess; member: Member; onClose: () => void; onSaved: (member: Member) => void }) {
  const current = getAssignedCommunityRoles(member, community);
  const [selectedIds, setSelectedIds] = useState(() => new Set(current.map((role) => role.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRoles = community.roles.filter((role) => selectedIds.has(role.id));
  const permissions = effectivePermissions(selectedRoles, community);
  const groups = getPermissionGroupsForKind(community.kind).map((group) => ({ ...group, permissions: group.permissions.filter((permission) => permissions.has(permission.key)) })).filter((group) => group.permissions.length);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  const toggle = (role: Role) => { if (!canManageCommunityRole(access, role) || isOwnerRole(role)) return; setSelectedIds((currentIds) => { const next = new Set(currentIds); if (next.has(role.id)) next.delete(role.id); else next.add(role.id); return next; }); };
  const save = async () => { setBusy(true); setError(null); const result = await communityRoleAssignmentService.setRoles({ community, access, member, roles: selectedRoles, reason: `Updated assigned roles for ${member.displayName}` }); if (result.ok) onSaved(result.data); else setError(result.error.message); setBusy(false); };
  return <div className="modal-backdrop member-role-dialog-backdrop" onMouseDown={onClose}><section className="member-role-dialog" role="dialog" aria-modal="true" aria-labelledby="member-role-dialog-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Member access</p><h3 id="member-role-dialog-title">Roles for {member.displayName}</h3><span>One member at a time. Effective access updates immediately after the audited save.</span></div><button className="icon-button" type="button" aria-label="Close role assignment" onClick={onClose}><AppIcon name="close" size="md" /></button></header><div className="member-role-dialog-body"><section><h4>Assigned and available roles</h4><div className="member-role-options">{[...community.roles].sort((a,b)=>getRolePosition(b)-getRolePosition(a)).map((role) => { const manageable = canManageCommunityRole(access, role) && !isOwnerRole(role); const checked = selectedIds.has(role.id); return <label key={role.id} className={!manageable ? "protected" : ""}><i style={{ background: role.color }} /><span><strong>{role.name}</strong><small>Hierarchy {role.level}{role.systemKey ? ` · ${role.systemKey}` : " · custom"}</small></span><input type="checkbox" checked={checked} disabled={!manageable} onChange={() => toggle(role)} /></label>; })}</div></section><section className="member-effective-access"><h4>Effective permission summary</h4>{groups.length ? groups.map((group) => <article key={group.name}><strong>{group.name}</strong><div>{group.permissions.map((permission) => <span key={permission.key}>{permission.label}</span>)}</div></article>) : <p>No permissions are granted by the selected roles.</p>}</section></div>{error ? <p className="member-role-error" role="alert">{error}</p> : null}<footer><span>{selectedRoles.length} role{selectedRoles.length === 1 ? "" : "s"} selected</span><div><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={busy || !selectedRoles.length} onClick={() => void save()}>{busy ? "Saving..." : "Save roles"}</button></div></footer></section></div>;
}

export function CommunityMemberRoleAssignment({ community, access, onMemberRolesChanged }: { community: Community; access: CommunityAccess; onMemberRolesChanged: (memberId: string, roleIds: string[], primaryRoleId: string) => void }) {
  const [target, setTarget] = useState<Member | null>(null);
  useEffect(() => communityRoleAssignmentService.subscribe(community.id, ({ memberId, roleIds, primaryRoleId }) => { if (primaryRoleId) onMemberRolesChanged(memberId, roleIds, primaryRoleId); }), [community.id, onMemberRolesChanged]);
  const rows = useMemo(() => community.members.map((member) => ({ member, roles: getAssignedCommunityRoles(member, community) })), [community]);
  const canManage = (member: Member, roles: Role[]) => member.userId !== access.userId && member.userId !== community.ownerId && roles.every((role) => canManageCommunityRole(access, role));
  const saved = (member: Member) => { onMemberRolesChanged(member.id, member.roleIds ?? [member.roleId], member.roleId); setTarget(null); };
  return <><div className="community-admin-member-list member-role-list">{rows.map(({ member, roles }) => <article key={member.id}><MemberAvatar member={member} size={36} /><div><strong>{member.displayName}</strong><span>@{member.username}</span><div className="member-role-chips">{roles.map((role) => <em key={role.id} style={{ borderColor: role.color }}>{role.name}</em>)}</div></div><button type="button" disabled={!canManage(member, roles)} title={member.userId === access.userId ? "You cannot change your own roles" : member.userId === community.ownerId ? "Ownership uses the transfer workflow" : undefined} onClick={() => setTarget(member)}>Manage roles</button></article>)}</div>{target ? <MemberRoleDialog community={community} access={access} member={target} onClose={() => setTarget(null)} onSaved={saved} /> : null}</>;
}
