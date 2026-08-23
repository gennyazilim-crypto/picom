import { useEffect, useState } from "react";
import { businessReviewService } from "../../../services/rootDashboard/businessReviewService";

type Access = Readonly<{ allowed: boolean }>;
type DecisionStatus = "approved" | "rejected" | "suspended" | "revoked" | "requires_information" | "under_review" | "identity_verification_required";

function makeIdempotencyKey() {
  return crypto.randomUUID();
}

export function BusinessApplicationsReviewPage({ access }: { access: Access }) {
  const [items, setItems] = useState<readonly Record<string, unknown>[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [publicReason, setPublicReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reasonCode, setReasonCode] = useState("manual_review");

  async function refresh() {
    if (!access.allowed) return;
    const result = await businessReviewService.listApplications();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const rows = result.data as readonly Record<string, unknown>[];
    setItems(statusFilter ? rows.filter((row) => String(row.status ?? "") === statusFilter) : rows);
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, [access.allowed, statusFilter]);

  async function openDetail(id: string) {
    setSelectedId(id);
    const result = await businessReviewService.getAdminDto(id);
    if (!result.ok) {
      setError(result.error);
      setDetail(null);
      return;
    }
    setDetail(result.data as Record<string, unknown>);
  }

  async function runDecision(status: DecisionStatus) {
    if (!selectedId) return;
    if ((status === "rejected" || status === "suspended" || status === "revoked") && !internalNotes.trim()) {
      setError("Internal reason is required for reject / suspend / revoke.");
      return;
    }
    if (!window.confirm(`Confirm Root decision: ${status}? Server authorization still applies.`)) return;
    setBusy(true);
    setError(null);
    const result = await businessReviewService.transition({
      applicationId: selectedId,
      status,
      publicReason: publicReason || undefined,
      internalNotes: `${reasonCode}: ${internalNotes}`.trim(),
      idempotencyKey: makeIdempotencyKey(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
    await openDetail(selectedId);
  }

  if (!access.allowed) {
    return <section className="root-module"><h1>Business applications</h1><p>Root authorization required.</p></section>;
  }

  return (
    <section className="root-module">
      <h1>Business applications</h1>
      <p>Every decision is re-authorized by Root RPCs. UI confirmation is not authorization.</p>
      <div className="root-module-toolbar">
        <label>
          Status filter
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All</option>
            <option value="submitted">submitted</option>
            <option value="under_review">under_review</option>
            <option value="requires_information">requires_information</option>
            <option value="identity_verification_required">identity_verification_required</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="suspended">suspended</option>
            <option value="revoked">revoked</option>
          </select>
        </label>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className="root-module-split">
        <div>
          {items.map((item) => {
            const id = String(item.id ?? "");
            return (
              <article key={id} className="root-module-card">
                <button type="button" onClick={() => void openDetail(id)}>
                  <strong>{String(item.brand_name ?? item.legal_name ?? id)}</strong>
                </button>
                <p>{String(item.legal_name ?? "")}</p>
                <p>{String(item.status ?? "")} · {String(item.registered_country ?? "")} · risk {String(item.risk_level ?? "unknown")}</p>
                <p>Submitted: {String(item.submitted_at ?? "—")}</p>
              </article>
            );
          })}
          {items.length === 0 ? <p>No business applications found.</p> : null}
        </div>
        <div>
          {detail ? (
            <article className="root-module-card">
              <h2>{String(detail.brand_name ?? detail.legal_name ?? selectedId)}</h2>
              <p>Status: {String(detail.status ?? "")}</p>
              <p>Legal: {String(detail.legal_name ?? "")}</p>
              <p>Representative: {String(detail.representative_name ?? "")} / {String(detail.representative_email ?? "")}</p>
              <p>Website: {String(detail.official_website ?? "")}</p>
              <p>Domain: {String(detail.corporate_email_domain ?? "")}</p>
              <label>
                Reason code
                <input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} />
              </label>
              <label>
                Public decision reason
                <textarea value={publicReason} onChange={(event) => setPublicReason(event.target.value)} />
              </label>
              <label>
                Internal review notes
                <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
              </label>
              <div className="root-module-actions">
                <button type="button" disabled={busy} onClick={() => void runDecision("under_review")}>Start review</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("requires_information")}>Request information</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("identity_verification_required")}>Request verification</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("approved")}>Approve</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("rejected")}>Reject</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("suspended")}>Suspend</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("approved")}>Restore</button>
                <button type="button" disabled={busy} onClick={() => void runDecision("revoked")}>Revoke</button>
              </div>
              <p className="root-module-hint">Internal notes never appear on applicant or public DTOs.</p>
            </article>
          ) : (
            <p>Select an application to review.</p>
          )}
        </div>
      </div>
    </section>
  );
}
