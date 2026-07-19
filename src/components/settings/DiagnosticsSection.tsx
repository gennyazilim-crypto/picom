import { useState } from "react";
import { diagnosticsService } from "../../services/diagnosticsService";
import { feedbackService, type FeedbackDraft } from "../../services/feedbackService";
import { clipboardService } from "../../services/clipboardService";
import { AppIcon } from "../AppIcon";

const diagnosticsDraft: FeedbackDraft = {
  issueType: "other",
  title: "Picom diagnostics",
  description: "User-requested diagnostics export.",
  includeDiagnostics: true,
  includeLogs: true,
};

export function DiagnosticsSection({ onNotice }: { onNotice: (message: string, tone?: "info" | "success" | "error") => void }) {
  const [snapshot, setSnapshot] = useState(() => diagnosticsService.getSnapshot());

  const copy = async () => {
    const result = await clipboardService.copyText(diagnosticsService.exportDiagnostics("json", { recentLogLimit: 75 }));
    onNotice(result.ok ? "Redacted diagnostics copied." : result.reason, result.ok ? "success" : "error");
  };

  const exportFile = async () => {
    const result = await feedbackService.exportSupportDiagnostics(diagnosticsDraft);
    onNotice(
      result.ok ? (result.canceled ? "Diagnostics export canceled." : `Diagnostics exported via ${result.method}.`) : result.reason,
      result.ok && !result.canceled ? "success" : "info",
    );
  };

  const metrics = [
    { label: "Version", value: `${snapshot.app.version} / ${snapshot.app.releaseChannel}` },
    { label: "Build", value: `${snapshot.app.commitShort} / ${snapshot.app.buildDate}` },
    { label: "Environment", value: snapshot.app.environment },
    { label: "Platform", value: snapshot.runtime.platform },
    { label: "Electron", value: snapshot.runtime.electronVersion ?? "Browser fallback" },
    { label: "Window", value: `${snapshot.runtime.window.width ?? "?"}×${snapshot.runtime.window.height ?? "?"} / ${snapshot.runtime.window.focused ? "focused" : "background"}` },
    { label: "Data source", value: snapshot.app.dataSource },
    { label: "Auth", value: snapshot.serviceStatus.authState },
    { label: "Supabase host", value: snapshot.serviceStatus.supabaseHost ?? "Not configured" },
    { label: "Supabase", value: snapshot.serviceStatus.supabaseStatus },
    { label: "Realtime", value: snapshot.serviceStatus.realtimeStatus },
    { label: "LiveKit", value: snapshot.serviceStatus.liveKitStatus },
    { label: "Voice", value: snapshot.serviceStatus.voiceStatus },
    { label: "Current view", value: snapshot.serviceStatus.activeView },
    { label: "Recent errors", value: String(snapshot.recentErrors.length) },
    { label: "Last API error", value: snapshot.serviceStatus.lastApiError?.message ?? "None", title: snapshot.serviceStatus.lastApiError?.message },
  ] as const;

  return (
    <section className="diagnostics-settings-section" aria-label="Diagnostics snapshot">
      <div className="diagnostics-section-toolbar">
        <h3 className="diagnostics-settings-section-title">Diagnostics snapshot</h3>
        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSnapshot(diagnosticsService.getSnapshot())}>Refresh</button>
      </div>

      <div className="diagnostics-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="diagnostics-metric-card">
            <span>{metric.label}</span>
            <strong title={"title" in metric ? metric.title : undefined}>{metric.value}</strong>
          </article>
        ))}
      </div>

      <p className="diagnostics-privacy-note">
        <AppIcon name="lock" size="sm" />
        Secrets, passwords, tokens, cookies, private keys, and authorization headers are excluded.
      </p>

      <div className="settings-actions-row">
        <button type="button" className="settings-inline-action" onClick={() => void copy()}>Copy diagnostics</button>
        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void exportFile()}>Export diagnostics</button>
      </div>
    </section>
  );
}
