import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import type { ProfileSummary } from "../../services/profileService";
import {
  profileMediaService,
  type ProfileMediaCrop,
  type ProfileMediaKind,
  type ProfileMediaProgress,
} from "../../services/profileMediaService";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { fileService } from "../../services/fileService";
import { useProfileMedia } from "../../hooks/useProfileMedia";
import { UserAvatar } from "../UserAvatar";
import { ProfileCover } from "../ProfileCover";
import { AppIcon } from "../AppIcon";
import { translateSettings, type SettingsI18nKey } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";
import "./ProfileMediaEditor.css";

type ProfileMediaEditorProps = {
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  onProfileUpdated: (profile: ProfileSummary) => void;
  onNotice?: unknown;
};

type PendingImage = { kind: ProfileMediaKind; file: File; previewUrl: string };
const INITIAL_CROP: ProfileMediaCrop = { zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 };

const kindKey = (kind: ProfileMediaKind): SettingsI18nKey =>
  kind === "avatar" ? "profileMedia.kind.avatar" : "profileMedia.kind.cover";

export function ProfileMediaEditor({
  displayName,
  avatarUrl,
  coverUrl,
  onProfileUpdated,
  language,
}: ProfileMediaEditorProps & { language?: UiLanguage }) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: SettingsI18nKey, params?: Record<string, string | number>) => translateSettings(key, lang, params);
  const kindLabel = (kind: ProfileMediaKind) => t(kindKey(kind));
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [crop, setCrop] = useState<ProfileMediaCrop>(INITIAL_CROP);
  const [progress, setProgress] = useState<ProfileMediaProgress | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ProfileMediaKind | null>(null);
  const [dropTarget, setDropTarget] = useState<ProfileMediaKind>("avatar");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const media = useProfileMedia(ownerId);

  useEffect(() => {
    let active = true;
    void getSupabaseClient()?.auth.getUser().then(({ data }) => {
      if (active) setOwnerId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previewUrl = pending?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [pending?.previewUrl]);

  const resolvedAvatar = media.record?.avatar.thumbnailUrl ?? media.record?.avatar.url ?? avatarUrl ?? null;
  const resolvedCover = media.record?.cover.url ?? coverUrl ?? null;
  const busy = Boolean(progress && progress.stage !== "complete");
  const hasAvatar = Boolean(resolvedAvatar || media.record?.avatar.path);
  const hasCover = Boolean(resolvedCover || media.record?.cover.path);

  async function prepareFile(kind: ProfileMediaKind, file: File): Promise<void> {
    if (busy) return;
    setNotice(null);
    const validation = await profileMediaService.validateFile(kind, file);
    if (!validation.ok) {
      setNotice({ tone: "error", text: validation.error.message });
      return;
    }
    setCrop(INITIAL_CROP);
    setPending({ kind, file, previewUrl: URL.createObjectURL(file) });
  }

  async function choose(kind: ProfileMediaKind): Promise<void> {
    setDropTarget(kind);
    const native = await fileService.pickImages();
    if (native.ok) {
      if (!native.canceled && native.files[0]) await prepareFile(kind, native.files[0]);
      return;
    }
    (kind === "avatar" ? avatarInput.current : coverInput.current)?.click();
  }

  async function savePending(): Promise<void> {
    if (!pending || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ percent: 1, stage: "validating" });
    setNotice({ tone: "info", text: t("profileMedia.uploading") });
    const result = await profileMediaService.replace(pending.kind, pending.file, {
      previousUrl: pending.kind === "avatar" ? resolvedAvatar : resolvedCover,
      crop,
      signal: controller.signal,
      onProgress: setProgress,
    });
    abortRef.current = null;
    if (!result.ok) {
      setProgress(null);
      setNotice({ tone: "error", text: result.error.message });
      return;
    }
    onProfileUpdated(result.data);
    setProgress({ percent: 100, stage: "complete" });
    setNotice({ tone: "success", text: t("profileMedia.updated", { kind: kindLabel(pending.kind) }) });
    setPending(null);
    window.setTimeout(() => setProgress(null), 900);
  }

  async function remove(kind: ProfileMediaKind): Promise<void> {
    if (busy) return;
    setConfirmRemove(null);
    setNotice({ tone: "info", text: t("profileMedia.removing", { kind: kindLabel(kind).toLowerCase() }) });
    const result = await profileMediaService.remove(kind, kind === "avatar" ? resolvedAvatar : resolvedCover);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error.message });
      return;
    }
    onProfileUpdated(result.data);
    setNotice({ tone: "success", text: t("profileMedia.removed", { kind: kindLabel(kind) }) });
  }

  function onDrop(kind: ProfileMediaKind, event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDropTarget(kind);
    const file = Array.from(event.dataTransfer.files).find(
      (candidate) => !candidate.type || candidate.type.startsWith("image/"),
    );
    if (file) void prepareFile(kind, file);
    else setNotice({ tone: "error", text: t("profileMedia.dropImageOnly") });
  }

  function onPaste(event: ClipboardEvent<HTMLElement>): void {
    const file = Array.from(event.clipboardData.files).find(
      (candidate) => !candidate.type || candidate.type.startsWith("image/"),
    );
    if (!file) return;
    event.preventDefault();
    void prepareFile(dropTarget, file);
  }

  return (
    <section className="profile-media-editor" aria-label={t("profileMedia.aria")} onPaste={onPaste}>
      <div
        className={`profile-media-stage${dropTarget === "cover" ? " is-cover-target" : ""}${dropTarget === "avatar" ? " is-avatar-target" : ""}`}
        onDragOver={(event) => event.preventDefault()}
      >
        <button
          type="button"
          className="profile-media-cover-hit"
          disabled={busy}
          aria-label={t("profileMedia.changeCover")}
          onClick={() => void choose("cover")}
          onDragEnter={() => setDropTarget("cover")}
          onDrop={(event) => onDrop("cover", event)}
        >
          <ProfileCover
            userId={ownerId}
            fallbackUrl={resolvedCover}
            label={t("profileMedia.coverPreview", { name: displayName })}
            className="profile-media-cover-preview"
          />
          <span className="profile-media-cover-overlay">
            <AppIcon name="image" size="sm" />
            {hasCover ? t("profileMedia.changeCoverShort") : t("profileMedia.addCover")}
          </span>
        </button>

        <div
          className="profile-media-avatar-hit"
          onDragEnter={() => setDropTarget("avatar")}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop("avatar", event)}
        >
          <button
            type="button"
            className="profile-media-avatar-button"
            disabled={busy}
            aria-label={t("profileMedia.changePhoto")}
            onClick={() => void choose("avatar")}
          >
            <UserAvatar userId={ownerId} displayName={displayName} fallbackUrl={resolvedAvatar} size={96} priority="eager" />
            <span className="profile-media-avatar-overlay" aria-hidden="true">
              <AppIcon name="image" size="sm" />
            </span>
          </button>
          <div className="profile-media-avatar-meta">
            <strong>{displayName}</strong>
            <span>{t("profileMedia.formatHint")}</span>
          </div>
        </div>
      </div>

      <div className="profile-media-toolbar" role="group" aria-label={t("profileMedia.actionsAria")}>
        <div className="profile-media-toolbar-group">
          <button
            type="button"
            className="profile-media-tool profile-media-tool--primary"
            disabled={busy}
            onClick={() => void choose("avatar")}
          >
            <span className="profile-media-tool-icon" aria-hidden="true">
              <AppIcon name="user" size="sm" />
            </span>
            <span className="profile-media-tool-label">{hasAvatar ? t("profileMedia.changePhotoShort") : t("profileMedia.uploadPhoto")}</span>
          </button>
          <button
            type="button"
            className="profile-media-tool profile-media-tool--primary"
            disabled={busy}
            onClick={() => void choose("cover")}
          >
            <span className="profile-media-tool-icon" aria-hidden="true">
              <AppIcon name="image" size="sm" />
            </span>
            <span className="profile-media-tool-label">{hasCover ? t("profileMedia.changeCoverShort") : t("profileMedia.uploadCover")}</span>
          </button>
        </div>
        <div className="profile-media-toolbar-group profile-media-toolbar-group--danger">
          <button
            type="button"
            className="profile-media-tool profile-media-tool--danger"
            disabled={busy || !hasAvatar}
            onClick={() => setConfirmRemove("avatar")}
          >
            <span className="profile-media-tool-icon" aria-hidden="true">
              <AppIcon name="trash" size="sm" />
            </span>
            <span className="profile-media-tool-label">{t("profileMedia.removePhoto")}</span>
          </button>
          <button
            type="button"
            className="profile-media-tool profile-media-tool--danger"
            disabled={busy || !hasCover}
            onClick={() => setConfirmRemove("cover")}
          >
            <span className="profile-media-tool-icon" aria-hidden="true">
              <AppIcon name="trash" size="sm" />
            </span>
            <span className="profile-media-tool-label">{t("profileMedia.removeCover")}</span>
          </button>
        </div>
      </div>

      <p className="profile-media-drop-hint">
        <AppIcon name="image" size="sm" />
        {t("profileMedia.dropHint")}
      </p>

      {notice ? (
        <div className={`profile-media-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      ) : null}

      {progress ? (
        <div className="profile-media-progress" role="status" aria-live="polite">
          <div>
            <span>{progress.stage === "processing" ? t("profileMedia.stage.preparing") : progress.stage}</span>
            <strong>{progress.percent}%</strong>
          </div>
          <progress max={100} value={progress.percent} />
        </div>
      ) : null}

      <input
        ref={avatarInput}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) void prepareFile("avatar", file);
        }}
      />
      <input
        ref={coverInput}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) void prepareFile("cover", file);
        }}
      />

      {pending ? (
        <div className="profile-media-dialog-backdrop" role="presentation">
          <section className="profile-media-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-media-crop-title">
            <header>
              <div>
                <span className="settings-kicker">{t("profileMedia.adjustKicker")}</span>
                <h3 id="profile-media-crop-title">{kindLabel(pending.kind)}</h3>
              </div>
              <button type="button" className="icon-button" aria-label={t("profileMedia.closeEditor")} disabled={busy} onClick={() => setPending(null)}>
                <AppIcon name="close" size="md" />
              </button>
            </header>
            <div className={`profile-media-crop-stage ${pending.kind}`}>
              <img
                src={pending.previewUrl}
                alt={t("profileMedia.cropPreviewAlt")}
                style={{
                  transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom}) rotate(${crop.rotation}deg)`,
                }}
              />
              <span aria-hidden="true" />
            </div>
            <div className="profile-media-crop-controls">
              <label>
                {t("profileMedia.zoom")}
                <input
                  type="range"
                  min="1"
                  max="3"
                  step=".05"
                  value={crop.zoom}
                  onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })}
                />
              </label>
              <label>
                {t("profileMedia.horizontal")}
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={crop.offsetX}
                  onChange={(event) => setCrop({ ...crop, offsetX: Number(event.target.value) })}
                />
              </label>
              <label>
                {t("profileMedia.vertical")}
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={crop.offsetY}
                  onChange={(event) => setCrop({ ...crop, offsetY: Number(event.target.value) })}
                />
              </label>
            </div>
            <footer>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setCrop(INITIAL_CROP)}>
                {t("common.reset")}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setCrop({ ...crop, rotation: (crop.rotation + 90) % 360 })}
              >
                {t("common.rotate")}
              </button>
              <span />
              {busy ? (
                <button type="button" className="secondary-button danger" onClick={() => abortRef.current?.abort()}>
                  {t("profileMedia.cancelUpload")}
                </button>
              ) : null}
              <button type="button" className="primary-button" disabled={busy} onClick={() => void savePending()}>
                {t("common.save")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {confirmRemove ? (
        <div className="profile-media-dialog-backdrop" role="presentation">
          <section className="profile-media-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="profile-media-remove-title">
            <AppIcon name="trash" size="lg" />
            <h3 id="profile-media-remove-title">{t("profileMedia.removeConfirmTitle", { kind: kindLabel(confirmRemove).toLowerCase() })}</h3>
            <p>{t("profileMedia.removeConfirmBody")}</p>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setConfirmRemove(null)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="primary-button danger" onClick={() => void remove(confirmRemove)}>
                {t("common.remove")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
