import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountCard, AccountPageHeader, StatusBadge } from "../components/ui";
import { FormStatus } from "../components/FormStatus";
import { picomVerifiedService } from "../../services/verificationBusiness/picomVerifiedService";
import type { BillingCatalogPlan, PicomVerifiedPlanKey, PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";
import { ROUTES } from "../routes";

function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function VerifiedLandingPage() {
  const [catalog, setCatalog] = useState<readonly BillingCatalogPlan[]>([]);
  const [summary, setSummary] = useState<PicomVerifiedPublicSummary | null>(null);
  const [planKey, setPlanKey] = useState<PicomVerifiedPlanKey>("picom_verified_yearly");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [catalogResult, summaryResult] = await Promise.all([
        picomVerifiedService.listCatalog(),
        picomVerifiedService.getSummary(),
      ]);
      if (catalogResult.ok) setCatalog(catalogResult.data);
      if (summaryResult.ok) setSummary(summaryResult.data);
      if (!catalogResult.ok && catalogResult.error.code === "NOT_CONFIGURED") {
        setError(catalogResult.error.message);
      }
      setLoading(false);
    })();
  }, []);

  const onCheckout = useCallback(async () => {
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
  }, [planKey]);

  const monthly = catalog.find((plan) => plan.planKey === "picom_verified_monthly");
  const yearly = catalog.find((plan) => plan.planKey === "picom_verified_yearly");

  return (
    <section className="ac-page">
      <AccountPageHeader
        title="PICOM Verified"
        description="Ad-free browsing with Verified Account eligibility. Payment alone does not guarantee the public Verified badge."
        actions={<Link className="ac-button ac-button--ghost" to={ROUTES.verifiedStatus}>View status</Link>}
      />
      {loading ? <FormStatus tone="loading" message="Loading plans…" /> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}

      <div className="ac-grid ac-grid--2">
        <AccountCard title="Monthly" padded>
          <p className="ac-muted">{monthly ? formatMoney(monthly.amountMinor, monthly.currency) : "Price unavailable until catalog is configured."} / month</p>
          <button type="button" className="ac-button" disabled={busy || !monthly} aria-pressed={planKey === "picom_verified_monthly"} onClick={() => setPlanKey("picom_verified_monthly")}>
            Select monthly
          </button>
        </AccountCard>
        <AccountCard title="Yearly" padded>
          <p className="ac-muted">{yearly ? formatMoney(yearly.amountMinor, yearly.currency) : "Price unavailable until catalog is configured."} / year</p>
          <button type="button" className="ac-button" disabled={busy || !yearly} aria-pressed={planKey === "picom_verified_yearly"} onClick={() => setPlanKey("picom_verified_yearly")}>
            Select yearly
          </button>
        </AccountCard>
      </div>

      <AccountCard title="What you get" padded>
        <ul className="ac-list">
          <li>Ad-free experience across PICOM paid placements</li>
          <li>Organic Business, Creator, and Publisher posts still appear</li>
          <li>Verified badge eligibility after account verification and compliance checks</li>
          <li>Renewal requires a new independently verified iyzico payment</li>
        </ul>
        <p className="ac-muted">Selected plan: <strong>{planKey === "picom_verified_yearly" ? "Yearly" : "Monthly"}</strong></p>
        {summary?.subscriptionStatus && summary.subscriptionStatus !== "none" ? (
          <p className="ac-muted">Current subscription: <StatusBadge tone="info">{summary.subscriptionStatus}</StatusBadge></p>
        ) : null}
        <div className="ac-actions-row">
          <button type="button" className="ac-button" disabled={busy || catalog.length === 0} onClick={() => void onCheckout()}>
            {busy ? "Starting checkout…" : summary?.subscriptionStatus === "active" ? "Renew Verified" : "Buy Verified"}
          </button>
          <Link className="ac-button ac-button--ghost" to={ROUTES.verifiedStatus}>Payment status</Link>
          <Link className="ac-button ac-button--ghost" to={ROUTES.accountVerification}>Verification</Link>
        </div>
      </AccountCard>
    </section>
  );
}
