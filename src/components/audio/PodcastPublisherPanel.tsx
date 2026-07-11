import { useEffect, useRef, useState } from "react";
import type { LegalDocumentId } from "../../data/legalDocuments";
import type { PodcastEpisode, PodcastSeries } from "../../types/audio";
import { podcastPublishingService, type PodcastUploadKind, type PodcastUploadProgress } from "../../services/audio/podcastPublishingService";
import { AppIcon } from "../AppIcon";
import { LegalDocumentModal } from "../legal/LegalDocumentModal";
import { formatAudioTime } from "./AudioProgressBar";

type PodcastPublisherPanelProps = { communityId: string; episode: PodcastEpisode | null; series: readonly PodcastSeries[]; canPublish: boolean; onClose: () => void; onChanged: (episode?: PodcastEpisode) => void };
type ConfirmAction = "unpublish" | "archive" | "delete" | null;

export function PodcastPublisherPanel({ communityId, episode, series, canPublish, onClose, onChanged }: PodcastPublisherPanelProps) {
  const [draft, setDraft] = useState<PodcastEpisode | null>(episode);
  const [title, setTitle] = useState(episode?.title ?? "");
  const [description, setDescription] = useState(episode?.description ?? "");
  const [seriesId, setSeriesId] = useState(episode?.seriesId ?? "");
  const [tags, setTags] = useState(episode?.tags.join(", ") ?? "");
  const [isExplicit, setIsExplicit] = useState(episode?.isExplicit ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<PodcastUploadProgress | null>(null);
  const [retryUpload, setRetryUpload] = useState<{ kind: PodcastUploadKind; file: File } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocumentId | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  const tagList = () => tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
  const incomplete = !draft?.audioUrl || !draft.durationSeconds || !title.trim();

  const saveMetadata = async (): Promise<PodcastEpisode | null> => {
    setError(null); setNotice(null); setBusy(true);
    const result = draft
      ? await podcastPublishingService.updateMetadata(draft.id, { title, description, seriesId: seriesId || undefined, hostUserId: draft.hostUserId, tags: tagList(), isExplicit })
      : await podcastPublishingService.createDraft({ communityId, title, description, seriesId: seriesId || undefined, tags: tagList(), isExplicit });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return null; }
    setDraft(result.data); setNotice(draft ? "Draft metadata saved." : "Private draft created."); onChanged(result.data); return result.data;
  };

  const upload = async (kind: PodcastUploadKind, file: File) => {
    if (!canPublish) { setError("Publisher permission is required to replace Podcast media."); return; }
    const target = draft ?? await saveMetadata(); if (!target) return;
    const controller = new AbortController(); abortRef.current = controller; setBusy(true); setError(null); setNotice(null); setRetryUpload({ kind, file });
    const result = await podcastPublishingService.uploadMedia({ episode: target, kind, file, signal: controller.signal, onProgress: setProgress });
    abortRef.current = null; setBusy(false);
    if (!result.ok) { setError(result.error); if (result.code === "CANCELED") setProgress(null); return; }
    setDraft(result.data); setRetryUpload(null); setNotice(kind === "audio" ? "Private episode audio uploaded." : "Cover artwork uploaded."); onChanged(result.data);
  };

  const lifecycle = async (action: Exclude<ConfirmAction, null>) => {
    if (!draft || !canPublish) return;
    setBusy(true); setError(null); setConfirmAction(null);
    const result = action === "unpublish" ? await podcastPublishingService.unpublish(draft.id) : action === "archive" ? await podcastPublishingService.archive(draft.id) : await podcastPublishingService.deleteEpisode(draft);
    setBusy(false);
    if (!result.ok) { setError("error" in result ? typeof result.error === "string" ? result.error : result.error.message : "Podcast action failed."); return; }
    if (action === "delete") { onChanged(); onClose(); return; }
    setDraft(result.data as PodcastEpisode); setNotice(action === "archive" ? "Episode archived." : "Episode returned to private drafts."); onChanged(result.data as PodcastEpisode);
  };

  const publish = async () => {
    if (!canPublish) return;
    const saved = await saveMetadata(); if (!saved) return;
    setBusy(true); const result = await podcastPublishingService.publish(saved.id); setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    setDraft(result.data); setNotice("Episode published to the community library."); onChanged(result.data);
  };

  return <section className="podcast-publisher-panel" aria-label={draft ? "Manage Podcast episode" : "Create Podcast draft"}>
    <header><div><span className="eyebrow">Private publishing workspace</span><h2>{draft ? "Manage episode" : "New episode draft"}</h2><p>Metadata saves privately until a Publisher completes the media and publishing checks.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close Podcast publisher"><AppIcon name="close" size="md" /></button></header>
    {error ? <div className="podcast-publisher-alert error" role="alert"><AppIcon name="bell" size="sm" /><span>{error}</span>{retryUpload ? <button type="button" disabled={busy} onClick={() => void upload(retryUpload.kind, retryUpload.file)}>Retry upload</button> : null}</div> : null}
    {notice ? <div className="podcast-publisher-alert success" role="status"><AppIcon name="bell" size="sm" /><span>{notice}</span></div> : null}
    <aside className="podcast-rights-notice"><AppIcon name="lock" size="sm" /><span><strong>Publish only content you are authorized to use.</strong><small>Podcast audio, artwork, notes, and guest material follow Picom's copyright and safety policies.</small></span><button type="button" onClick={() => setLegalDocument("acceptableUse")}>Acceptable Use</button><button type="button" onClick={() => setLegalDocument("guidelines")}>Community Guidelines</button></aside>
    <div className="podcast-publisher-grid">
      <div className="podcast-publisher-form">
        <label><span>Episode title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Description</span><textarea value={description} maxLength={12000} rows={6} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="podcast-publisher-row"><label><span>Series</span><select value={seriesId} onChange={(event) => setSeriesId(event.target.value)}><option value="">No series</option>{series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span>Tags</span><input value={tags} placeholder="Design, community" onChange={(event) => setTags(event.target.value)} /></label></div>
        <label className="podcast-explicit-toggle"><input type="checkbox" checked={isExplicit} onChange={(event) => setIsExplicit(event.target.checked)} /><span><strong>Explicit content</strong><small>Show a clear listener warning on this episode.</small></span></label>
        <div className="podcast-publisher-actions"><button type="button" disabled={busy || !title.trim()} onClick={() => void saveMetadata()}><AppIcon name="edit" size="sm" />Save draft</button>{canPublish && draft?.status !== "published" ? <button type="button" className="primary-button" disabled={busy || incomplete} title={incomplete ? "A title and valid audio are required." : undefined} onClick={() => void publish()}><AppIcon name="send" size="sm" />Publish</button> : null}</div>
      </div>
      <aside className="podcast-publisher-media">
        <div className="podcast-publisher-cover">{draft?.coverUrl ? <img src={draft.coverUrl} alt="Episode cover preview" /> : <AppIcon name="image" size="xl" />}</div>
        {canPublish ? <div className="podcast-upload-controls"><label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(event) => { const file=event.target.files?.[0]; if(file) void upload("cover",file); event.currentTarget.value=""; }} /><AppIcon name="image" size="sm" />{draft?.coverUrl ? "Replace cover" : "Upload cover"}</label><label><input type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm" disabled={busy} onChange={(event) => { const file=event.target.files?.[0]; if(file) void upload("audio",file); event.currentTarget.value=""; }} /><AppIcon name="paperclip" size="sm" />{draft?.audioUrl ? "Replace audio" : "Upload audio"}</label></div> : null}
        {progress ? <div className="podcast-upload-progress" role="status"><div><span>{progress.label}</span><strong>{progress.percent}%</strong></div><progress max={100} value={progress.percent} />{busy && abortRef.current ? <button type="button" onClick={() => abortRef.current?.abort()}>Cancel upload</button> : null}</div> : null}
        {draft?.audioUrl ? <div className="podcast-audio-preview"><div><AppIcon name="headphones" size="sm" /><span><strong>Private preview</strong><small>{formatAudioTime(draft.durationSeconds)} · {draft.audioMimeType ?? "Audio"}</small></span></div><audio controls preload="metadata" src={draft.audioUrl}>Your desktop runtime cannot preview this audio.</audio></div> : <p className="podcast-media-empty">Upload validated private audio before publishing.</p>}
        {draft && canPublish ? <div className="podcast-danger-actions">{draft.status === "published" ? <button type="button" onClick={() => setConfirmAction("unpublish")}>Unpublish</button> : null}<button type="button" onClick={() => setConfirmAction("archive")}>Archive</button>{draft.status !== "published" ? <button type="button" className="danger" onClick={() => setConfirmAction("delete")}><AppIcon name="trash" size="sm" />Delete</button> : null}</div> : null}
      </aside>
    </div>
    {confirmAction ? <div className="podcast-confirm-backdrop" role="presentation" onMouseDown={() => setConfirmAction(null)}><div className="podcast-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="podcast-confirm-title" onMouseDown={(event) => event.stopPropagation()}><AppIcon name={confirmAction === "delete" ? "trash" : "bell"} size="lg" /><h3 id="podcast-confirm-title">Confirm {confirmAction}</h3><p>{confirmAction === "delete" ? "This permanently removes the private draft and its managed media." : confirmAction === "archive" ? "This removes the episode from the active library while retaining controlled metadata." : "This returns the episode to the private Drafts workspace."}</p><footer><button type="button" onClick={() => setConfirmAction(null)}>Cancel</button><button type="button" className={confirmAction === "delete" ? "danger" : "primary-button"} onClick={() => void lifecycle(confirmAction)}>Confirm</button></footer></div></div> : null}
    {legalDocument ? <LegalDocumentModal documentId={legalDocument} onClose={() => setLegalDocument(null)} /> : null}
  </section>;
}
