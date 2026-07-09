import { useEffect, useState } from "react";
import { feedbackService, type FeedbackDraft, type FeedbackIssueType } from "../../services/feedbackService";
import { AppIcon } from "../AppIcon";

type Props = { onClose: () => void; onNotice: (message: string, tone?: "info" | "success" | "error") => void };
const issueTypes: Array<{ value: FeedbackIssueType; label: string }> = [
  { value: "crash", label: "Crash" }, { value: "login_auth", label: "Login / auth" }, { value: "messaging", label: "Messaging" }, { value: "upload", label: "Upload" }, { value: "realtime", label: "Realtime" }, { value: "voice", label: "Voice" }, { value: "screen_share", label: "Screen share" }, { value: "ui_layout", label: "UI / layout" }, { value: "performance", label: "Performance" }, { value: "packaging_install", label: "Packaging / install" }, { value: "security_concern", label: "Security concern" }, { value: "other", label: "Other" },
];

export function FeedbackModal({ onClose, onNotice }: Props) {
  const [issueType, setIssueType] = useState<FeedbackIssueType>("ui_layout");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(true);

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const draft = (): FeedbackDraft => ({ issueType, title: title.trim(), description: description.trim(), includeDiagnostics, includeLogs });
  const copy = async () => { const result = await feedbackService.copyReport(draft()); onNotice(result.ok ? "Redacted report copied." : result.reason, result.ok ? "success" : "error"); };
  const submit = () => { if (!title.trim() || !description.trim()) { onNotice("Add a title and description before submitting.", "error"); return; } const result = feedbackService.submitPlaceholder(draft()); onNotice(`${result.message} Reference: ${result.referenceId}.`, "success"); };

  return <div className="feedback-modal-backdrop" onMouseDown={onClose}><section className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Beta support</p><h2 id="feedback-modal-title">Report an issue</h2><span>No external report is sent in this MVP.</span></div><button className="icon-button" type="button" aria-label="Close feedback" onClick={onClose}><AppIcon name="close" size="lg" /></button></header><div className="feedback-form"><label><span>Issue type</span><select value={issueType} onChange={(event) => setIssueType(event.target.value as FeedbackIssueType)}>{issueTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Title</span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Short, specific summary" /></label><label><span>Description</span><textarea value={description} maxLength={2000} rows={7} onChange={(event) => setDescription(event.target.value)} placeholder="What happened, what did you expect, and how can we reproduce it? Do not include secrets." /></label><label className="settings-toggle-row"><span><strong>Include diagnostics</strong><small>App/runtime state and safe service status only.</small></span><input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} /></label><label className="settings-toggle-row"><span><strong>Include recent redacted logs</strong><small>Passwords, tokens, cookies, keys, and authorization values are removed.</small></span><input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)} /></label></div><footer><button type="button" className="secondary-action" onClick={() => void copy()}><AppIcon name="paperclip" size="sm" /> Copy report</button><button type="button" className="send-button" onClick={submit}><AppIcon name="send" size="sm" /> Submit placeholder</button></footer></section></div>;
}
