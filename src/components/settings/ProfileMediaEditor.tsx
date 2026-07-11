import { useEffect, useRef, useState } from "react";
import type { ProfileSummary } from "../../services/profileService";
import { profileMediaService, type ProfileMediaKind, type ProfileMediaProgress } from "../../services/profileMediaService";
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

export function ProfileMediaEditor({ displayName, avatarUrl, coverUrl, onProfileUpdated, onNotice }: ProfileMediaEditorProps) {
  const [avatar, setAvatar] = useState<SlotState>(emptySlot);
  const [cover, setCover] = useState<SlotState>(emptySlot);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const stateFor = (kind: ProfileMediaKind) => kind === "avatar" ? avatar : cover;
  const setStateFor = (kind: ProfileMediaKind, value: SlotState | ((current: SlotState) => SlotState)) => {
    if (kind === "avatar") setAvatar(value); else setCover(value);
  };

  const selectFile = async (kind: ProfileMediaKind, file: File | null) => {
    const previous = stateFor(kind);
    if (previous.previewUrl) { URL.revokeObjectURL(previous.previewUrl); previewUrls.current.delete(previous.previewUrl); }
    if (!file) { setStateFor(kind, emptySlot); return; }
    const validation = await profileMediaService.validateFile(kind, file);
    if (!validation.ok) { setStateFor(kind, { ...emptySlot, error: validation.error.message }); return; }
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    setStateFor(kind, { file, previewUrl, busy: false, progress: null, error: null });
  };

  const upload = async (kind: ProfileMediaKind) => {
    const slot = stateFor(kind);
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
    if (slot.previewUrl) { URL.revokeObjectURL(slot.previewUrl); previewUrls.current.delete(slot.previewUrl); }
    setStateFor(kind, emptySlot);
    onProfileUpdated(result.data);
    onNotice(`${kind === "avatar" ? "Profile photo" : "Cover image"} updated.`, "success");
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

  const renderSlot = (kind: ProfileMediaKind) => {
    const slot = stateFor(kind);
    const currentUrl = kind === "avatar" ? avatarUrl : coverUrl;
    const preview = slot.previewUrl ?? currentUrl;
    const label = kind === "avatar" ? "Profile photo" : "Cover image";
    return (
      <article className={`profile-media-slot ${kind}`}>
        <div className="profile-media-preview" aria-label={`${label} preview`}>
          {preview ? <img src={preview} alt={`${displayName} ${label.toLowerCase()}`} /> : <AppIcon name={kind === "avatar" ? "user" : "image"} size="xl" />}
        </div>
        <div className="profile-media-copy"><strong>{label}</strong><small>{kind === "avatar" ? "Square PNG, JPG, or WEBP; 128 px minimum; 5 MB maximum." : "Wide PNG, JPG, or WEBP; 640 x 200 minimum; 8 MB maximum."}</small></div>
        <label className="profile-media-choose">
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={slot.busy} onChange={(event) => void selectFile(kind, event.target.files?.[0] ?? null)} />
          <AppIcon name="image" size="sm" />Choose
        </label>
        <button type="button" disabled={!slot.file || slot.busy} onClick={() => void upload(kind)}>{slot.error ? "Retry upload" : slot.busy ? "Uploading..." : "Upload"}</button>
        <button type="button" className="profile-media-remove" disabled={!currentUrl || slot.busy} onClick={() => void remove(kind)}><AppIcon name="trash" size="sm" />Remove</button>
        {slot.progress ? <div className="profile-media-progress" aria-live="polite"><progress max={100} value={slot.progress.percent} /><span>{slot.progress.stage} {slot.progress.percent}%</span></div> : null}
        {slot.error ? <p role="alert">{slot.error}</p> : null}
      </article>
    );
  };

  return <section className="profile-media-editor" aria-label="Profile images"><div className="profile-media-editor-grid">{renderSlot("avatar")}{renderSlot("cover")}</div></section>;
}
