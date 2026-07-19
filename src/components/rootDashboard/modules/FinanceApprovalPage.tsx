import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { withPrivilegedStepUp } from "../../../services/rootDashboard/rootDashboardStepUp";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function FinanceApprovalPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [requestType, setRequestType] = useState("payout");
  const [amountCents, setAmountCents] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [requestId, setRequestId] = useState("");
  const [status, setStatus] = useState("approved");

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="finance_approvals"
      title="Finance Approvals"
      purpose="Scoped finance approval queue without payment card data."
      emptyMessage="No finance approval requests pending."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Create approval request"
            submitLabel="Create"
            onSuccess={() => { setAmountCents("0"); refresh(); }}
            onSubmit={() => rootDashboardMutationService.createFinanceApprovalRequest(access, {
              requestType,
              amountCents: Number(amountCents) || 0,
              currency,
            })}
          >
            <FieldLabel label="Request type">
              <input value={requestType} onChange={(event) => setRequestType(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Amount (cents)">
              <input type="number" min={0} value={amountCents} onChange={(event) => setAmountCents(event.target.value)} />
            </FieldLabel>
            <FieldLabel label="Currency">
              <input value={currency} onChange={(event) => setCurrency(event.target.value)} />
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Review request"
            submitLabel="Submit review"
            onSuccess={refresh}
            onSubmit={() => withPrivilegedStepUp(access, "finance.approve", (challengeId) => (
              rootDashboardMutationService.reviewFinanceApprovalRequest(access, {
                requestId,
                status,
                stepUpChallengeId: challengeId,
              })
            ))}
          >
            <FieldLabel label="Request id">
              <input value={requestId} onChange={(event) => setRequestId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Decision">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="pending">pending</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
