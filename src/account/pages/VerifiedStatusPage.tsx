import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AccountCard, AccountPageHeader, StatusBadge } from "../components/ui";
import { FormStatus } from "../components/FormStatus";
import { picomVerifiedService } from "../../services/verificationBusiness/picomVerifiedService";
import type { PicomVerifiedPlanKey, PicomVerifiedPaymentSummary, PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";
import { ROUTES } from "../routes";

export function VerifiedCheckoutPage() {
  const [params] = useSearchParams();
  const initialPlan = params.get("plan") === "monthly" ? "picom_verified_monthly" : "picom_verified_yearly";
  const [planKey, setPlanKey] = useState<PicomVerifiedPlanKey>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("cancelled") === "1") {
      setInfo("Checkout was cancelled. No charge was made.");
    }
  }, [params]);

  const onCheckout = async () => {
    setBusy(true);
    setError(null);
    const result = await picomVerifiedService.createCheckout({
      planKey,
      successReturnPath: ROUTES.verifiedStatus,
      cancelReturnPath: ROUTES.verifiedCheckout,
      idempotencyKey: `verified-checkout-${planKey}-${crypto.randomUUID()}`,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    window.location.assign(result.data.paymentUrl);
  };

  return (
    <section className="ac-page">
      <AccountPageHeader title="Checkout" description="Secure checkout opens in iyzico Link. PICOM never accepts card details in Account Center." />
      {info ? <FormStatus tone="info" message={info} /> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      <AccountCard title="Choose plan" padded>
        <div className="ac-actions-row">
          <button type="button" className="ac-button" aria-pressed={planKey === "picom_verified_monthly"} onClick={() => setPlanKey("picom_verified_monthly")}>Monthly</button>
          <button type="button" className="ac-button" aria-pressed={planKey === "picom_verified_yearly"} onClick={() => setPlanKey("picom_verified_yearly")}>Yearly</button>
        </div>
        <p className="ac-muted">Selected: {planKey}</p>
        <button type="button" className="ac-button" disabled={busy} onClick={() => void onCheckout()}>
          {busy ? "Redirecting…" : "Pay securely with iyzico"}
        </button>
        <Link className="ac-button ac-button--ghost" to={ROUTES.verified}>Back</Link>
      </AccountCard>
    </section>
  );
}

function toneForStatus(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "active" || status === "verified" || status === "trialing") return "success";
  if (status === "past_due" || status === "grace_period" || status === "requires_input" || status === "pending") return "warning";
  if (status === "expired" || status === "cancelled" || status === "unpaid" || status === "failed") return "danger";
  return "info";
}

export function VerifiedStatusPage() {
  const [summary, setSummary] = useState<PicomVerifiedPublicSummary | null>(null);
  const [payment, setPayment] = useState<PicomVerifiedPaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [result, paymentResult] = await Promise.all([picomVerifiedService.getSummary(), picomVerifiedService.getPaymentStatus()]);
    if (!result.ok) setError(result.error.message);
    else {
      setSummary(result.data);
      setPayment(paymentResult.ok ? paymentResult.data : null);
      setError(paymentResult.ok ? null : paymentResult.error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const reconcilePayment = async () => {
    if (!payment) return;
    setBusy(true);
    setError(null);
    const result = await picomVerifiedService.reconcilePayment(payment.intentId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await reload();
  };

  const missingSteps: string[] = [];
  if (summary) {
    if (!summary.entitlements.adFree) missingSteps.push("Active PICOM Verified subscription");
    if (summary.verificationDisplayState !== "verified") missingSteps.push("Complete account verification");
    if (summary.badgeDisplayState !== "active") missingSteps.push("Verified badge activation after compliance checks");
  }

  return (
    <section className="ac-page">
      <AccountPageHeader
        title="Verified status"
        description="Payment, entitlement, and badge state come from the server. This page never invents an active state locally."
        actions={<button type="button" className="ac-button ac-button--ghost" onClick={() => void reload()}>Refresh</button>}
      />
      {loading ? <FormStatus tone="loading" message="Loading status…" /> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      {summary ? (
        <>
          <AccountCard title="Subscription" padded>
            <p>Status: <StatusBadge tone={toneForStatus(summary.subscriptionStatus)}>{summary.subscriptionStatus}</StatusBadge></p>
            <p className="ac-muted">Plan: {summary.planKey ?? "—"}</p>
            <p className="ac-muted">Expires: {summary.currentPeriodEnd ? new Date(summary.currentPeriodEnd).toLocaleString() : "—"}</p>
            <p className="ac-muted">Renewal: {summary.cancelAtPeriodEnd ? "Ends at period end" : "A new verified payment is required"}</p>
          </AccountCard>
          <AccountCard title="Payment" padded>
            {payment ? (
              <>
                <p>Status: <StatusBadge tone={toneForStatus(payment.status)}>{payment.status}</StatusBadge></p>
                <p className="ac-muted">Plan: {payment.planKey}</p>
                <p className="ac-muted">Payment request expires: {new Date(payment.expiresAt).toLocaleString()}</p>
                {payment.failureCode ? <p className="ac-muted">Verification result: {payment.failureCode}</p> : null}
                {payment.status !== "paid" && payment.status !== "failed" && payment.status !== "expired" ? (
                  <button type="button" className="ac-button ac-button--ghost" disabled={busy} onClick={() => void reconcilePayment()}>
                    {busy ? "Checking payment…" : "Check payment"}
                  </button>
                ) : null}
              </>
            ) : <p className="ac-muted">No recent Verified payment request.</p>}
          </AccountCard>
          <AccountCard title="Entitlements" padded>
            <p>Ad-free: <StatusBadge tone={summary.entitlements.adFree ? "success" : "neutral"}>{summary.entitlements.adFree ? "active" : "inactive"}</StatusBadge></p>
            <p>Badge eligible: <StatusBadge tone={summary.entitlements.verifiedBadgeEligible ? "success" : "neutral"}>{summary.entitlements.verifiedBadgeEligible ? "active" : "inactive"}</StatusBadge></p>
            <p>Priority support: <StatusBadge tone={summary.entitlements.prioritySupport ? "success" : "neutral"}>{summary.entitlements.prioritySupport ? "active" : "inactive"}</StatusBadge></p>
          </AccountCard>
          <AccountCard title="Verification & badge" padded>
            <p>Verification: <StatusBadge tone={toneForStatus(summary.verificationDisplayState)}>{summary.verificationDisplayState}</StatusBadge></p>
            <p>Badge: <StatusBadge tone={toneForStatus(summary.badgeDisplayState)}>{summary.badgeDisplayState}</StatusBadge></p>
            {missingSteps.length > 0 ? (
              <ul className="ac-list">
                {missingSteps.map((step) => <li key={step}>{step}</li>)}
              </ul>
            ) : (
              <p className="ac-muted">All Verified requirements currently satisfied.</p>
            )}
            <div className="ac-actions-row">
              <Link className="ac-button" to={ROUTES.accountVerification}>Complete verification</Link>
              <Link className="ac-button ac-button--ghost" to={ROUTES.verified}>{summary.subscriptionStatus === "active" ? "Renew Verified" : "Buy Verified"}</Link>
            </div>
          </AccountCard>
        </>
      ) : null}
    </section>
  );
}
