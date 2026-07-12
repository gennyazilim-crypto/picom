import { useEffect, useMemo, useRef, useState } from "react";
import type { CommunityEmoji } from "../types/customEmoji";
import { customEmojiService } from "../services/customEmojiService";
import { dataSourceService } from "../services/dataSourceService";
import { AppIcon } from "./AppIcon";
import "./CommunityEmojisAdminSection.css";

export function CommunityEmojisAdminSection({
  communityId,
  currentUserId,
  canManage,
}: {
  communityId: string;
  currentUserId: string;
  canManage: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CommunityEmoji[]>(() =>
    dataSourceService.getStatus().isMock ? customEmojiService.listForManagement(communityId) : [],
  );
  const [loading, setLoading] = useState(!dataSourceService.getStatus().isMock);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CommunityEmoji | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    if (dataSourceService.getStatus().isMock) {
      setItems(customEmojiService.listForManagement(communityId));
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void customEmojiService.listRemote(communityId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.ok) setItems(result.data);
      else setNotice({ error: true, text: result.message });
    });
    return () => {
      active = false;
    };
  }, [communityId]);

  const counts = useMemo(
    () =>
      items.reduce(
        (summary, emoji) => {
          if (emoji.moderationStatus === "disabled") summary.disabled += 1;
          else summary.active += 1;
          return summary;
        },
        { active: 0, disabled: 0 },
      ),
    [items],
  );

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setNotice(null);
    const result = await customEmojiService.add({
      communityId,
      name,
      file,
      createdBy: currentUserId,
      canManage,
    });
    setUploading(false);
    if (result.ok) {
      setItems((current) => [...current, result.data]);
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice({ error: false, text: "Custom emoji uploaded safely." });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  const moderate = async (emoji: CommunityEmoji) => {
    const enabled = emoji.moderationStatus !== "active";
    setNotice(null);
    const result = await customEmojiService.setEnabled(communityId, emoji.id, enabled, canManage);
    if (result.ok) {
      setItems((current) =>
        current.map((item) =>
          item.id === emoji.id ? { ...item, moderationStatus: enabled ? "active" : "disabled" } : item,
        ),
      );
      setNotice({
        error: false,
        text: enabled ? "Custom emoji enabled." : "Custom emoji disabled for safety.",
      });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setNotice(null);
    const result = await customEmojiService.remove(communityId, pendingDelete.id, canManage);
    if (result.ok) {
      setItems((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
      setNotice({ error: false, text: "Custom emoji deleted." });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  return (
    <section className="community-admin-section community-emojis-section">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Community expression</p>
          <h3>Emojis</h3>
          <p>Validated PNG, JPEG, WEBP, or GIF files up to 512 KB. Names are unique per community.</p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true">
          <AppIcon name="smile" size="md" />
        </span>
      </header>

      <div className="community-mgmt-card emoji-upload-card">
        <div className="emoji-upload-card-header">
          <div>
            <p className="community-mgmt-subcard-title">Add custom emoji</p>
            <span className="emoji-upload-hint">Use lowercase names with underscores, e.g. team_wave</span>
          </div>
          <button
            type="button"
            className="community-mgmt-action"
            disabled={!canManage || !name.trim() || !file || uploading}
            onClick={() => void upload()}
          >
            <AppIcon name="plus" size="sm" />
            {uploading ? "Uploading…" : "Upload emoji"}
          </button>
        </div>

        <div className="emoji-upload-fields">
          <label className="community-mgmt-field">
            <span>Name</span>
            <input
              className="community-mgmt-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="team_wave"
              disabled={!canManage || uploading}
            />
          </label>

          <label className="community-mgmt-field emoji-file-field">
            <span>Image</span>
            <span className="emoji-file-picker">
              <span className="community-mgmt-action community-mgmt-action--ghost emoji-file-trigger">
                <AppIcon name="image" size="sm" />
                {file ? file.name : "Choose image"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={!canManage || uploading}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </span>
          </label>
        </div>
      </div>

      <div className="emoji-summary-metrics" aria-label="Emoji inventory summary">
        <article className="emoji-metric emoji-metric--active">
          <span className="emoji-metric-icon" aria-hidden="true">
            <AppIcon name="smile" size="sm" />
          </span>
          <strong>{counts.active}</strong>
          <span>Active</span>
        </article>
        <article className="emoji-metric emoji-metric--disabled">
          <span className="emoji-metric-icon" aria-hidden="true">
            <AppIcon name="lock" size="sm" />
          </span>
          <strong>{counts.disabled}</strong>
          <span>Disabled</span>
        </article>
        <article className="emoji-metric emoji-metric--total">
          <span className="emoji-metric-icon" aria-hidden="true">
            <AppIcon name="image" size="sm" />
          </span>
          <strong>{items.length}</strong>
          <span>Total</span>
        </article>
      </div>

      {notice ? (
        <p
          className={notice.error ? "community-mgmt-notice is-error" : "community-mgmt-notice"}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {loading ? (
        <div className="community-mgmt-empty" role="status">
          <strong>Loading custom emojis</strong>
          <span>Community emoji inventory is being prepared.</span>
        </div>
      ) : items.length ? (
        <div className="emoji-admin-grid">
          {items.map((emoji) => {
            const disabled = emoji.moderationStatus === "disabled";
            return (
              <article
                key={emoji.id}
                className={`emoji-admin-card${disabled ? " is-disabled" : ""}`}
                aria-disabled={disabled}
              >
                <div className="emoji-admin-thumb">
                  <img src={emoji.imageUrl} alt="" />
                </div>

                <div className="emoji-admin-copy">
                  <div className="emoji-admin-title-row">
                    <strong>:{emoji.name}:</strong>
                    <span
                      className={`community-mgmt-badge emoji-status-badge${disabled ? " emoji-status-badge--disabled" : " emoji-status-badge--active"}`}
                    >
                      {disabled ? "Disabled" : "Active"}
                    </span>
                  </div>
                  <span>{disabled ? "Disabled for safety" : "Active custom emoji"}</span>
                </div>

                <div className="emoji-admin-actions">
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost"
                    disabled={!canManage}
                    onClick={() => void moderate(emoji)}
                  >
                    {disabled ? "Enable" : "Disable"}
                  </button>
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger community-mgmt-action--icon"
                    aria-label={`Delete ${emoji.name}`}
                    disabled={!canManage}
                    onClick={() => setPendingDelete(emoji)}
                  >
                    <AppIcon name="trash" size="sm" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="community-mgmt-empty emoji-empty-state">
          <span className="emoji-empty-icon" aria-hidden="true">
            <AppIcon name="smile" size="lg" />
          </span>
          <strong>No custom emojis yet</strong>
          <span>Upload a PNG, JPEG, WEBP, or GIF to give your community unique reactions.</span>
        </div>
      )}

      {pendingDelete ? (
        <div className="emoji-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="emoji-delete-title">
          <span className="emoji-delete-icon" aria-hidden="true">
            <AppIcon name="trash" size="lg" />
          </span>
          <div className="emoji-delete-copy">
            <strong id="emoji-delete-title">Delete :{pendingDelete.name}:?</strong>
            <p>This removes the emoji from the community picker. Existing messages keep their rendered history.</p>
          </div>
          <footer className="community-mgmt-footer">
            <button
              type="button"
              className="community-mgmt-action community-mgmt-action--ghost"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </button>
            <button type="button" className="community-mgmt-action community-mgmt-action--danger" onClick={() => void remove()}>
              Delete emoji
            </button>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
