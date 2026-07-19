import { useEffect, useMemo, useRef, useState } from "react";
import type { CommunityStickerPack } from "../types/stickers";
import { stickerPackService } from "../services/stickerPackService";
import { AppIcon } from "./AppIcon";
import "./CommunityStickersAdminSection.css";

export function CommunityStickersAdminSection({
  communityId,
  currentUserId,
  canManage,
}: {
  communityId: string;
  currentUserId: string;
  canManage: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packs, setPacks] = useState<CommunityStickerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [packName, setPackName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const [stickerName, setStickerName] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creatingPack, setCreatingPack] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void stickerPackService.list(communityId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.ok) {
        setPacks(result.data);
        setSelectedPackId((current) => current || result.data[0]?.id || "");
      } else {
        setNotice({ error: true, text: result.message });
      }
    });
    return () => {
      active = false;
    };
  }, [communityId]);

  const counts = useMemo(
    () =>
      packs.reduce(
        (summary, pack) => {
          if (pack.moderationStatus === "disabled") summary.disabled += 1;
          else summary.active += 1;
          summary.stickers += pack.stickers.length;
          return summary;
        },
        { active: 0, disabled: 0, stickers: 0 },
      ),
    [packs],
  );

  const createPack = async () => {
    if (creatingPack) return;
    setCreatingPack(true);
    setNotice(null);
    const result = await stickerPackService.createPack({
      communityId,
      name: packName,
      description,
      ownerId: currentUserId,
      canManage,
    });
    setCreatingPack(false);
    if (result.ok) {
      setPacks((current) => [...current, result.data]);
      setSelectedPackId(result.data.id);
      setPackName("");
      setDescription("");
      setNotice({ error: false, text: "Sticker pack created." });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  const upload = async () => {
    if (!file || !selectedPackId || uploading) return;
    setUploading(true);
    setNotice(null);
    const result = await stickerPackService.addSticker({
      communityId,
      packId: selectedPackId,
      name: stickerName,
      title,
      file,
      createdBy: currentUserId,
      canManage,
    });
    setUploading(false);
    if (result.ok) {
      setPacks((current) =>
        current.map((pack) =>
          pack.id === selectedPackId ? { ...pack, stickers: [...pack.stickers, result.data] } : pack,
        ),
      );
      setStickerName("");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice({ error: false, text: "Sticker uploaded safely." });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  const togglePack = async (pack: CommunityStickerPack) => {
    const enabled = pack.moderationStatus !== "active";
    setNotice(null);
    const result = await stickerPackService.setPackEnabled({
      communityId,
      packId: pack.id,
      enabled,
      canManage,
    });
    if (result.ok) {
      setPacks((current) =>
        current.map((item) =>
          item.id === pack.id ? { ...item, moderationStatus: enabled ? "active" : "disabled" } : item,
        ),
      );
      setNotice({
        error: false,
        text: enabled ? "Sticker pack enabled." : "Sticker pack disabled.",
      });
    } else {
      setNotice({ error: true, text: result.message });
    }
  };

  return (
    <section className="community-admin-section community-stickers-section">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Community expression</p>
          <h3>Sticker packs</h3>
          <p>Community-owned packs only. Marketplace publishing is not available.</p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true">
          <AppIcon name="image" size="md" />
        </span>
      </header>

      <div className="community-mgmt-card sticker-create-card">
        <div className="sticker-form-card-header">
          <div>
            <p className="community-mgmt-subcard-title">Create sticker pack</p>
            <span className="sticker-form-hint">Pack names are unique per community and visible to members.</span>
          </div>
          <button
            type="button"
            className="community-mgmt-action"
            disabled={!canManage || !packName.trim() || creatingPack}
            onClick={() => void createPack()}
          >
            <AppIcon name="plus" size="sm" />
            {creatingPack ? "Creating…" : "Create pack"}
          </button>
        </div>

        <div className="sticker-form-fields sticker-form-fields--two">
          <label className="community-mgmt-field">
            <span>Pack name</span>
            <input
              className="community-mgmt-input"
              value={packName}
              onChange={(event) => setPackName(event.target.value)}
              placeholder="team_moments"
              disabled={!canManage || creatingPack}
            />
          </label>
          <label className="community-mgmt-field">
            <span>Description</span>
            <input
              className="community-mgmt-input"
              value={description}
              maxLength={240}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Original team artwork"
              disabled={!canManage || creatingPack}
            />
          </label>
        </div>
      </div>

      <div className="community-mgmt-card sticker-upload-card">
        <div className="sticker-form-card-header">
          <div>
            <p className="community-mgmt-subcard-title">Upload sticker</p>
            <span className="sticker-form-hint">PNG, JPEG, WEBP, or GIF up to 512 KB. Slug and display title are both required.</span>
          </div>
          <button
            type="button"
            className="community-mgmt-action"
            disabled={!canManage || !selectedPackId || !stickerName.trim() || !title.trim() || !file || uploading}
            onClick={() => void upload()}
          >
            <AppIcon name="image" size="sm" />
            {uploading ? "Uploading…" : "Upload sticker"}
          </button>
        </div>

        <div className="sticker-form-fields sticker-form-fields--upload">
          <label className="community-mgmt-field">
            <span>Pack</span>
            <select
              className="community-mgmt-select"
              value={selectedPackId}
              disabled={!canManage || uploading || !packs.length}
              onChange={(event) => setSelectedPackId(event.target.value)}
            >
              <option value="">Select pack</option>
              {packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </label>

          <label className="community-mgmt-field">
            <span>Sticker slug</span>
            <input
              className="community-mgmt-input"
              value={stickerName}
              onChange={(event) => setStickerName(event.target.value)}
              placeholder="ship_it"
              disabled={!canManage || uploading}
            />
          </label>

          <label className="community-mgmt-field">
            <span>Display title</span>
            <input
              className="community-mgmt-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ship it"
              disabled={!canManage || uploading}
            />
          </label>

          <label className="community-mgmt-field sticker-file-field">
            <span>Image</span>
            <span className="sticker-file-picker">
              <span className="community-mgmt-action community-mgmt-action--ghost sticker-file-trigger">
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

      <div className="sticker-summary-metrics" aria-label="Sticker pack summary">
        <article className="sticker-metric sticker-metric--active">
          <span className="sticker-metric-icon" aria-hidden="true">
            <AppIcon name="image" size="sm" />
          </span>
          <strong>{counts.active}</strong>
          <span>Active packs</span>
        </article>
        <article className="sticker-metric sticker-metric--disabled">
          <span className="sticker-metric-icon" aria-hidden="true">
            <AppIcon name="lock" size="sm" />
          </span>
          <strong>{counts.disabled}</strong>
          <span>Disabled</span>
        </article>
        <article className="sticker-metric sticker-metric--total">
          <span className="sticker-metric-icon" aria-hidden="true">
            <AppIcon name="smile" size="sm" />
          </span>
          <strong>{counts.stickers}</strong>
          <span>Stickers</span>
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
          <strong>Loading sticker packs</strong>
          <span>Community sticker inventory is being prepared.</span>
        </div>
      ) : packs.length ? (
        <div className="sticker-pack-grid">
          {packs.map((pack) => {
            const disabled = pack.moderationStatus === "disabled";
            const previewStickers = pack.stickers.filter((sticker) => sticker.imageUrl).slice(0, 4);

            return (
              <article key={pack.id} className={`sticker-pack-card${disabled ? " is-disabled" : ""}`}>
                <div className="sticker-pack-thumb">
                  {previewStickers.length ? (
                    <div className="sticker-pack-preview-grid">
                      {previewStickers.map((sticker) => (
                        <img key={sticker.id} src={sticker.imageUrl} alt="" />
                      ))}
                    </div>
                  ) : (
                    <AppIcon name="image" size="lg" />
                  )}
                </div>

                <div className="sticker-pack-copy">
                  <div className="sticker-pack-title-row">
                    <strong>{pack.name}</strong>
                    <span
                      className={`community-mgmt-badge sticker-status-badge${disabled ? " sticker-status-badge--disabled" : " sticker-status-badge--active"}`}
                    >
                      {disabled ? "Disabled" : "Active"}
                    </span>
                  </div>
                  <span>{pack.stickers.length} stickers · owned by community manager</span>
                  {pack.description ? <small>{pack.description}</small> : null}
                </div>

                <button
                  type="button"
                  className="community-mgmt-action community-mgmt-action--ghost"
                  disabled={!canManage}
                  onClick={() => void togglePack(pack)}
                >
                  {disabled ? "Enable" : "Disable"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="community-mgmt-empty sticker-empty-state">
          <span className="sticker-empty-icon" aria-hidden="true">
            <AppIcon name="image" size="lg" />
          </span>
          <strong>No sticker packs yet</strong>
          <span>Create a pack first, then upload PNG, JPEG, WEBP, or GIF stickers for your community.</span>
        </div>
      )}
    </section>
  );
}
