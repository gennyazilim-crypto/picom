import { useState } from "react";
import { AppIcon } from "../AppIcon";
import { FeedbackModal } from "../feedback/FeedbackModal";
import { remoteConfigService } from "../../services/remoteConfigService";
import { externalLinkService } from "../../services/externalLinkService";

export function FeedbackSection({ onNotice }: { onNotice: (message: string, tone?: "info" | "success" | "error") => void }) {
  const [open, setOpen] = useState(false);
  const openSupport = async () => { const url = remoteConfigService.getSnapshot().urls.supportUrl || "https://github.com/gennyazilim-crypto/picom/issues/new/choose"; const result = await externalLinkService.openExternalUrl(url); onNotice(result.ok ? "Support portal opened in your browser." : externalLinkService.getUserFriendlyError(result.reason), result.ok ? "success" : "error"); };
  return <><section className="diagnostics-card"><span className="diagnostics-card-icon"><AppIcon name="bell" size="lg" /></span><div><strong>Support and issue reporting</strong><p>Prepare a structured redacted report, or open the configured Picom support portal.</p></div><span className="settings-actions-row"><button type="button" onClick={() => setOpen(true)}>Prepare report</button><button type="button" onClick={() => void openSupport()}>Open support</button></span></section>{open ? <FeedbackModal onClose={() => setOpen(false)} onNotice={onNotice} /> : null}</>;
}
