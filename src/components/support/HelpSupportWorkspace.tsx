import { useEffect, useState } from "react";
import type { LegalDocumentId } from "../../data/legalDocuments";
import { feedbackService } from "../../services/feedbackService";
import { helpSupportNavigationService } from "../../services/navigation/helpSupportNavigationService";
import { AppIcon } from "../AppIcon";
import { HelpCenterView } from "../HelpCenterView";
import { LegalDocumentModal } from "../legal/LegalDocumentModal";

type Toast = (message: string, tone?: "info" | "success" | "error") => void;

export function HelpSupportWorkspace({ onBack, pushToast }: Readonly<{ onBack: () => void; pushToast: Toast }>) {
  const [entry] = useState(() => helpSupportNavigationService.consume());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [busy, setBusy] = useState<"export" | "copy" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [legalDocumentId, setLegalDocumentId] = useState<LegalDocumentId | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const exportDiagnostics = async () => {
    setBusy("export"); setError(null);
    const result = await feedbackService.exportSupportDiagnostics({ issueType: "other", title: "Help and Support diagnostics", description: "User-requested redacted diagnostics export.", includeDiagnostics: true, includeLogs: true });
    setBusy(null);
    if (!result.ok) { setError(result.reason); return; }
    pushToast(result.canceled ? "Diagnostics export canceled." : "Redacted diagnostics exported.", result.canceled ? "info" : "success");
  };

  const copyReport = async () => {
    if (!title.trim() || !description.trim()) { setError("Add a short title and description before creating the report."); return; }
    setBusy("copy"); setError(null);
    const result = await feedbackService.copyReport({ issueType: "bug", severity: "major", title: title.trim(), description: description.trim(), includeDiagnostics: true, includeLogs: false });
    setBusy(null);
    if (!result.ok) { setError(result.reason); return; }
    pushToast("Redacted report copied. Automated support submission is not configured in this beta.", "success");
  };

  return (
    <section aria-label="Help and Support workspace" style={{ minWidth: 0, minHeight: 0, flex: "1 1 auto", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", overflow: "hidden", background: "var(--bg-chat)" }}>
      <header style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <button type="button" className="icon-button" aria-label="Back to Feed" onClick={onBack}><span style={{ transform: "rotate(180deg)", display: "grid" }}><AppIcon name="chevronRight" size="sm" /></span></button>
        <div style={{ minWidth: 0, flex: 1 }}><strong>Help & Support</strong><span style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>Local desktop guidance and privacy-safe support tools</span></div>
        <span role="status" style={{ padding: "6px 10px", borderRadius: 999, background: "var(--surface-soft)", color: online ? "var(--success)" : "var(--warning)", fontSize: 11, fontWeight: 800 }}>{online ? "Online" : "Offline guidance"}</span>
      </header>
      <div style={{ minWidth: 0, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, padding: 16, overflow: "hidden" }}>
        <main style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--surface)" }}><HelpCenterView initialTopicId={entry.sectionId} /></main>
        <aside aria-label="Support actions" style={{ minWidth: 0, minHeight: 0, overflow: "auto", display: "grid", alignContent: "start", gap: 12 }}>
          {!online ? <div className="empty-state compact" role="status">Articles, report copying, and diagnostics export remain available offline. Online submission is unavailable.</div> : null}
          <section style={{ display: "grid", gap: 9, padding: 14, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}><strong>Export diagnostics</strong><small style={{ color: "var(--text-muted)", lineHeight: 1.45 }}>Creates a user-initiated JSON bundle redacted by Picom. Tokens, secrets, private message content, and raw credentials are excluded.</small><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void exportDiagnostics()}><AppIcon name="paperclip" size="sm" />{busy === "export" ? "Exporting..." : "Export redacted diagnostics"}</button></section>
          <section style={{ display: "grid", gap: 9, padding: 14, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}><strong>Report a problem</strong><label style={{ display: "grid", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>Title<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label><label style={{ display: "grid", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>Description<textarea value={description} maxLength={2000} rows={5} onChange={(event) => setDescription(event.target.value)} /></label><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void copyReport()}><AppIcon name="send" size="sm" />{busy === "copy" ? "Preparing..." : "Copy redacted report"}</button><small style={{ color: "var(--text-muted)", lineHeight: 1.45 }}>Automated support submission is not configured in this beta. Copying or exporting never claims a report was sent.</small></section>
          <section style={{ display: "grid", gap: 8, padding: 14, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}><strong>Legal</strong>{(["terms", "privacy", "guidelines", "acceptableUse"] as const).map((documentId) => <button key={documentId} type="button" className="global-nav-item" onClick={() => setLegalDocumentId(documentId)}><AppIcon name="lock" size="sm" /><span className="global-nav-item__label">{documentId === "acceptableUse" ? "Acceptable Use" : documentId[0].toUpperCase() + documentId.slice(1)}</span><AppIcon name="chevronRight" size="xs" /></button>)}</section>
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
        </aside>
      </div>
      {legalDocumentId ? <LegalDocumentModal documentId={legalDocumentId} onClose={() => setLegalDocumentId(null)} /> : null}
    </section>
  );
}
