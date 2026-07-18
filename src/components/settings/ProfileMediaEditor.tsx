import { useEffect, useRef, useState } from "react";
import type { ProfileSummary } from "../../services/profileService";
import { profileMediaService, type ProfileMediaKind, type ProfileMediaProgress } from "../../services/profileMediaService";
import { fileService } from "../../services/fileService";
import { AppIcon } from "../AppIcon";
import "./ProfileMediaEditor.css";

type SlotState = { file: File | null; previewUrl: string | null; busy: boolean; progress: ProfileMediaProgress | null; error: string | null };
const emptySlot: SlotState = { file: null, previewUrl: null, busy: false, progress: null, error: null };

type ProfileMediaEditorProps = {
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  onProfileUpdated: (profile: ProfileSummary) => void;
  onNotice: (message: string, tone?: "info" | "error" | "success") => void;
};

function hasNativeImagePicker(): boolean {
  return typeof window !== "undefined" && typeof window.picomDesktop?.file?.pickImages === "function";
}

export function ProfileMediaEditor({ displayName, avatarUrl, coverUrl, onProfileUpdated, onNotice }: ProfileMediaEditorProps) {
  const [avatar, setAvatar] = useState<SlotState>(emptySlot);
  const [cover, setCover] = useState<SlotState>(emptySlot);
  const previewUrls = useRef(new Set<string>());
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const stateFor = (kind: ProfileMediaKind) => kind === "avatar" ? avatar : cover;
  const setStateFor = (kind: ProfileMediaKind, value: SlotState | ((current: SlotState) => SlotState)) => {
    if (kind === "avatar") setAvatar(value); else setCover(value);
  };
  const inputRefFor = (kind: ProfileMediaKind) => kind === "avatar" ? avatarInputRef : coverInputRef;

  const upload = async (kind: ProfileMediaKind, slotOverride?: SlotState) => {
    const slot = slotOverride ?? stateFor(kind);
    if (!slot.file || slot.busy) return;
    const previousUrl = kind === "avatar" ? avatarUrl : coverUrl;
    setStateFor(kind, { ...slot, busy: true, error: null, progress: { percent: 1, stage: "validating" } });
    const result = await profileMediaService.replace(kind, slot.file, {
      previousUrl,
      onProgress: (progress) => setStateFor(kind, (current) => ({ ...current, progress })),
    });
    if (!result.ok) {
      setStateFor(kind, (current) => ({ ...current, busy: false, error: result.error.message }));
      onNotice(result.error.message, "error");
      return;
    }
    const committedUrl = kind === "avatar" ? result.data.avatarUrl : result.data.coverUrl;
    // Keep the local preview until parent props catch up so the tile never flashes empty.
    setStateFor(kind, (current) => ({
      ...current,
      file: null,
      busy: false,
      progress: null,
      error: null,
      previewUrl: current.previewUrl ?? committedUrl ?? null,
    }));
    onProfileUpdated(result.data);
    onNotice(`${kind === "avatar" ? "Profile photo" : "Cover image"} updated.`, "success");
    if (slot.previewUrl && committedUrl) {
      window.setTimeout(() => {
        URL.revokeObjectURL(slot.previewUrl!);
        previewUrls.current.delete(slot.previewUrl!);
        setStateFor(kind, (current) => (current.previewUrl === slot.previewUrl ? { ...current, previewUrl: null } : current));
      }, 750);
    }
  };

  const selectFile = async (kind: ProfileMediaKind, file: File | null) => {
    const previous = stateFor(kind);
    if (previous.previewUrl) { URL.revokeObjectURL(previous.previewUrl); previewUrls.current.delete(previous.previewUrl); }
    if (!file) { setStateFor(kind, emptySlot); return; }
    const validation = await profileMediaService.validateFile(kind, file);
    if (!validation.ok) {
      setStateFor(kind, { ...emptySlot, error: validation.error.message });
      onNotice(validation.error.message, "error");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    const next: SlotState = { file, previewUrl, busy: false, progress: null, error: null };
    setStateFor(kind, next);
    await upload(kind, next);
  };

  const chooseWithNativePicker = async (kind: ProfileMediaKind) => {
    if (stateFor(kind).busy) return;
    const native = await fileService.pickImages();
    if (!native.ok) {
      // Keep the user-gesture chain: fall back without awaiting more work before open is impossible,
      // so open the hidden input only when the previous dialog truly failed.
      onNotice(native.reason || "Native image picker is unavailable. Use the Upload button again.", "error");
      inputRefFor(kind).current?.click();
      return;
    }
    if (native.canceled) return;
    const file = native.files[0] ?? null;
    if (!file) {
      onNotice("Choose a PNG, JPG, or WEBP image.", "error");
      return;
    }
    await selectFile(kind, file);
  };

  const remove = async (kind: ProfileMediaKind) => {
    const currentUrl = kind === "avatar" ? avatarUrl : coverUrl;
    if (!currentUrl || stateFor(kind).busy) return;
    setStateFor(kind, (current) => ({ ...current, busy: true, error: null, progress: { percent: 70, stage: "saving" } }));
    const result = await profileMediaService.remove(kind, currentUrl);
    if (!result.ok) {
      setStateFor(kind, (current) => ({ ...current, busy: false, error: result.error.message }));
      onNotice(result.error.message, "error");
      return;
    }
    setStateFor(kind, emptySlot);
    onProfileUpdated(result.data);
    onNotice(`${kind === "avatar" ? "Profile photo" : "Cover image"} removed.`, "success");
  };

  const renderToolbar = (kind: ProfileMediaKind) => {
    const slot = stateFor(kind);
    const currentUrl = kind === "avatar" ? avatarUrl : coverUrl;
    const primaryLabel = slot.error
      ? "Retry upload"
      : slot.busy
        ? "Uploading..."
        : kind === "avatar"
          ? "Upload photo"
          : "Upload cover";
    const useNative = hasNativeImagePicker();

    return (
      <div className="profile-media-toolbar" role="group" aria-label={kind === "avatar" ? "Profile photo actions" : "Cover image actions"}>
        <input
          ref={inputRefFor(kind)}
          className="profile-media-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={slot.busy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            void selectFile(kind, file);
          }}
        />

        {useNative ? (
          <button
            type="button"
            className="settings-inline-action profile-media-action"
            disabled={slot.busy}
            onClick={() => void chooseWithNativePicker(kind)}
          >
            <AppIcon name="image" size="sm" />
            <span>{primaryLabel}</span>
          </button>
        ) : (
          <label className={`settings-inline-action profile-media-action profile-media-upload-label${slot.busy ? " is-disabled" : ""}`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={slot.busy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void selectFile(kind, file);
              }}
            />
            <AppIcon name="image" size="sm" />
            <span>{primaryLabel}</span>
          </label>
        )}

        {slot.file && slot.error ? (
          <button type="button" className="settings-inline-action settings-inline-action--ghost profile-media-action" disabled={slot.busy} onClick={() => void upload(kind)}>
            Retry failed upload
          </button>
        ) : null}

        <button type="button" className="settings-inline-action settings-inline-action--ghost profile-media-action profile-media-remove" disabled={!currentUrl || slot.busy} onClick={() => void remove(kind)}>
          <AppIcon name="trash" size="sm" />
          <span>Remove</span>
        </button>
      </div>
    );
  };

  const renderProgress = (kind: ProfileMediaKind) => {
    const slot = stateFor(kind);
    if (!slot.progress && !slot.error) return null;
    return (
      <div className="profile-media-feedback">
        {slot.progress ? (
          <div className="profile-media-progress" aria-live="polite">
            <progress max={100} value={slot.progress.percent} />
            <span>{slot.progress.stage} {slot.progress.percent}%</span>
          </div>
        ) : null}
        {slot.error ? <p role="alert">{slot.error}</p> : null}
      </div>
    );
  };

  const coverPreview = cover.previewUrl ?? coverUrl;
  const avatarPreview = avatar.previewUrl ?? avatarUrl;

  return (
    <section className="profile-media-editor" aria-label="Profile images">
      <article className="profile-media-card">
        <div className="profile-media-preview cover" aria-label="Cover image preview">
          {coverPreview ? <img src={coverPreview} alt={`${displayName} cover`} /> : <AppIcon name="image" size="xl" />}
        </div>
        <div className="profile-media-card-body">
          <div className="profile-media-card-head">
            <div className="profile-media-card-copy">
              <strong>Cover image</strong>
              <small>Wide PNG, JPG, or WEBP; 640 × 200 minimum; 8 MB maximum.</small>
            </div>
            {renderToolbar("cover")}
          </div>
          {renderProgress("cover")}
        </div>
      </article>

      <article className="profile-media-card profile-media-card--avatar">
        <div className="profile-media-card-layout">
          <div className="profile-media-preview avatar" aria-label="Profile photo preview">
            {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile photo`} /> : <AppIcon name="user" size="xl" />}
          </div>
          <div className="profile-media-card-body">
            <div className="profile-media-card-copy">
              <strong>Profile photo</strong>
              <small>Square PNG, JPG, or WEBP; 128 px minimum; 5 MB maximum.</small>
            </div>
            {renderToolbar("avatar")}
            {renderProgress("avatar")}
          </div>
        </div>
      </article>
    </section>
  );
}
