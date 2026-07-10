import { useEffect, useMemo, useState } from "react";
import type { ChannelType, Community } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;

export type CreateChannelFormValue = {
  name: string;
  type: ChannelType;
  categoryId: string | null;
  isPrivate: boolean;
  publicReadEnabled: boolean;
  allowedRoleIds: string[];
};

type CreateChannelModalProps = {
  community: Community;
  defaultCategoryId?: string | null;
  onClose: () => void;
  onSubmit: (value: CreateChannelFormValue) => Promise<void>;
};

function normalizePreview(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").replace(/-+/g, "-").slice(0, 80);
}

export function CreateChannelModal({ community, defaultCategoryId, onClose, onSubmit }: CreateChannelModalProps) {
  const firstCategoryId = community.categories[0]?.id ?? null;
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("text");
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId ?? firstCategoryId);
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicReadEnabled, setPublicReadEnabled] = useState(true);
  const permissionRoles = useMemo(() => community.roles.filter((role) => role.name === "Owner" || role.name === "Admin" || role.name === "Moderator"), [community.roles]);
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(() => permissionRoles.map((role) => role.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalizedName = useMemo(() => normalizePreview(name), [name]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleAllowedRole = (roleId: string) => {
    setAllowedRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]);
  };

  const submit = async () => {
    if (!normalizedName) {
      setError("Channel name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({ name: normalizedName, type, categoryId, isPrivate, publicReadEnabled: isPrivate ? false : publicReadEnabled, allowedRoleIds: isPrivate ? allowedRoleIds : [] });
    } catch {
      setError("Could not create channel. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="create-community-modal" aria-modal="true" role="dialog" aria-labelledby="create-channel-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" aria-label="Close create channel" onClick={onClose}>
          <AppIcon name={overlayIcons.close} size="lg" />
        </button>
        <span className="eyebrow">New channel</span>
        <h2 id="create-channel-title">Create a channel</h2>
        <p>Add a focused space inside {community.name}. Channel names are normalized for clean URLs and future Supabase routing.</p>

        <label className="auth-field">
          Channel name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus placeholder="Design reviews" />
        </label>

        <div className="channel-name-preview">
          <AppIcon name={type === "voice" ? "voice" : type === "announcement" ? "bell" : type === "forum" ? "inbox" : "hash"} size="sm" />
          <span>{normalizedName || "channel-name"}</span>
        </div>

        <label className="auth-field">
          Channel type
          <select value={type} onChange={(event) => setType(event.target.value as ChannelType)}>
            <option value="text">Text</option>
            <option value="voice">Voice placeholder</option>
            <option value="forum">Forum</option>
            <option value="announcement">Announcement</option>
          </select>
        </label>

        <label className="auth-field">
          Category
          <select value={categoryId ?? ""} onChange={(event) => setCategoryId(event.target.value || null)}>
            {community.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="channel-checkbox">
          <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
          <span>
            <strong>Private channel</strong>
            <em>Hidden from visitors and members without private-channel permission.</em>
          </span>
        </label>

        <label className="channel-checkbox">
          <input type="checkbox" checked={!isPrivate && publicReadEnabled} disabled={isPrivate} onChange={(event) => setPublicReadEnabled(event.target.checked)} />
          <span>
            <strong>Allow public reading</strong>
            <em>{isPrivate ? "Private channels are never public." : "Visitors may read when community public access is enabled."}</em>
          </span>
        </label>

        {isPrivate ? (
          <div className="private-channel-permissions" aria-label="Private channel role permissions placeholder">
            <span>Allowed roles placeholder</span>
            <p>Backend RLS will remain the source of truth later. This local setup records which roles should be allowed.</p>
            <div>
              {permissionRoles.map((role) => (
                <label key={role.id}>
                  <input type="checkbox" checked={allowedRoleIds.includes(role.id)} onChange={() => toggleAllowedRole(role.id)} />
                  <strong>{role.name}</strong>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="modal-actions-row">
          <button className="secondary-action" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="send-button" onClick={submit} disabled={saving || !normalizedName}>
            <AppIcon name="plus" size="sm" />
            {saving ? "Creating..." : "Create channel"}
          </button>
        </div>
      </section>
    </div>
  );
}
