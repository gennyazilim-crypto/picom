import { useMemo, useState } from "react";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import type { Channel, ChannelCategory, ChannelType } from "../types/community";
import { AppIcon } from "./AppIcon";

export type EditChannelFormValue = {
  name: string;
  type: ChannelType;
  topic: string;
  categoryId: string | null;
  isPrivate: boolean;
  publicReadEnabled: boolean;
};

type EditChannelModalProps = { channel: Channel; categories: ChannelCategory[]; onClose: () => void; onSubmit: (value: EditChannelFormValue) => Promise<void> };

export function EditChannelModal({ channel, categories, onClose, onSubmit }: EditChannelModalProps) {
  const [name, setName] = useState(channel.name);
  const [type, setType] = useState<ChannelType>(channel.type);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(channel.categoryId ?? categories[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const normalizedName = useMemo(() => name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").replace(/-+/g, "-").slice(0, 80), [name]);
  const dialogRef = useDialogFocusTrap<HTMLFormElement>(onClose);

  return <div className="channel-management-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form ref={dialogRef} tabIndex={-1} className="channel-management-modal" role="dialog" aria-modal="true" aria-labelledby="edit-channel-title" onSubmit={async (event) => {
      event.preventDefault();
      if (!normalizedName || saving) return;
      setSaving(true);
      try { await onSubmit({ name: normalizedName, type, topic: topic.trim(), categoryId, isPrivate: false, publicReadEnabled: true }); } finally { setSaving(false); }
    }}>
      <header><div><span className="eyebrow">Channel management</span><h2 id="edit-channel-title">Edit #{channel.name}</h2></div><button type="button" className="icon-button" aria-label="Close edit channel" onClick={onClose}><AppIcon name="close" size="md" /></button></header>
      <label>Channel name<input value={name} maxLength={80} autoFocus onChange={(event) => setName(event.target.value)} /><small>Saved as #{normalizedName || "channel-name"}</small></label>
      <div className="channel-management-row">
        <label>Type<select value={type} onChange={(event) => setType(event.target.value as ChannelType)}><option value="text">Text</option><option value="voice">Voice</option><option value="forum">Forum</option><option value="announcement">Announcement</option></select></label>
        <label>Category<select value={categoryId ?? ""} onChange={(event) => setCategoryId(event.target.value || null)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>
      <label>Topic<textarea value={topic} maxLength={300} rows={3} onChange={(event) => setTopic(event.target.value)} /></label>
      <footer><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="submit" className="send-button" disabled={!normalizedName || saving}>{saving ? "Saving..." : "Save changes"}</button></footer>
    </form>
  </div>;
}

type DeleteChannelModalProps = { channel: Channel; isLastChannel: boolean; onClose: () => void; onConfirm: (confirmationName: string) => Promise<void> };

export function DeleteChannelModal({ channel, isLastChannel, onClose, onConfirm }: DeleteChannelModalProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const matches = confirmationName.trim().toLowerCase() === channel.name.trim().toLowerCase();
  const dialogRef = useDialogFocusTrap<HTMLFormElement>(onClose);

  return <div className="channel-management-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form ref={dialogRef} tabIndex={-1} className="channel-management-modal channel-management-modal--danger" role="alertdialog" aria-modal="true" aria-labelledby="delete-channel-title" onSubmit={async (event) => {
      event.preventDefault();
      if (!matches || isLastChannel || deleting) return;
      setDeleting(true);
      try { await onConfirm(confirmationName); } finally { setDeleting(false); }
    }}>
      <header><div><span className="eyebrow">Danger zone</span><h2 id="delete-channel-title">Delete #{channel.name}?</h2></div><button type="button" className="icon-button" aria-label="Close delete channel" onClick={onClose}><AppIcon name="close" size="md" /></button></header>
      <p>Messages and attachments in this channel will no longer be available. This action cannot be undone.</p>
      {isLastChannel ? <div className="channel-management-warning">Create another channel before deleting the final channel.</div> : null}
      <label>Type <strong>{channel.name}</strong> to confirm<input value={confirmationName} autoFocus onChange={(event) => setConfirmationName(event.target.value)} /></label>
      <footer><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="submit" className="danger-action" disabled={!matches || isLastChannel || deleting}>{deleting ? "Deleting..." : "Delete channel"}</button></footer>
    </form>
  </div>;
}
