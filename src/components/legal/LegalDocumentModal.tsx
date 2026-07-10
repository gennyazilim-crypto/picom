import { legalDocuments, type LegalDocumentId } from "../../data/legalDocuments";
import { AppIcon } from "../AppIcon";
import { useDialogFocusTrap } from "../../hooks/useDialogFocusTrap";

type Props = { documentId: LegalDocumentId; onClose: () => void };

export function LegalDocumentModal({ documentId, onClose }: Props) {
  const document = legalDocuments[documentId];
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);

  return (
    <div className="legal-modal-backdrop" onMouseDown={onClose}>
      <section ref={dialogRef} className="legal-document-modal" role="dialog" aria-modal="true" aria-labelledby="legal-document-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Picom legal placeholder</p><h2 id="legal-document-title">{document.title}</h2><span>{document.updatedLabel}</span></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close legal document"><AppIcon name="close" size="lg" /></button></header>
        <div className="legal-document-content">
          <p className="legal-review-banner"><AppIcon name="bell" size="sm" /> This beta draft is for product planning and requires professional legal review before production use.</p>
          {document.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.body}</p></section>)}
        </div>
      </section>
    </div>
  );
}
