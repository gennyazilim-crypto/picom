import { useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { monetizationService } from "../../../services/monetization/monetizationService";
import type { AdminOperationsResult } from "../../../types/adminOperations";
import type { RootDashboardMutationOk } from "../../../types/rootDashboardOperations";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

function ok(message: string): AdminOperationsResult<RootDashboardMutationOk> {
  return { ok: true, data: { ok: true, message } };
}

function fail(message: string): AdminOperationsResult<RootDashboardMutationOk> {
  return { ok: false, message };
}

/**
 * Root finance operations console.
 * Server authorization is enforced by RPCs; UI confirmation is not authorization.
 */
export function RevenuePage({ access }: ModulePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [programType, setProgramType] = useState("");
  const [batchId, setBatchId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [preview, setPreview] = useState<string>("");
  const refresh = () => setReloadToken((value) => value + 1);

  return (
    <RootDashboardModuleListPage
      access={access}
      section="subscriptions"
      title="Finance & Payout Operations"
      purpose="Monetization applications, payout batches, dual approval, reconciliation, kill switches, and transparency archive ops. Provider send remains fail-closed without secrets."
      summaryModule="revenue"
      summaryLabels={{
        active_subscriptions: "Active subscriptions",
        past_due: "Past due",
        canceled_30d: "Canceled / 30d",
        mrr_cents: "MRR (cents)",
      }}
      emptyMessage="No finance records synced yet."
      reloadToken={reloadToken}
      toolbar={(
        <div className="rd-mutation-grid">
          <ModuleMutationForm
            title="Review monetization application"
            submitLabel="Submit decision"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.rootReviewApplication({
                applicationId,
                decision: "approved",
                publicReasonCode: "meets_program_requirements",
                internalReasonCode: "root_review",
                policyVersion: "v1",
                idempotencyKey: `review:${applicationId}:${Date.now()}`,
              });
              return result.ok ? ok("Application reviewed.") : fail(result.error.message);
            }}
          >
            <FieldLabel label="Application id">
              <input value={applicationId} onChange={(event) => setApplicationId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Payout batch preview (no state change)"
            submitLabel="Preview"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.previewPayoutBatch({
                periodStart,
                periodEnd,
                currency,
                programType: programType || null,
              });
              if (!result.ok) return fail(result.error.message);
              setPreview(JSON.stringify(result.data));
              return ok("Preview generated (no state change).");
            }}
          >
            <FieldLabel label="Period start (ISO)">
              <input value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Period end (ISO)">
              <input value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
            </FieldLabel>
            <FieldLabel label="Currency">
              <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </FieldLabel>
            <FieldLabel label="Program (optional)">
              <input value={programType} onChange={(event) => setProgramType(event.target.value)} placeholder="creator|publisher" />
            </FieldLabel>
            {preview ? <p role="status">Preview: {preview}</p> : null}
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Create payout batch"
            submitLabel="Create batch"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.createPayoutBatch({
                periodStart,
                periodEnd,
                currency,
                programType: programType || null,
                idempotencyKey: `batch:${periodStart}:${periodEnd}:${currency}:${programType || "all"}`,
              });
              if (!result.ok) return fail(result.error.message);
              setBatchId(result.data);
              return ok(`Batch created: ${result.data}`);
            }}
          >
            <p>Uses the same period/currency fields as preview. Does not send provider transfers.</p>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Approve payout batch (dual approval)"
            submitLabel="Approve"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.approvePayoutBatch(batchId);
              return result.ok ? ok("Batch approved.") : fail(result.error.message);
            }}
          >
            <FieldLabel label="Batch id">
              <input value={batchId} onChange={(event) => setBatchId(event.target.value)} required />
            </FieldLabel>
            <p>Creator cannot approve their own batch when dual approval is enabled.</p>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Cancel unprocessed batch"
            submitLabel="Cancel"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.cancelPayoutBatch(batchId);
              return result.ok ? ok("Batch cancelled.") : fail(result.error.message);
            }}
          >
            <FieldLabel label="Batch id">
              <input value={batchId} onChange={(event) => setBatchId(event.target.value)} required />
            </FieldLabel>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Global payout kill switch"
            submitLabel="Disable global payouts"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.togglePayoutSetting("global_payouts_enabled", false);
              return result.ok ? ok("Global payouts disabled.") : fail(result.error.message);
            }}
          >
            <p>Disabling stops new provider sends. Existing paid state is unchanged. Accruals may continue.</p>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Enable creator payouts"
            submitLabel="Enable creator payouts"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.togglePayoutSetting("creator_payouts_enabled", true);
              return result.ok ? ok("Creator payouts enabled.") : fail(result.error.message);
            }}
          >
            <p>Program toggle only. Provider secrets and legal copy remain separate gates.</p>
          </ModuleMutationForm>

          <ModuleMutationForm
            title="Enable publisher payouts"
            submitLabel="Enable publisher payouts"
            onSuccess={refresh}
            onSubmit={async () => {
              const result = await monetizationService.togglePayoutSetting("publisher_payouts_enabled", true);
              return result.ok ? ok("Publisher payouts enabled.") : fail(result.error.message);
            }}
          >
            <p>Does not affect Creator program payouts.</p>
          </ModuleMutationForm>
        </div>
      )}
    />
  );
}
