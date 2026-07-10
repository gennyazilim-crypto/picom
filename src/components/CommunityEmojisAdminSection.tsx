import { useEffect, useState } from "react";
import type { CommunityEmoji } from "../types/customEmoji";
import { customEmojiService } from "../services/customEmojiService";
import { dataSourceService } from "../services/dataSourceService";
import { AppIcon } from "./AppIcon";

export function CommunityEmojisAdminSection({ communityId, currentUserId, canManage }: { communityId: string; currentUserId: string; canManage: boolean }) {
  const [items, setItems] = useState(() => dataSourceService.getStatus().isMock ? customEmojiService.listForManagement(communityId) : []);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommunityEmoji | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (dataSourceService.getStatus().isMock) { setItems(customEmojiService.listForManagement(communityId)); return; }
    void customEmojiService.listRemote(communityId).then((result) => result.ok ? setItems(result.data) : setNotice(result.message));
  }, [communityId]);

  const upload = async () => {
    if (!file) return;
    const result = await customEmojiService.add({ communityId, name, file, createdBy: currentUserId, canManage });
    if (result.ok) { setItems((current) => [...current, result.data]); setName(""); setFile(null); setNotice("Custom emoji uploaded safely."); }
    else setNotice(result.message);
  };
  const moderate = async (emoji: CommunityEmoji) => {
    const enabled = emoji.moderationStatus !== "active";
    const result = await customEmojiService.setEnabled(communityId, emoji.id, enabled, canManage);
    if (result.ok) { setItems((current) => current.map((item) => item.id === emoji.id ? { ...item, moderationStatus: enabled ? "active" : "disabled" } : item)); setNotice(enabled ? "Custom emoji enabled." : "Custom emoji disabled for safety."); }
    else setNotice(result.message);
  };
  const remove = async () => {
    if (!pendingDelete) return;
    const result = await customEmojiService.remove(communityId, pendingDelete.id, canManage);
    if (result.ok) { setItems((current) => current.filter((item) => item.id !== pendingDelete.id)); setPendingDelete(null); setNotice("Custom emoji deleted."); }
    else setNotice(result.message);
  };

  return <section className="community-admin-section emoji-admin-section">
    <header><p className="eyebrow">Community expression</p><h3>Emojis</h3><span>Validated PNG, JPEG, WEBP, or GIF files up to 512 KB. Names are unique per community.</span></header>
    <div className="emoji-upload-form">
      <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="team_wave" /></label>
      <label><span>Image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <button type="button" disabled={!canManage || !name.trim() || !file} onClick={() => void upload()}><AppIcon name="plus" size="sm" />Upload emoji</button>
    </div>
    {notice ? <p className="emoji-admin-notice" role="status">{notice}</p> : null}
    <div className="emoji-admin-grid">{items.map((emoji) => <article key={emoji.id} aria-disabled={emoji.moderationStatus === "disabled"}>
      <img src={emoji.imageUrl} alt="" />
      <div><strong>:{emoji.name}:</strong><span>{emoji.moderationStatus === "disabled" ? "Disabled for safety" : "Active custom emoji"}</span></div>
      <button className="secondary-action" type="button" disabled={!canManage} onClick={() => void moderate(emoji)}>{emoji.moderationStatus === "disabled" ? "Enable" : "Disable"}</button>
      <button className="danger-action" type="button" aria-label={`Delete ${emoji.name}`} disabled={!canManage} onClick={() => setPendingDelete(emoji)}><AppIcon name="trash" size="sm" /></button>
    </article>)}</div>
    {pendingDelete ? <div className="emoji-delete-confirm"><span>Delete :{pendingDelete.name}:?</span><button className="secondary-action" type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-action" type="button" onClick={() => void remove()}>Delete</button></div> : null}
  </section>;
}
