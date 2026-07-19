import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function IncidentsPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("sev3");
  const [publicMessage, setPublicMessage] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [status, setStatus] = useState("investigating");

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="incidents"
      title="Incidents"
      purpose="Incident declaration, severity, timelines, and status pages."
      summaryModule="incidents"
      summaryLabels={{ open: "Open incidents", sev1: "SEV1 open" }}
      emptyMessage="No platform incidents recorded."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Declare incident"
            submitLabel="Create"
            onSuccess={() => { setTitle(""); setPublicMessage(""); refresh(); }}
            onSubmit={() => rootDashboardMutationService.createPlatformIncident(access, { title, severity, publicMessage })}
          >
            <FieldLabel label="Title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} />
            </FieldLabel>
            <FieldLabel label="Severity">
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="sev1">sev1</option>
                <option value="sev2">sev2</option>
                <option value="sev3">sev3</option>
                <option value="sev4">sev4</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Public message">
              <input value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} />
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Update status"
            submitLabel="Update"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.updatePlatformIncidentStatus(access, { incidentId, status })}
          >
            <FieldLabel label="Incident id">
              <input value={incidentId} onChange={(event) => setIncidentId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Status">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="investigating">investigating</option>
                <option value="identified">identified</option>
                <option value="monitoring">monitoring</option>
                <option value="resolved">resolved</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
