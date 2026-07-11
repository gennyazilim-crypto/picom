import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711001400_radio_roles_moderation_audit.sql");
const types = read("src/types/communityAccess.ts");
const permissions = read("src/services/permissions/communityPermissions.ts");
const dataSource = read("src/services/audio/audioDataSource.ts");
const repository = read("src/services/audio/radioRepository.ts");
const service = read("src/services/audio/radioService.ts");
const panel = read("src/components/audio/RadioHostProducerPanel.tsx");
const teamPanel = read("src/components/audio/RadioProductionTeamPanel.tsx");

const checks = [
  ["common producer role", migration.includes("'Radio Producer'") && migration.includes("\"manageRadioHosts\":true")],
  ["typed host capability", types.includes('"manageRadioHosts"') && permissions.includes('"manageRadioHosts"')],
  ["host scope narrowed", migration.includes("role.permissions - 'manageRadioSchedule' - 'manageRadioPrograms'")],
  ["session manager requires common role", migration.includes("create or replace function public.can_manage_radio_session") && migration.includes("role.permissions ->> 'hostRadio' = 'true'")],
  ["assignment hierarchy", migration.includes("can_assign_radio_session_host") && migration.includes("target_role.level < actor_level")],
  ["common role required", migration.includes("is_radio_assignment_capable") && migration.includes("RADIO_HOST_COMMON_ROLE_REQUIRED")],
  ["primary host protected", migration.includes("protect_radio_primary_host") && migration.includes("RADIO_PRIMARY_HOST_TRANSFER_REQUIRED")],
  ["host removal audited", migration.includes("remove_radio_session_host") && migration.includes("'radio_host_removal'")],
  ["listener hierarchy", migration.includes("can_moderate_radio_listener_target") && migration.includes("RADIO_LISTENER_HIERARCHY_DENIED")],
  ["direct host writes revoked", migration.includes("revoke insert, update, delete on table public.radio_session_hosts from authenticated")],
  ["session audit projection", migration.includes("list_radio_session_audit") && migration.includes("target_id = target_session.id")],
  ["mock parity", dataSource.includes("canMockManageHostAssignment") && dataSource.includes("canMockModerateListener") && dataSource.includes("auditLogService.append")],
  ["service layer", repository.includes("removeHost") && repository.includes("listAudit") && service.includes("getRadioAuditHistory")],
  ["production team UI", teamPanel.includes("Role-backed assignments") && teamPanel.includes("Confirm removal") && teamPanel.includes("Recent protected actions")],
  ["listener report UI", panel.includes("reportService.submitReport") && panel.includes("Equal or higher roles cannot be moderated")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [label] of failed) console.error("FAIL:", label);
  process.exit(1);
}
for (const [label] of checks) console.log("PASS:", label);
console.log("Radio role, moderation, and audit contract passed.");
