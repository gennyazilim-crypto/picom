import { useState } from "react";
import { AppIcon } from "../AppIcon";
import { FeedbackModal } from "../feedback/FeedbackModal";

export function FeedbackSection({ onNotice }: { onNotice: (message: string, tone?: "info" | "success" | "error") => void }) {
  const [open, setOpen] = useState(false);
  return <><section className="diagnostics-card"><span className="diagnostics-card-icon"><AppIcon name="bell" size="lg" /></span><div><strong>Beta feedback</strong><p>Prepare a structured, redacted issue report for support.</p></div><button type="button" onClick={() => setOpen(true)}>Report issue</button></section>{open ? <FeedbackModal onClose={() => setOpen(false)} onNotice={onNotice} /> : null}</>;
}
