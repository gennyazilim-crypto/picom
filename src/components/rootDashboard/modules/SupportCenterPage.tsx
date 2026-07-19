import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SupportCenterPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [ticketId, setTicketId] = useState("");
  const [status, setStatus] = useState("open");
  const [assigneeId, setAssigneeId] = useState("");

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="support_tickets"
      title="Support Center"
      purpose="Ticket intake, SLA queues, and customer support case routing."
      summaryModule="support"
      summaryLabels={{ open: "Open tickets", urgent: "Urgent open", resolved_24h: "Resolved / 24h" }}
      emptyMessage="No support tickets yet. Tickets appear here once the support system receives intake."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Create ticket"
            submitLabel="Create"
            onSuccess={() => { setSubject(""); refresh(); }}
            onSubmit={() => rootDashboardMutationService.createSupportTicket(access, { subject, category, priority })}
          >
            <FieldLabel label="Subject">
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} />
            </FieldLabel>
            <FieldLabel label="Category">
              <input value={category} onChange={(event) => setCategory(event.target.value)} />
            </FieldLabel>
            <FieldLabel label="Priority">
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Update status"
            submitLabel="Update"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.updateSupportTicketStatus(access, { ticketId, status })}
          >
            <FieldLabel label="Ticket id">
              <input value={ticketId} onChange={(event) => setTicketId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Status">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="open">open</option>
                <option value="pending">pending</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Assign ticket"
            submitLabel="Assign"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.assignSupportTicket(access, { ticketId, assigneeId })}
          >
            <FieldLabel label="Ticket id">
              <input value={ticketId} onChange={(event) => setTicketId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Assignee user id">
              <input value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
