import { useEffect, useState } from "react";
import { businessProductReviewService } from "../../../services/rootDashboard/businessProductReviewService";

export function BusinessProductsReviewPage({ access }: { access: Readonly<{ allowed: boolean }> }) {
  const [productId, setProductId] = useState("");
  const [reasonCode, setReasonCode] = useState("manual_review");
  const [publicReason, setPublicReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function review(status: "approved" | "requires_changes" | "rejected" | "suspended") {
    if (!access.allowed) return;
    if ((status === "rejected" || status === "suspended") && !internalNotes.trim()) {
      setError("Internal notes are required for reject/suspend.");
      return;
    }
    if (!window.confirm(`Confirm Root product decision: ${status}?`)) return;
    const result = await businessProductReviewService.review({
      productId,
      status,
      reasonCode,
      publicReason: publicReason || undefined,
      internalNotes: internalNotes || undefined,
    });
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      setInfo(`Decision recorded: ${status}`);
    }
  }

  if (!access.allowed) {
    return <section className="root-module"><h1>Business products</h1><p>Root authorization required.</p></section>;
  }

  return (
    <section className="root-module">
      <h1>Business product review</h1>
      <p>Server Root authorization is required. UI confirmation is not authorization. Pending malware media must not be treated as clean.</p>
      <label>Product ID<input value={productId} onChange={(e) => setProductId(e.target.value)} /></label>
      <label>Reason code<input value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} /></label>
      <label>Public reason<textarea value={publicReason} onChange={(e) => setPublicReason(e.target.value)} /></label>
      <label>Internal notes<textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></label>
      <div className="root-module-actions">
        <button type="button" onClick={() => void review("approved")}>Approve</button>
        <button type="button" onClick={() => void review("requires_changes")}>Request changes</button>
        <button type="button" onClick={() => void review("rejected")}>Reject</button>
        <button type="button" onClick={() => void review("suspended")}>Suspend</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {info ? <p role="status">{info}</p> : null}
    </section>
  );
}

export function BusinessPromotionReviewPage({ access }: { access: Readonly<{ allowed: boolean }> }) {
  useEffect(() => {}, [access.allowed]);
  return (
    <section className="root-module">
      <h1>Promotion requests & creative snapshots</h1>
      <p>Creative snapshots are append-only. Campaign drafts created from promotions cannot be activated by clients. Delivery engine is out of scope for this task.</p>
      {!access.allowed ? <p>Root authorization required.</p> : <p>Use SQL/admin RPCs and campaign review modules for decisions. Source Business posts remain organic.</p>}
    </section>
  );
}
