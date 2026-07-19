import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AdvertisingPage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("awareness");
  const [budgetCents, setBudgetCents] = useState("0");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("draft");
  const [reviewStatus, setReviewStatus] = useState("pending");

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="ad_campaigns"
      title="Advertising"
      purpose="Campaign performance, pacing, and inventory controls."
      summaryModule="advertising"
      summaryLabels={{
        active_campaigns: "Active campaigns",
        pending_review: "Pending review",
        impressions: "Impressions",
        clicks: "Clicks",
      }}
      emptyMessage="No advertising campaigns configured yet."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Upsert campaign"
            submitLabel="Save"
            onSuccess={() => { setName(""); refresh(); }}
            onSubmit={() => rootDashboardMutationService.upsertAdCampaign(access, {
              name,
              objective,
              budgetCents: Number(budgetCents) || 0,
            })}
          >
            <FieldLabel label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
            </FieldLabel>
            <FieldLabel label="Objective">
              <input value={objective} onChange={(event) => setObjective(event.target.value)} />
            </FieldLabel>
            <FieldLabel label="Budget (cents)">
              <input type="number" min={0} value={budgetCents} onChange={(event) => setBudgetCents(event.target.value)} />
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Set campaign status"
            submitLabel="Update"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.setAdCampaignStatus(access, { campaignId, status })}
          >
            <FieldLabel label="Campaign id">
              <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Status">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">draft</option>
                <option value="in_review">in_review</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="archived">archived</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
          <ModuleMutationForm
            title="Set review status"
            submitLabel="Update"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.setAdReviewStatus(access, { campaignId, reviewStatus })}
          >
            <FieldLabel label="Campaign id">
              <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Review">
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
                <option value="pending">pending</option>
                <option value="in_review">in_review</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
