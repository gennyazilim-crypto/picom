import { useEffect, useMemo, useState } from "react";
import type { Community, Role } from "../../types/community";
import type { CommunityAccess, CommunityPermissionKey } from "../../types/communityAccess";
import { communityRoleManagementService, type CommunityRoleDraft } from "../../services/community/communityRoleManagementService";
import { ALL_COMMUNITY_PERMISSION_KEYS, getPermissionGroupsForKind } from "../../services/permissions/communityPermissionCatalog";
import { canDeleteCommunityRole, canManageCommunityRole, getDefaultCommunityRolePermissions, getRolePosition, hasCommunityPermission, isOwnerRole } from "../../services/permissions/communityPermissions";
import { AppIcon, type IconName } from "../AppIcon";
import "./CommunityRoleManagement.css";

const ROLE_COLORS = ["#007571", "#10A7A0", "#2F7ABF", "#6E63B8", "#C56D2D", "#B9475A", "#687782"] as const;
const ROLE_ICONS: Array<{ value: string; label: string; icon: IconName }> = [
  { value: "", label: "No icon", icon: "user" }, { value: "user", label: "Member", icon: "user" }, { value: "lock", label: "Shield", icon: "lock" }, { value: "headphones", label: "Audio", icon: "headphones" }, { value: "microphone", label: "Host", icon: "microphone" },
];

function rolePermissions(role: Role, community: Community): CommunityPermissionKey[] {
  if (role.permissionValues) return ALL_COMMUNITY_PERMISSION_KEYS.filter((key) => role.permissionValues?.[key] === true);
  return [...new Set([...(role.capabilities ?? []).filter((key): key is CommunityPermissionKey => ALL_COMMUNITY_PERMISSION_KEYS.includes(key as CommunityPermissionKey)), ...getDefaultCommunityRolePermissions(role, community.kind)])];
}
function draftFromRole(role: Role, community: Community): CommunityRoleDraft { return { name: role.name, color: role.color, icon: role.icon, level: role.level, capabilities: rolePermissions(role, community) }; }

