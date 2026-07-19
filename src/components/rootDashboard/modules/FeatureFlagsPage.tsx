import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { withPrivilegedStepUp } from "../../../services/rootDashboard/rootDashboardStepUp";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function FeatureFlagsPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [flagKey, setFlagKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState("");

  return (
    <RootDashboardModuleListPage
      access={access}
      section="feature_flags"
      title="Feature Flags"
      purpose="Remote flag control plane. Client defaults still apply when a flag is not configured server-side."
      emptyMessage="No remote feature flags configured in the database yet."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Upsert feature flag"
            submitLabel="Save flag"
            onSuccess={() => {
              setFlagKey("");
              setDescription("");
              setReloadToken((value) => value + 1);
            }}
            onSubmit={() => withPrivilegedStepUp(access, "flags.write", (challengeId) => (
              rootDashboardMutationService.upsertRemoteFeatureFlag(access, {
                flagKey,
                enabled,
                description,
                stepUpChallengeId: challengeId,
              })
            ))}
          >
            <FieldLabel label="Flag key">
              <input value={flagKey} onChange={(event) => setFlagKey(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Enabled">
              <select value={enabled ? "true" : "false"} onChange={(event) => setEnabled(event.target.value === "true")}>
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Description">
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
