import { useEffect, useMemo, useState } from "react";
import { loggingService, type LogEntry, type LogLevel } from "../../services/loggingService";
import { clipboardService } from "../../services/clipboardService";
import { fileService } from "../../services/fileService";
import { dateTimeService } from "../../services/dateTimeService";
import { translateSettings } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";

export function LogsViewer({
  language,
  onNotice,
}: {
  language?: "en" | "tr";
  onNotice: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, lang, params);
  const [logs, setLogs] = useState<LogEntry[]>(() => loggingService.getLogs());
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => loggingService.onLog(() => setLogs(loggingService.getLogs())), []);

  const sources = useMemo(
    () => [...new Set(logs.map((entry) => entry.source).filter((value): value is string => Boolean(value)))].sort(),
    [logs],
  );

  const filtered = useMemo(
    () => logs
      .filter((entry) => (level === "all" || entry.level === level)
        && (source === "all" || entry.source === source)
        && `${entry.message} ${entry.source ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
      .slice()
      .reverse(),
    [level, logs, query, source],
  );

  const selected = logs.find((entry) => entry.id === selectedId) ?? null;

  const copy = async () => {
    if (!selected) return;
    const result = await clipboardService.copyText(JSON.stringify(selected, null, 2));
    onNotice(result.ok ? t("logs.selectedCopied") : result.reason, result.ok ? "success" : "error");
  };

  const copyFiltered = async () => {
    const result = await clipboardService.copyText(JSON.stringify(loggingService.redactDiagnosticsValue(filtered), null, 2));
    onNotice(result.ok ? t("logs.filteredCopied", { count: filtered.length }) : result.reason, result.ok ? "success" : "error");
  };

  const exportLogs = async () => {
    const result = await fileService.saveText(`picom-redacted-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, loggingService.exportLogs());
    onNotice(result.ok ? (result.canceled ? t("logs.exportCanceled") : t("logs.exported")) : result.reason, result.ok && !result.canceled ? "success" : "info");
  };

  const clear = () => {
    if (!window.confirm(t("confirm.clearLogs"))) return;
    loggingService.clearLogs();
    setLogs([]);
    setSelectedId(null);
    onNotice(t("logs.cleared"), "info");
  };

  return (
    <section id="diagnostics-logs" className="diagnostics-settings-section diagnostics-logs-section" aria-label={t("logs.sectionAria")}>
      <div className="diagnostics-section-toolbar">
        <h3 className="diagnostics-settings-section-title">{t("logs.title")}</h3>
        <div className="settings-actions-row">
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!selected} onClick={() => void copy()}>{t("logs.copySelected")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!filtered.length} onClick={() => void copyFiltered()}>{t("logs.copyFiltered")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void exportLogs()}>{t("common.export")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={clear}>{t("common.clear")}</button>
        </div>
      </div>

      <div className="diagnostics-logs-filters">
        <select className="diagnostics-logs-filter" value={level} onChange={(event) => setLevel(event.target.value as LogLevel | "all")} aria-label={t("logs.filterLevelAria")}>
          <option value="all">{t("logs.allLevels")}</option>
          <option value="debug">{t("logs.level.debug")}</option>
          <option value="info">{t("logs.level.info")}</option>
          <option value="warn">{t("logs.level.warn")}</option>
          <option value="error">{t("logs.level.error")}</option>
        </select>
        <select className="diagnostics-logs-filter" value={source} onChange={(event) => setSource(event.target.value)} aria-label={t("logs.filterSourceAria")}>
          <option value="all">{t("logs.allSources")}</option>
          {sources.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="diagnostics-logs-search advanced-settings-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("logs.searchPlaceholder")} aria-label={t("logs.searchAria")} />
      </div>

      <div className="diagnostics-logs-list" role="listbox" aria-label={t("logs.listAria")}>
        {filtered.length ? filtered.map((entry) => (
          <button
            type="button"
            key={entry.id}
            role="option"
            aria-selected={selectedId === entry.id}
            className={`diagnostics-log-row${selectedId === entry.id ? " is-selected" : ""}`}
            onClick={() => setSelectedId((current) => (current === entry.id ? null : entry.id))}
          >
            <time title={dateTimeService.formatFullTimestamp(entry.timestamp)}>{dateTimeService.formatMessageTime(entry.timestamp)}</time>
            <em className={entry.level}>{entry.level}</em>
            <strong title={entry.message}>{entry.message}</strong>
            <span title={entry.source ?? "app"}>{entry.source ?? "app"}</span>
          </button>
        )) : (
          <div className="diagnostics-logs-empty">{t("logs.empty")}</div>
        )}
      </div>

      {selected ? (
        <div className="diagnostics-log-detail" aria-live="polite">
          <div className="diagnostics-log-detail-head">
            <strong>{selected.level.toUpperCase()} · {selected.source ?? "app"}</strong>
            <small>{dateTimeService.formatFullTimestamp(selected.timestamp)}</small>
          </div>
          <p>{selected.message}</p>
          {selected.metadata !== undefined ? (
            <pre className="diagnostics-log-detail-context">{JSON.stringify(loggingService.redactDiagnosticsValue(selected.metadata), null, 2)}</pre>
          ) : (
            <small>{t("logs.noContext")}</small>
          )}
        </div>
      ) : (
        <p className="diagnostics-logs-hint">{t("logs.hint")}</p>
      )}
    </section>
  );
}
