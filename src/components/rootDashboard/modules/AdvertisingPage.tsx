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
  const [advertiserId, setAdvertiserId] = useState("");
  const [creativeId, setCreativeId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [placementKey, setPlacementKey] = useState("feed_inline");
  const [placementEnabled, setPlacementEnabled] = useState(false);
  const [globalDisabled, setGlobalDisabled] = useState(true);
  const [reason, setReason] = useState("policy_review");
  const [policyVersion, setPolicyVersion] = useState("ads-policy-v1");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="ad_campaigns"
      title="Advertising operations"
      purpose="Advertiser activation, campaign/creative review, placement kill switches, and delivery controls."
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
            title="Upsert legacy campaign draft"
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
            title="Activate advertiser"
            submitLabel="Activate"
            onSuccess={() => { setIdempotencyKey(crypto.randomUUID()); refresh(); }}
            onSubmit={() => rootDashboardMutationService.rootActivateAdvertiser(access, {
              advertiserId,
              publicReasonCode: reason,
              internalReasonCode: reason,
              policyVersion,
              idempotencyKey,
            })}
          >
            <FieldLabel label="Advertiser id">
              <input value={advertiserId} onChange={(event) => setAdvertiserId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Reason code">
              <input value={reason} onChange={(event) => setReason(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Suspend advertiser"
            submitLabel="Suspend"
            onSuccess={() => { setIdempotencyKey(crypto.randomUUID()); refresh(); }}
            onSubmit={() => rootDashboardMutationService.rootSuspendAdvertiser(access, {
              advertiserId,
              publicReasonCode: reason,
              internalReasonCode: reason,
              policyVersion,
              idempotencyKey,
            })}
          >
            <FieldLabel label="Advertiser id">
              <input value={advertiserId} onChange={(event) => setAdvertiserId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Approve campaign"
            submitLabel="Approve"
            onSuccess={() => { setIdempotencyKey(crypto.randomUUID()); refresh(); }}
            onSubmit={() => rootDashboardMutationService.rootApproveAdCampaign(access, {
              campaignId,
              publicReasonCode: reason,
              internalReasonCode: reason,
              policyVersion,
              idempotencyKey,
            })}
          >
            <FieldLabel label="Campaign id">
              <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Reject campaign"
            submitLabel="Reject"
            onSuccess={() => { setIdempotencyKey(crypto.randomUUID()); refresh(); }}
            onSubmit={() => rootDashboardMutationService.rootRejectAdCampaign(access, {
              campaignId,
              publicReasonCode: reason,
              internalReasonCode: reason,
              policyVersion,
              idempotencyKey,
            })}
          >
            <FieldLabel label="Campaign id">
              <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Approve creative"
            submitLabel="Approve"
            onSuccess={() => { setIdempotencyKey(crypto.randomUUID()); refresh(); }}
            onSubmit={() => rootDashboardMutationService.rootApproveAdCreative(access, {
              creativeId,
              snapshotId,
              publicReasonCode: reason,
              internalReasonCode: reason,
              policyVersion,
              idempotencyKey,
            })}
          >
            <FieldLabel label="Creative id">
              <input value={creativeId} onChange={(event) => setCreativeId(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Snapshot id">
              <input value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Placement kill switch"
            submitLabel="Apply"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.rootToggleAdPlacement(access, {
              placementKey,
              enabled: placementEnabled,
            })}
          >
            <FieldLabel label="Placement key">
              <input value={placementKey} onChange={(event) => setPlacementKey(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Enabled">
              <select value={placementEnabled ? "true" : "false"} onChange={(event) => setPlacementEnabled(event.target.value === "true")}>
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Global advertising kill switch"
            submitLabel="Apply"
            onSuccess={refresh}
            onSubmit={() => rootDashboardMutationService.rootToggleAdvertisingGlobal(access, {
              disabled: globalDisabled,
            })}
          >
            <FieldLabel label="Disable advertising">
              <select value={globalDisabled ? "true" : "false"} onChange={(event) => setGlobalDisabled(event.target.value === "true")}>
                <option value="true">true (kill)</option>
                <option value="false">false</option>
              </select>
            </FieldLabel>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
