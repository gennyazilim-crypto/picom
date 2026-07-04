import type { Attachment } from "../types/community";

type AttachmentGridProps = {
  attachments: Attachment[];
  onOpenImage: (image: Attachment) => void;
};

export function AttachmentGrid({ attachments, onOpenImage }: AttachmentGridProps) {
  const visibleAttachments = attachments.slice(0, 4);

  return (
    <div className={`attachment-grid count-${Math.min(attachments.length, 4)}`}>
      {visibleAttachments.map((attachment) => (
        <button key={attachment.id} className="attachment-card" onClick={() => onOpenImage(attachment)} aria-label={`Open ${attachment.alt}`}>
          <img src={attachment.url} alt={attachment.alt} loading="lazy" />
        </button>
      ))}
    </div>
  );
}
