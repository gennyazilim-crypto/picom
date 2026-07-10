import { useEffect, useMemo, useState } from "react";
import { loggingService, type LogEntry, type LogLevel } from "../../services/loggingService";
import { clipboardService } from "../../services/clipboardService";
import { fileService } from "../../services/fileService";
import { dateTimeService } from "../../services/dateTimeService";

export function LogsViewer({ onNotice }: { onNotice: (message: string, tone?: "info" | "success" | "error") => void }) {
  const [logs, setLogs] = useState<LogEntry[]>(() => loggingService.getLogs());
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => loggingService.onLog(() => setLogs(loggingService.getLogs())), []);
  const sources = useMemo(() => [...new Set(logs.map((entry) => entry.source).filter((value): value is string => Boolean(value)))].sort(), [logs]);
  const filtered = useMemo(() => logs.filter((entry) => (level === "all" || entry.level === level) && (source === "all" || entry.source === source) && `${entry.message} ${entry.source ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice().reverse(), [level, logs, query, source]);
  const selected = logs.find((entry) => entry.id === selectedId) ?? null;
  const copy = async () => { if (!selected) return; const result = await clipboardService.copyText(JSON.stringify(selected, null, 2)); onNotice(result.ok ? "Selected log copied." : result.reason, result.ok ? "success" : "error"); };
  const exportLogs = async () => { const result = await fileService.saveText(`picom-redacted-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, loggingService.exportLogs()); onNotice(result.ok ? (result.canceled ? "Log export canceled." : "Redacted logs exported.") : result.reason, result.ok && !result.canceled ? "success" : "info"); };
  const clear = () => { loggingService.clearLogs(); setLogs([]); setSelectedId(null); onNotice("Logs cleared.", "info"); };
  return <section className="logs-viewer"><header><div><p className="eyebrow">Redacted local history</p><h3>Logs</h3></div><div className="settings-actions-row"><button type="button" disabled={!selected} onClick={() => void copy()}>Copy selected</button><button type="button" onClick={() => void exportLogs()}>Export</button><button type="button" onClick={clear}>Clear</button></div></header><div className="logs-filters"><select value={level} onChange={(event) => setLevel(event.target.value as LogLevel | "all")}><option value="all">All levels</option><option value="debug">Debug</option><option value="info">Info</option><option value="warn">Warn</option><option value="error">Error</option></select><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs" /></div><div className="logs-list">{filtered.length ? filtered.map((entry) => <button type="button" key={entry.id} className={selectedId === entry.id ? "selected" : ""} onClick={() => setSelectedId(entry.id)}><time title={dateTimeService.formatFullTimestamp(entry.timestamp)}>{dateTimeService.formatMessageTime(entry.timestamp)}</time><em className={entry.level}>{entry.level}</em><strong>{entry.message}</strong><span>{entry.source ?? "app"}</span></button>) : <div className="empty-state compact">No logs match these filters.</div>}</div></section>;
}
