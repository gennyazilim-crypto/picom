import { useCallback, useEffect, useState } from "react";
import { emailOperationsService, type EmailOperation } from "../../../services/emailOperationsService";
import { AppIcon } from "../../AppIcon";

function metric(summary: Record<string, unknown>, key: string): string {
  const value = summary[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : "0";
}

export function EmailOperationsPage() {
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [rows, setRows] = useState<EmailOperation[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true); setMessage("");
    const [summaryResult, rowsResult] = await Promise.all([
      emailOperationsService.getAdminSummary(),
      emailOperationsService.getAdminOperations(50),
    ]);
    setBusy(false);
    if (!summaryResult.ok || !rowsResult.ok) { setMessage(!summaryResult.ok ? summaryResult.message : rowsResult.ok ? "" : rowsResult.message); return; }
    setSummary(summaryResult.data); setRows(rowsResult.data ?? []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (kind: "retry" | "cancel", id: string) => {
    const result = kind === "retry" ? await emailOperationsService.retry(id) : await emailOperationsService.cancel(id);
    setMessage(result.ok ? `Email ${kind} action accepted.` : result.message);
    if (result.ok) await refresh();
  };

  const sendTest = async () => {
    const result = await emailOperationsService.sendAdminTest();
    setMessage(result.ok ? "A protected test email was queued to your admin address." : result.message);
    if (result.ok) await refresh();
  };

  return (
    <section style={{ display: "grid", gap: 16, minWidth: 0 }} aria-label="Email operations">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div><h1 style={{ margin: 0 }}>Email operations</h1><p style={{ color: "var(--text-muted)" }}>Queue health, delivery outcomes, suppressions, and protected controls.</p></div>
        <div style={{ display: "flex", gap: 8 }}><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={busy}><AppIcon name="settings" size="sm" />Refresh</button><button type="button" className="primary-button" onClick={() => void sendTest()} disabled={busy}><AppIcon name="send" size="sm" />Queue test</button></div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[['queued','Queued'],['sent_24h','Sent 24h'],['failed_24h','Failed 24h'],['suppressed','Suppressed']].map(([key,label]) => <article key={key} className="root-card" style={{ padding: 16 }}><small style={{ color: "var(--text-muted)" }}>{label}</small><strong style={{ display: "block", fontSize: 24, marginTop: 8 }}>{metric(summary,key)}</strong></article>)}
      </div>
      {message ? <div className="root-card" role="status" style={{ padding: 12 }}>{message}</div> : null}
      <div className="root-card" style={{ minWidth: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Template","Status","Domain","Attempts","Created","Error","Actions"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid var(--border)" }}>{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td style={{ padding: 12 }}>{row.template_id}</td><td style={{ padding: 12 }}>{row.status}</td><td style={{ padding: 12 }}>{row.recipient_domain}</td><td style={{ padding: 12 }}>{row.attempt_count}</td><td style={{ padding: 12 }}>{new Date(row.created_at).toLocaleString()}</td><td style={{ padding: 12 }}>{row.last_error_code ?? "-"}</td><td style={{ padding: 12, whiteSpace: "nowrap" }}><button type="button" className="secondary-button" onClick={() => void act("retry", row.id)}>Retry</button> <button type="button" className="secondary-button" onClick={() => void act("cancel", row.id)}>Cancel</button></td></tr>)}</tbody>
        </table>
        {!busy && rows.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No queued email operations yet.</div> : null}
      </div>
    </section>
  );
}