export function CommunityRoleManagement({ community, access, onRolesChanged }: { community: Community; access: CommunityAccess; onRolesChanged: (roles: Role[]) => void }) {
  const sortedRoles = useMemo(() => [...community.roles].sort((a, b) => (b.displayOrder ?? b.level * 100) - (a.displayOrder ?? a.level * 100) || b.level - a.level), [community.roles]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(sortedRoles[0]?.id ?? null);
  const selectedRole = community.roles.find((role) => role.id === selectedRoleId) ?? null;
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CommunityRoleDraft>(() => selectedRole ? draftFromRole(selectedRole, community) : { name: "New role", color: ROLE_COLORS[0], level: 10, capabilities: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const groups = useMemo(() => getPermissionGroupsForKind(community.kind), [community.kind]);
  const canCreate = hasCommunityPermission(access, "manageRoles");
  const canEdit = creating ? canCreate : Boolean(selectedRole && canManageCommunityRole(access, selectedRole));
  const actorPosition = access.isOwner ? 101 : getRolePosition(access.role);
  const selectedIndex = selectedRole ? sortedRoles.findIndex((role) => role.id === selectedRole.id) : -1;

  useEffect(() => { if (!creating && selectedRole) setDraft(draftFromRole(selectedRole, community)); }, [community, creating, selectedRole]);
  useEffect(() => { if (!selectedRole && sortedRoles[0]) setSelectedRoleId(sortedRoles[0].id); }, [selectedRole, sortedRoles]);

  const beginCreate = () => { setCreating(true); setSelectedRoleId(null); setDraft({ name: "New role", color: ROLE_COLORS[0], level: Math.max(0, Math.min(50, actorPosition - 1)), capabilities: community.kind === "text" ? ["viewChannel", "sendMessages", "addReactions", "viewVoiceRoom", "joinVoiceRoom", "publishAudio"] : community.kind === "radio" ? ["viewRadioContent", "listenRadio"] : ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts"] }); setMessage(null); };
  const chooseRole = (role: Role) => { setCreating(false); setSelectedRoleId(role.id); setDraft(draftFromRole(role, community)); setMessage(null); };
  const togglePermission = (permission: CommunityPermissionKey) => setDraft((current) => ({ ...current, capabilities: current.capabilities.includes(permission) ? current.capabilities.filter((key) => key !== permission) : [...current.capabilities, permission] }));
  const applyResult = (result: Awaited<ReturnType<typeof communityRoleManagementService.createRole>>, success: string) => { if (result.ok) { onRolesChanged(result.data.roles); setCreating(false); setSelectedRoleId(result.data.selectedRoleId ?? result.data.roles[0]?.id ?? null); setMessage({ tone: "success", text: success }); } else setMessage({ tone: "error", text: result.error.message }); };
  const save = async () => { setBusy(true); setMessage(null); const reason = creating ? `Created role ${draft.name.trim()}` : `Updated role ${selectedRole?.name ?? draft.name.trim()}`; const result = creating ? await communityRoleManagementService.createRole({ community, access, draft, reason }) : selectedRole ? await communityRoleManagementService.updateRole({ community, access, role: selectedRole, draft, reason }) : null; if (result) applyResult(result, creating ? "Role created." : "Role changes saved."); setBusy(false); };
  const duplicate = async () => { if (!selectedRole) return; setBusy(true); applyResult(await communityRoleManagementService.duplicateRole({ community, access, role: selectedRole }), "Role duplicated."); setBusy(false); };
  const remove = async () => { if (!selectedRole || !window.confirm(`Delete ${selectedRole.name}? This cannot be undone.`)) return; setBusy(true); applyResult(await communityRoleManagementService.deleteRole({ community, access, role: selectedRole }), "Role deleted."); setBusy(false); };
  const move = async (direction: "up" | "down") => { if (!selectedRole) return; const adjacent = sortedRoles[selectedIndex + (direction === "up" ? -1 : 1)]; if (!adjacent) return; setBusy(true); applyResult(await communityRoleManagementService.swapRoleOrder({ community, access, role: selectedRole, adjacentRole: adjacent }), "Role order saved."); setBusy(false); };
  const ownerRole = selectedRole ? isOwnerRole(selectedRole) : false;
  const iconOption = ROLE_ICONS.find((option) => option.value === draft.icon) ?? ROLE_ICONS[0];

  return <div className="community-role-management">
    <aside className="community-role-list" aria-label="Role hierarchy">
      <header><div><strong>Hierarchy</strong><span>Higher levels manage only lower levels.</span></div><button type="button" disabled={!canCreate || busy} onClick={beginCreate}><AppIcon name="plus" size="sm" /> New role</button></header>
      <div>{sortedRoles.map((role) => <button key={role.id} type="button" className={selectedRoleId === role.id ? "active" : ""} onClick={() => chooseRole(role)}><i style={{ background: role.color }} />{role.icon ? <AppIcon name={(ROLE_ICONS.find((option) => option.value === role.icon)?.icon ?? "user")} size="sm" /> : null}<span><strong>{role.name}</strong><small>{role.systemKey ? `${role.systemKey} system role` : "Custom role"}</small></span><em>{role.level}</em></button>)}</div>
    </aside>
    <section className="community-role-editor" aria-label={creating ? "Create role" : `Edit ${selectedRole?.name ?? "role"}`}>
      <header><div><p className="eyebrow">{creating ? "New access profile" : ownerRole ? "Protected owner role" : "Role editor"}</p><h4>{creating ? "Create role" : selectedRole?.name}</h4><span>{canEdit ? "Changes are validated by the server hierarchy and audit boundary." : "You can inspect this role but cannot change it."}</span></div>{selectedRole ? <div className="community-role-order-actions"><button type="button" disabled={busy || selectedIndex <= 0 || !canEdit || !canManageCommunityRole(access, sortedRoles[selectedIndex - 1])} onClick={() => void move("up")}>Move up</button><button type="button" disabled={busy || selectedIndex < 0 || selectedIndex >= sortedRoles.length - 1 || !canEdit || !canManageCommunityRole(access, sortedRoles[selectedIndex + 1])} onClick={() => void move("down")}>Move down</button></div> : null}</header>
      <div className="community-role-fields"><label><span>Name</span><input value={draft.name} maxLength={40} disabled={!canEdit || ownerRole} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Hierarchy level</span><input type="number" min={0} max={Math.max(0, actorPosition - 1)} value={draft.level} disabled={!canEdit || Boolean(selectedRole?.systemKey)} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })} /></label><label><span>Optional icon</span><select value={draft.icon ?? ""} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, icon: event.target.value || undefined })}>{ROLE_ICONS.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></label><div className="community-role-icon-preview" aria-label={`Icon: ${iconOption.label}`}><AppIcon name={iconOption.icon} size="lg" /></div></div>
      <div className="community-role-colors" aria-label="Role color tokens">{ROLE_COLORS.map((color) => <button key={color} type="button" className={draft.color.toLowerCase() === color.toLowerCase() ? "active" : ""} style={{ background: color }} aria-label={`Use role color ${color}`} disabled={!canEdit} onClick={() => setDraft({ ...draft, color })} />)}<label><span>Custom</span><input type="color" value={draft.color} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label></div>
      <div className="community-permission-groups">{groups.map((group) => <fieldset key={group.name}><legend>{group.name}</legend>{group.permissions.map((permission) => { const checked = ownerRole || draft.capabilities.includes(permission.key); const canDelegate = access.isOwner || hasCommunityPermission(access, permission.key); return <label key={permission.key}><span><strong>{permission.label}</strong><small>{permission.description}</small></span><input type="checkbox" checked={checked} disabled={!canEdit || ownerRole || !canDelegate} onChange={() => togglePermission(permission.key)} /></label>; })}</fieldset>)}</div>
      {message ? <p className={`community-role-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
      <footer><div><button type="button" disabled={!selectedRole || !canEdit || ownerRole || busy} onClick={() => void duplicate()}><AppIcon name="plus" size="sm" /> Duplicate</button><button className="danger" type="button" disabled={!selectedRole || busy || !canDeleteCommunityRole(access, community, selectedRole)} onClick={() => void remove()}><AppIcon name="trash" size="sm" /> Delete</button></div><button className="primary" type="button" disabled={!canEdit || busy || !draft.name.trim() || draft.level >= actorPosition} onClick={() => void save()}>{busy ? "Saving..." : creating ? "Create role" : "Save role"}</button></footer>
    </section>
  </div>;
}
