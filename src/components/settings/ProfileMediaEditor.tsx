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

const kindLabel = (kind: ProfileMediaKind) => kind === "avatar" ? "Profile photo" : "Cover photo";

export function ProfileMediaEditor({
  displayName,
  avatarUrl,
  coverUrl,
  onProfileUpdated,
}: ProfileMediaEditorProps) {
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
    return () => { active = false; };
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
    setNotice({ tone: "info", text: "Preparing your image securely..." });
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
    setNotice({ tone: "success", text: kindLabel(pending.kind) + " updated on every Picom surface." });
    setPending(null);
    window.setTimeout(() => setProgress(null), 900);
  }

  async function remove(kind: ProfileMediaKind): Promise<void> {
    if (busy) return;
    setConfirmRemove(null);
    setNotice({ tone: "info", text: "Removing " + kindLabel(kind).toLowerCase() + "..." });
    const result = await profileMediaService.remove(kind, kind === "avatar" ? resolvedAvatar : resolvedCover);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error.message });
      return;
    }
    onProfileUpdated(result.data);
    setNotice({ tone: "success", text: kindLabel(kind) + " removed." });
  }

  function onDrop(kind: ProfileMediaKind, event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDropTarget(kind);
    const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/"));
    if (file) void prepareFile(kind, file);
  }

  function onPaste(event: ClipboardEvent<HTMLElement>): void {
    const file = Array.from(event.clipboardData.files).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void prepareFile(dropTarget, file);
  }

  const renderActions = (kind: ProfileMediaKind, hasImage: boolean) => (
    <div className="profile-media-actions">
      <button type="button" className="secondary-button compact" disabled={busy} onClick={() => void choose(kind)}>
        <AppIcon name="image" size="sm" />Choose image
      </button>
      <button type="button" className="secondary-button compact danger" disabled={busy || !hasImage} onClick={() => setConfirmRemove(kind)}>
        <AppIcon name="trash" size="sm" />Remove
      </button>
    </div>
  );

  return (
    <section className="profile-media-editor" aria-label="Profile images" onPaste={onPaste}>
      <header>
        <div>
          <span className="settings-kicker">PROFILE MEDIA</span>
          <h3>Photo and cover</h3>
          <p>Images are cropped locally, converted to WebP, and synchronized securely across Picom.</p>
        </div>
      </header>

      <div className="profile-media-card-grid">
        <article
          className="profile-media-card"
          onDragEnter={() => setDropTarget("avatar")}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop("avatar", event)}
        >
          <div className="profile-media-card-copy">
            <strong>Profile photo</strong>
            <span>Square image, at least 128 x 128. PNG, JPG, or WebP.</span>
          </div>
          <div className="profile-media-avatar-preview">
            <UserAvatar userId={ownerId} displayName={displayName} fallbackUrl={resolvedAvatar} size={96} priority="eager" />
          </div>
          {renderActions("avatar", Boolean(resolvedAvatar || media.record?.avatar.path))}
        </article>

        <article
          className="profile-media-card profile-media-card--cover"
          onDragEnter={() => setDropTarget("cover")}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop("cover", event)}
        >
          <div className="profile-media-card-copy">
            <strong>Cover photo</strong>
            <span>Wide image, at least 640 x 200. Keep important content centered.</span>
          </div>
          <ProfileCover userId={ownerId} fallbackUrl={resolvedCover} label={displayName + " cover preview"} className="profile-media-cover-preview" />
          {renderActions("cover", Boolean(resolvedCover || media.record?.cover.path))}
        </article>
      </div>

      <p className="profile-media-drop-hint"><AppIcon name="image" size="sm" />Drop an image on either card, or paste into this panel after selecting a card.</p>
      {notice ? <div className={"profile-media-notice " + notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div> : null}
      {progress ? (
        <div className="profile-media-progress" role="status" aria-live="polite">
          <div><span>{progress.stage}</span><strong>{progress.percent}%</strong></div>
          <progress max={100} value={progress.percent} />
        </div>
      ) : null}

      <input ref={avatarInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        event.currentTarget.value = "";
        if (file) void prepareFile("avatar", file);
      }} />
      <input ref={coverInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        event.currentTarget.value = "";
        if (file) void prepareFile("cover", file);
      }} />

      {pending ? (
        <div className="profile-media-dialog-backdrop" role="presentation">
          <section className="profile-media-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-media-crop-title">
            <header>
              <div><span className="settings-kicker">CROP AND PREVIEW</span><h3 id="profile-media-crop-title">{kindLabel(pending.kind)}</h3></div>
              <button type="button" className="icon-button" aria-label="Close image editor" disabled={busy} onClick={() => setPending(null)}>
                <AppIcon name="close" size="md" />
              </button>
            </header>
            <div className={"profile-media-crop-stage " + pending.kind}>
              <img
                src={pending.previewUrl}
                alt="Crop preview"
                style={{ transform: "translate(" + crop.offsetX + "%, " + crop.offsetY + "%) scale(" + crop.zoom + ") rotate(" + crop.rotation + "deg)" }}
              />
              <span aria-hidden="true" />
            </div>
            <div className="profile-media-crop-controls">
              <label>Zoom<input type="range" min="1" max="3" step=".05" value={crop.zoom} onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} /></label>
              <label>Horizontal<input type="range" min="-100" max="100" value={crop.offsetX} onChange={(event) => setCrop({ ...crop, offsetX: Number(event.target.value) })} /></label>
              <label>Vertical<input type="range" min="-100" max="100" value={crop.offsetY} onChange={(event) => setCrop({ ...crop, offsetY: Number(event.target.value) })} /></label>
            </div>
            <footer>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setCrop(INITIAL_CROP)}>Reset</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setCrop({ ...crop, rotation: (crop.rotation + 90) % 360 })}>Rotate 90 degrees</button>
              <span />
              {busy ? <button type="button" className="secondary-button danger" onClick={() => abortRef.current?.abort()}>Cancel upload</button> : null}
              <button type="button" className="primary-button" disabled={busy} onClick={() => void savePending()}>Save image</button>
            </footer>
          </section>
        </div>
      ) : null}

      {confirmRemove ? (
        <div className="profile-media-dialog-backdrop" role="presentation">
          <section className="profile-media-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="profile-media-remove-title">
            <AppIcon name="trash" size="lg" />
            <h3 id="profile-media-remove-title">Remove {kindLabel(confirmRemove).toLowerCase()}?</h3>
            <p>Picom will replace it with your initials or the default cover across every active session.</p>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button type="button" className="primary-button danger" onClick={() => void remove(confirmRemove)}>Remove</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
