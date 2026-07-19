import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { withPrivilegedStepUp } from "../../../services/rootDashboard/rootDashboardStepUp";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function RolesPermissionsPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [userId, setUserId] = useState("");
  const [roleKey, setRoleKey] = useState("support_agent");
  const [assignmentId, setAssignmentId] = useState("");

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="role_assignments"
      title="Roles & Permissions"
      purpose="Root capability matrix and staff role assignment."
      emptyMessage="No active platform role assignments."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Assign role"
            submitLabel="Assign"
            onSuccess={() => { setUserId(""); refresh(); }}
            onSubmit={() => withPrivilegedStepUp(access, "roles.manage", (challengeId) => (
              rootDashboardMutationService.assignPlatformRole(access, {
                userId,
                roleKey,
                stepUpChallengeId: challengeId,
              })
            ))}
          >
            <FieldLabel label="User id">
              <input value={userId} onChange={(event) => setUserId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Role key">
              <input value={roleKey} onChange={(event) => setRoleKey(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Revoke assignment"
            submitLabel="Revoke"
            onSuccess={() => { setAssignmentId(""); refresh(); }}
            onSubmit={() => withPrivilegedStepUp(access, "roles.manage", (challengeId) => (
              rootDashboardMutationService.revokePlatformRole(access, {
                assignmentId,
                stepUpChallengeId: challengeId,
              })
            ))}
          >
            <FieldLabel label="Assignment id">
              <input value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
