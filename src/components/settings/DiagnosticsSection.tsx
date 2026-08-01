import { useState } from "react";
import { diagnosticsService } from "../../services/diagnosticsService";
import { feedbackService, type FeedbackDraft } from "../../services/feedbackService";
import { clipboardService } from "../../services/clipboardService";
import { AppIcon } from "../AppIcon";
import { translateSettings, type SettingsI18nKey } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";

const diagnosticsDraft: FeedbackDraft = {
  issueType: "other",
  title: "Picom diagnostics",
  description: "User-requested diagnostics export.",
  includeDiagnostics: true,
  includeLogs: true,
};

export function DiagnosticsSection({
  language,
  onNotice,
}: {
  language?: "en" | "tr";
  onNotice: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: SettingsI18nKey, params?: Record<string, string | number>) => translateSettings(key, lang, params);
  const [snapshot, setSnapshot] = useState(() => diagnosticsService.getSnapshot());

  const copy = async () => {
    const result = await clipboardService.copyText(diagnosticsService.exportDiagnostics("json", { recentLogLimit: 75 }));
    onNotice(result.ok ? t("diagnostics.copied") : result.reason, result.ok ? "success" : "error");
  };

  const exportFile = async () => {
    const result = await feedbackService.exportSupportDiagnostics(diagnosticsDraft);
    onNotice(
      result.ok ? (result.canceled ? t("diagnostics.exportCanceled") : t("diagnostics.exportedVia", { method: result.method })) : result.reason,
      result.ok && !result.canceled ? "success" : "info",
    );
  };

  const metrics: ReadonlyArray<{ labelKey: SettingsI18nKey; value: string }> = [
    { labelKey: "diagnostics.metric.version", value: `${snapshot.app.version} / ${snapshot.app.releaseChannel}` },
    { labelKey: "diagnostics.metric.build", value: `${snapshot.app.commitShort} / ${snapshot.app.buildDate}` },
    { labelKey: "diagnostics.metric.environment", value: snapshot.app.environment },
    { labelKey: "diagnostics.metric.platform", value: snapshot.runtime.platform },
    { labelKey: "diagnostics.metric.electron", value: snapshot.runtime.electronVersion ?? t("diagnostics.browserFallback") },
    {
      labelKey: "diagnostics.metric.window",
      value: `${snapshot.runtime.window.width ?? "?"}×${snapshot.runtime.window.height ?? "?"} / ${snapshot.runtime.window.focused ? t("diagnostics.focused") : t("diagnostics.background")}`,
    },
    { labelKey: "diagnostics.metric.dataSource", value: snapshot.app.dataSource },
    { labelKey: "diagnostics.metric.auth", value: snapshot.serviceStatus.authState },
    { labelKey: "diagnostics.metric.supabaseHost", value: snapshot.serviceStatus.supabaseHost ?? t("diagnostics.notConfigured") },
    { labelKey: "diagnostics.metric.supabase", value: snapshot.serviceStatus.supabaseStatus },
    { labelKey: "diagnostics.metric.realtime", value: snapshot.serviceStatus.realtimeStatus },
    { labelKey: "diagnostics.metric.livekit", value: snapshot.serviceStatus.liveKitStatus },
    { labelKey: "diagnostics.metric.voice", value: snapshot.serviceStatus.voiceStatus },
    { labelKey: "diagnostics.metric.currentView", value: snapshot.serviceStatus.activeView },
    { labelKey: "diagnostics.metric.recentErrors", value: String(snapshot.recentErrors.length) },
    { labelKey: "diagnostics.metric.lastApiError", value: snapshot.serviceStatus.lastApiError?.message ?? t("diagnostics.none") },
  ];

  return (
    <section id="diagnostics-snapshot" className="diagnostics-settings-section" aria-label={t("diagnostics.snapshotAria")}>
      <div className="diagnostics-section-toolbar">
        <h3 className="diagnostics-settings-section-title">{t("diagnostics.snapshotTitle")}</h3>
        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSnapshot(diagnosticsService.getSnapshot())}>{t("common.refresh")}</button>
      </div>

      <div className="diagnostics-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.labelKey} className="diagnostics-metric-card">
            <span>{t(metric.labelKey)}</span>
            <strong title={metric.value}>{metric.value}</strong>
          </article>
        ))}
      </div>

      <p className="diagnostics-privacy-note">
        <AppIcon name="lock" size="sm" />
        {t("diagnostics.privacyNote")}
      </p>

      <div className="settings-actions-row">
        <button type="button" className="settings-inline-action" onClick={() => void copy()}>{t("diagnostics.copy")}</button>
        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void exportFile()}>{t("diagnostics.export")}</button>
      </div>
    </section>
  );
}
