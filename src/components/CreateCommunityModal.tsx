import { useEffect, useState } from "react";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;

type CreateCommunityModalProps = {
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
};

export function CreateCommunityModal({ onClose, onSubmit }: CreateCommunityModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const cleanedName = name.trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setError("Community name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit(cleanedName, description.trim() || undefined);
    } catch {
      setError("Could not create community. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="create-community-modal" aria-modal="true" role="dialog" aria-labelledby="create-community-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close create community" onClick={onClose}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        <span className="eyebrow">New community</span>
        <h2 id="create-community-title">Create a Picom community</h2>
        <p>Start with a clean desktop chat space. Channels and members can be expanded in the next setup steps.</p>

        <label className="auth-field">
          Community name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus placeholder="Aurora Studio" />
        </label>

        <label className="auth-field">
          Description <span className="optional-label">optional</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="What is this community for?" />
        </label>

        {error ? <div className="auth-error">{error}</div> : null}

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