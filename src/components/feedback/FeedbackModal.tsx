import { useEffect, useState } from "react";
import { feedbackService, type FeedbackDraft, type FeedbackIssueType, type FeedbackSeverity } from "../../services/feedbackService";
import { AppIcon } from "../AppIcon";

type Props = { onClose: () => void; onNotice: (message: string, tone?: "info" | "success" | "error") => void };
const issueTypes: Array<{ value: FeedbackIssueType; label: string }> = [
  { value: "install_package", label: "Install / package" }, { value: "startup_crash", label: "Startup / crash" }, { value: "login_auth", label: "Login / auth" }, { value: "community_channel", label: "Community / channel" }, { value: "messaging", label: "Messaging" }, { value: "upload", label: "Upload" }, { value: "mention_feed", label: "Mention Feed" }, { value: "profile_page", label: "Profile page" }, { value: "permissions_rls", label: "Permissions / RLS" }, { value: "voice", label: "Voice" }, { value: "screen_share", label: "Screen share" }, { value: "performance", label: "Performance" }, { value: "ui_layout", label: "UI / layout" }, { value: "accessibility", label: "Accessibility" }, { value: "security_privacy", label: "Security / privacy" }, { value: "legal_policy", label: "Legal / policy" }, { value: "other", label: "Other" },
];
const severities: Array<{ value: FeedbackSeverity; label: string }> = [
  { value: "blocker", label: "Blocker" }, { value: "critical", label: "Critical" }, { value: "major", label: "Major" }, { value: "minor", label: "Minor" }, { value: "suggestion", label: "Suggestion" },
];

export function FeedbackModal({ onClose, onNotice }: Props) {
  const [issueType, setIssueType] = useState<FeedbackIssueType>("ui_layout");
  const [severity, setSeverity] = useState<FeedbackSeverity>("major");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [screenshotReference, setScreenshotReference] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(true);

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const draft = (): FeedbackDraft => ({ issueType, severity, title: title.trim(), description: description.trim(), stepsToReproduce: stepsToReproduce.trim(), expectedResult: expectedResult.trim(), actualResult: actualResult.trim(), screenshotReference: screenshotReference.trim() || undefined, includeDiagnostics, includeLogs });
  const copy = async () => {
    if (!title.trim() || !description.trim() || !stepsToReproduce.trim() || !expectedResult.trim() || !actualResult.trim()) {
      onNotice("Complete the summary, reproduction steps, expected result, and actual result.", "error");
      return;
    }
    const result = await feedbackService.copyReport(draft());
    onNotice(result.ok ? "Redacted report copied. No report was sent." : result.reason, result.ok ? "success" : "error");
  };

  return <div className="feedback-modal-backdrop" onMouseDown={onClose}><section className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Beta support</p><h2 id="feedback-modal-title">Report an issue</h2><span>Prepare a structured, redacted report for the approved beta support channel.</span></div><button className="icon-button" type="button" aria-label="Close feedback" onClick={onClose}><AppIcon name="close" size="lg" /></button></header><div className="feedback-form"><div className="feedback-form-grid"><label><span>Category</span><select value={issueType} onChange={(event) => setIssueType(event.target.value as FeedbackIssueType)}>{issueTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as FeedbackSeverity)}>{severities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><label><span>Title</span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Short, specific summary" /></label><label><span>Summary</span><textarea value={description} maxLength={1200} rows={3} onChange={(event) => setDescription(event.target.value)} placeholder="Briefly describe the problem. Do not include secrets or private content." /></label><label><span>Steps to reproduce</span><textarea value={stepsToReproduce} maxLength={2400} rows={5} onChange={(event) => setStepsToReproduce(event.target.value)} placeholder={"1. Open...\n2. Select...\n3. Observe..."} /></label><div className="feedback-form-grid"><label><span>Expected result</span><textarea value={expectedResult} maxLength={1200} rows={4} onChange={(event) => setExpectedResult(event.target.value)} /></label><label><span>Actual result</span><textarea value={actualResult} maxLength={1200} rows={4} onChange={(event) => setActualResult(event.target.value)} /></label></div><label><span>Screenshot reference (optional)</span><input value={screenshotReference} maxLength={260} onChange={(event) => setScreenshotReference(event.target.value)} placeholder="File name or approved support attachment reference" /></label><label className="settings-toggle-row"><span><strong>Include diagnostics</strong><small>Version, platform, runtime mode, and safe service status only.</small></span><input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} /></label><label className="settings-toggle-row"><span><strong>Include recent redacted logs</strong><small>Passwords, tokens, cookies, keys, authorization values, and private secrets are removed.</small></span><input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)} /></label></div><footer><button type="button" className="send-button" onClick={() => void copy()}><AppIcon name="paperclip" size="sm" /> Copy redacted report</button></footer></section></div>;
}
