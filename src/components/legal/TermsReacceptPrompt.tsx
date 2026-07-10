import { useState } from "react";
import { legalConfig } from "../../config/legalConfig";
import type { LegalDocumentId } from "../../data/legalDocuments";
import { AppIcon } from "../AppIcon";
import { LegalDocumentModal } from "./LegalDocumentModal";

type Props = { loading: boolean; error: string | null; onAccept: () => void; onSignOut: () => void };
export function TermsReacceptPrompt({ loading, error, onAccept, onSignOut }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [openDocument, setOpenDocument] = useState<LegalDocumentId | null>(null);
  return <main className="first-run-onboarding legal-reaccept-view" aria-label="Updated Picom terms">
    <section className="legal-reaccept-card" aria-labelledby="legal-reaccept-title">
      <span className="onboarding-welcome-orb"><AppIcon name="lock" size="xl" /></span>
      <p className="eyebrow">Policy update</p><h1 id="legal-reaccept-title">Review Picom's updated terms</h1>
      <p>Your previous acceptance does not cover version <strong>{legalConfig.currentVersion}</strong>. Review the beta legal drafts before continuing.</p>
      <div className="legal-reaccept-links"><button type="button" onClick={() => setOpenDocument("terms")}>Terms of Service <AppIcon name="chevronRight" size="sm" /></button><button type="button" onClick={() => setOpenDocument("privacy")}>Privacy Notice <AppIcon name="chevronRight" size="sm" /></button></div>
      <label className="legal-acceptance-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I accept the current Terms of Service and acknowledge the Privacy Notice.</span></label>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      <div className="legal-reaccept-actions"><button type="button" className="onboarding-secondary" onClick={onSignOut}>Sign out</button><button type="button" className="onboarding-primary" disabled={!confirmed || loading} onClick={onAccept}>{loading ? "Recording..." : "Accept and continue"}</button></div>
      <small>These documents remain legal-review drafts. Acceptance evidence records the version and server timestamp.</small>
    </section>
    {openDocument ? <LegalDocumentModal documentId={openDocument} onClose={() => setOpenDocument(null)} /> : null}
  </main>;
}
