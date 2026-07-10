import { useState } from "react";
import { communityTemplates } from "../data/communityTemplates";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import type { CommunityTemplateId } from "../types/communityTemplates";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;

type CreateCommunityModalProps = {
  onClose: () => void;
  onSubmit: (name: string, description?: string, templateId?: CommunityTemplateId) => Promise<void>;
};

export function CreateCommunityModal({ onClose, onSubmit }: CreateCommunityModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<CommunityTemplateId>("custom");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedTemplate = communityTemplates.find((template) => template.id === templateId) ?? communityTemplates[0];
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);

  const submit = async () => {
    const cleanedName = name.trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setError("Community name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit(cleanedName, description.trim() || undefined, templateId);
    } catch {
      setError("Could not create community. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="create-community-modal" aria-modal="true" role="dialog" aria-labelledby="create-community-title" aria-describedby="create-community-description" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close create community" onClick={onClose}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        <span className="eyebrow">New community</span>
        <h2 id="create-community-title">Create a Picom community</h2>
        <p id="create-community-description">Start with a clean desktop chat space. Channels and members can be expanded in the next setup steps.</p>

        <div className="template-picker" aria-label="Community template selection">
          {communityTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={template.id === templateId ? "selected" : ""}
              onClick={() => setTemplateId(template.id)}
              style={{ "--template-accent": template.accentColor } as React.CSSProperties}
            >
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>

        <div className="template-preview">
          <strong>{selectedTemplate.name} preview</strong>
          <span>{selectedTemplate.categories.flatMap((category) => category.channels).length} channels prepared</span>
          <ul>
            {selectedTemplate.categories.flatMap((category) => category.channels).slice(0, 6).map((channel) => (
              <li key={`${selectedTemplate.id}-${channel.name}`}>{channel.type === "voice" ? "voice" : "#"} {channel.name}</li>
            ))}
          </ul>
        </div>

        <label className="auth-field">
          Community name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus data-dialog-initial-focus placeholder="Aurora Studio" />
        </label>

        <label className="auth-field">
          Description <span className="optional-label">optional</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="What is this community for?" />
        </label>

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <div className="modal-actions-row">
          <button className="secondary-action" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="send-button" onClick={submit} disabled={saving || !name.trim()}>
            <AppIcon name="plus" size="sm" />
            {saving ? "Creating..." : "Create community"}
          </button>
        </div>
      </section>
    </div>
  );
}
