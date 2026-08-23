import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountCard, AccountPageHeader, StatusBadge } from "../components/ui";
import { FormStatus } from "../components/FormStatus";
import { picomVerifiedService } from "../../services/verificationBusiness/picomVerifiedService";
import type { PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

type InvoiceRow = {
  id: string;
  status: string;
  amount_due_minor: number;
  amount_paid_minor: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  paid_at: string | null;
  created_at: string;
};

function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function AccountBillingPage() {
  const [summary, setSummary] = useState<PicomVerifiedPublicSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const summaryResult = await picomVerifiedService.getSummary();
      if (!summaryResult.ok) setError(summaryResult.error.message);
      else setSummary(summaryResult.data);

      const supabase = getAccountSupabase();
      const invoiceResult = await supabase
        .from("billing_invoices")
        .select("id,status,amount_due_minor,amount_paid_minor,currency,hosted_invoice_url,invoice_pdf_url,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (invoiceResult.error) setError(invoiceResult.error.message);
      else setInvoices((invoiceResult.data as InvoiceRow[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    const result = await picomVerifiedService.createPortal(ROUTES.accountBilling);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    window.location.assign(result.data.portalUrl);
  };

  return (
    <section className="ac-page">
      <AccountPageHeader
        title="Billing"
        description="Invoices and subscription management for PICOM Verified. Card details are never collected on this page."
      />
      {loading ? <FormStatus tone="loading" message="Loading billing…" /> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      <AccountCard title="Subscription" padded>
        <p>Status: <StatusBadge tone="info">{summary?.subscriptionStatus ?? "—"}</StatusBadge></p>
        <p className="ac-muted">Plan: {summary?.planKey ?? "—"}</p>
        <p className="ac-muted">Period end: {summary?.currentPeriodEnd ? new Date(summary.currentPeriodEnd).toLocaleString() : "—"}</p>
        <div className="ac-actions-row">
          <button type="button" className="ac-button" disabled={busy || !summary?.customerPortalAvailable} onClick={() => void openPortal()}>
            {busy ? "Opening…" : "Open customer portal"}
          </button>
          <Link className="ac-button ac-button--ghost" to={ROUTES.verified}>PICOM Verified</Link>
        </div>
      </AccountCard>
      <AccountCard title="Invoices" padded>
        <ul className="ac-list">
          {invoices.length === 0 ? <li className="ac-muted">No invoices yet.</li> : null}
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <strong>{invoice.status}</strong>
              {" · "}
              {formatMoney(invoice.amount_paid_minor || invoice.amount_due_minor, invoice.currency)}
              {" · "}
              {new Date(invoice.created_at).toLocaleDateString()}
              {invoice.hosted_invoice_url ? (
                <>
                  {" · "}
                  <a href={invoice.hosted_invoice_url} rel="noopener noreferrer" target="_blank">View</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </AccountCard>
    </section>
  );
}
