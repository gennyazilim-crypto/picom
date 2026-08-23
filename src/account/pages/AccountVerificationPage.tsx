import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountCard, AccountPageHeader, StatusBadge } from "../components/ui";
import { FormStatus } from "../components/FormStatus";
import { picomVerifiedService } from "../../services/verificationBusiness/picomVerifiedService";
import type { PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";
import { ROUTES } from "../routes";

export function AccountVerificationPage() {
  const [summary, setSummary] = useState<PicomVerifiedPublicSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const result = await picomVerifiedService.getSummary();
    if (!result.ok) setError(result.error.message);
    else {
      setSummary(result.data);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const startVerification = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = await picomVerifiedService.createVerificationSession(ROUTES.accountVerification);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (result.data.sessionUrl) {
      window.location.assign(result.data.sessionUrl);
      return;
    }
    setInfo(result.data.message ?? `Verification status: ${result.data.status}. Provider session is pending or awaiting input.`);
    await reload();
  };

  const steps = [
    { key: "subscription", label: "Active PICOM Verified subscription", done: Boolean(summary?.entitlements.verifiedBadgeEligible) },
    { key: "verification", label: "Identity / account verification", done: summary?.verificationDisplayState === "verified" },
    { key: "badge", label: "Verified badge active", done: summary?.badgeDisplayState === "active" },
  ];

  return (
    <section className="ac-page">
      <AccountPageHeader
        title="Account verification"
        description="Verification is required for the public Verified badge. Payment alone does not activate the badge. Picom does not display internal risk reasons here."
      />
      {loading ? <FormStatus tone="loading" message="Loading verification…" /> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      {info ? <FormStatus tone="info" message={info} /> : null}

      <AccountCard title="Required steps" padded>
        <ul className="ac-list">
          {steps.map((step) => (
            <li key={step.key}>
              <StatusBadge tone={step.done ? "success" : "warning"}>{step.done ? "Done" : "Needed"}</StatusBadge>
              {" "}
              {step.label}
            </li>
          ))}
        </ul>
        <p className="ac-muted">
          Current verification state: <StatusBadge tone="info">{summary?.verificationDisplayState ?? "—"}</StatusBadge>
        </p>
        {summary?.verificationDisplayState === "requires_input" ? (
          <p className="ac-muted">Additional information is required. Restart verification to continue securely with the provider.</p>
        ) : null}
        <div className="ac-actions-row">
          <button
            type="button"
            className="ac-button"
            disabled={busy || !summary?.entitlements.verifiedBadgeEligible}
            onClick={() => void startVerification()}
          >
            {busy ? "Starting…" : "Start or continue verification"}
          </button>
          <button type="button" className="ac-button ac-button--ghost" onClick={() => void reload()}>Refresh</button>
          <Link className="ac-button ac-button--ghost" to={ROUTES.verifiedStatus}>Status</Link>
        </div>
        <p className="ac-muted">
          Privacy: identity documents are processed by the configured verification provider. Picom stores only session status needed for badge eligibility.
        </p>
      </AccountCard>
    </section>
  );
}
