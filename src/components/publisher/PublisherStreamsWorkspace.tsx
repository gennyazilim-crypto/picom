import { useEffect, useState, type FormEvent } from "react";
import { localizationService } from "../../services/localizationService";
import {
  translatePublisherProgram,
  type PublisherProgramI18nKey,
} from "../../services/localization/publisherProgramCatalog";
import { featureFlagService } from "../../services/featureFlagService";
import { clipboardService } from "../../services/clipboardService";
import {
  publisherStreamManagementService,
  type PublisherStream,
  type PublisherStreamCredentialReveal,
  type PublisherStreamIngestMode,
  type PublisherStreamStatus,
  type PublisherStreamVisibility,
} from "../../services/live/publisherStreamManagementService";
import { LiveChatModeratorConsole } from "../live/LiveChatModeratorConsole";
import { translateLiveChat } from "../../services/localization/liveChatCatalog";
import "./PublisherStreamsWorkspace.css";

type Props = Readonly<{
  onGoLive: () => void;
  /** Optional live session to link after prepare on native Start. */
  liveSessionId?: string | null;
}>;

type SectionKey = "upcoming" | "drafts" | "live" | "past";

type FormState = {
  title: string;
  description: string;
  category: string;
  visibility: PublisherStreamVisibility;
  ingestMode: PublisherStreamIngestMode;
  scheduledAt: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "other",
  visibility: "public",
  ingestMode: "PICOM_NATIVE",
  scheduledAt: "",
};

const LIVE_STATUSES: readonly PublisherStreamStatus[] = ["connecting", "live", "reconnecting", "ending"];
const UPCOMING_STATUSES: readonly PublisherStreamStatus[] = ["scheduled", "ready"];

function t(key: PublisherProgramI18nKey, params?: Record<string, string | number>): string {
  return translatePublisherProgram(key, localizationService.getLanguage(), params);
}

function statusLabel(status: PublisherStreamStatus): string {
  return t(`streamStatus.${status}` as PublisherProgramI18nKey);
}

function sectionFor(status: PublisherStreamStatus): SectionKey {
  if (status === "draft") return "drafts";
  if (UPCOMING_STATUSES.includes(status)) return "upcoming";
  if (LIVE_STATUSES.includes(status)) return "live";
  return "past";
}

function toIsoLocal(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function PublisherStreamsWorkspace({ onGoLive, liveSessionId = null }: Props) {
  const streamMgmtEnabled = featureFlagService.isEnabled("enablePublisherStreamManagement");
  const externalIngestEnabled = featureFlagService.isEnabled("enablePublisherExternalIngest");
  const liveChatEnabled = featureFlagService.isEnabled("enableLiveChat");
  const liveModerationEnabled = featureFlagService.isEnabled("enableLiveModeration");

  const [streams, setStreams] = useState<PublisherStream[]>([]);
  const [section, setSection] = useState<SectionKey>("upcoming");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ingestByStream, setIngestByStream] = useState<Record<string, string>>({});
  /** One-time secret reveal — React state only; cleared on modal close. Never localStorage. */
  const [secretReveal, setSecretReveal] = useState<PublisherStreamCredentialReveal | null>(null);
  const [obsPanelStreamId, setObsPanelStreamId] = useState<string | null>(null);
  const [chatConsoleStreamId, setChatConsoleStreamId] = useState<string | null>(null);
  const [schedulePromptId, setSchedulePromptId] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");

  async function refresh() {
    const result = await publisherStreamManagementService.listStreams(null, 80);
    if (!result.ok) {
      setError(t(`streamErrors.${result.error.safeCode}` as PublisherProgramI18nKey) || result.error.message);
      setStreams([]);
      return;
    }
    setError(null);
    setStreams(result.data);
  }

  useEffect(() => {
    if (!streamMgmtEnabled) return;
    void refresh();
  }, [streamMgmtEnabled]);

  function closeSecretModal() {
    setSecretReveal(null);
  }

  async function handleCreateOrUpdate(event: FormEvent) {
    event.preventDefault();
    setBusyId("form");
    setError(null);
    const scheduledAt = toIsoLocal(form.scheduledAt);
    if (editingId) {
      const result = await publisherStreamManagementService.updateStream(editingId, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "other",
        visibility: form.visibility,
        scheduledAt,
      });
      setBusyId(null);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      setNotice(t("streams.updated"));
      await refresh();
      return;
    }
    const result = await publisherStreamManagementService.createStream({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || "other",
      visibility: form.visibility,
      ingestMode: form.ingestMode,
      scheduledAt,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setForm(EMPTY_FORM);
    setNotice(t("streams.created"));
    setSection(sectionFor(result.data.status));
    await refresh();
  }

  function beginEdit(stream: PublisherStream) {
    setEditingId(stream.id);
    setForm({
      title: stream.title,
      description: stream.description,
      category: stream.category,
      visibility: stream.visibility,
      ingestMode: stream.ingestMode,
      scheduledAt: stream.scheduledAt ? stream.scheduledAt.slice(0, 16) : "",
    });
    setNotice(null);
  }

  async function runAction(streamId: string, action: () => Promise<void>) {
    setBusyId(streamId);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("streamErrors.UNKNOWN_ERROR"));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePrepare(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.prepareStream(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setNotice(t("streams.prepared"));
    });
  }

  async function handleCancel(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.cancelStream(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setNotice(t("streams.cancelled"));
    });
  }

  async function handleScheduleSubmit(streamId: string) {
    const iso = toIsoLocal(scheduleAt);
    if (!iso) {
      setError(t("streamErrors.VALIDATION_ERROR"));
      return;
    }
    await runAction(streamId, async () => {
      const result = await publisherStreamManagementService.scheduleStream(streamId, iso);
      if (!result.ok) throw new Error(result.error.message);
      setSchedulePromptId(null);
      setScheduleAt("");
      setNotice(t("streams.scheduled"));
    });
  }

  async function handleNativeStart(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      let current = stream;
      if (current.status === "draft" || current.status === "scheduled") {
        const prepared = await publisherStreamManagementService.prepareStream(current.id);
        if (!prepared.ok) throw new Error(prepared.error.message);
        current = prepared.data;
      }
      const sessionToLink = liveSessionId || current.liveSessionId;
      if (sessionToLink) {
        const linked = await publisherStreamManagementService.linkLiveSession(current.id, sessionToLink);
        if (!linked.ok) throw new Error(linked.error.message);
        current = linked.data;
      }
      if (current.status === "ready") {
        const connecting = await publisherStreamManagementService.transitionStream(current.id, "connecting");
        if (!connecting.ok) throw new Error(connecting.error.message);
      }
      setNotice(t("controlRoom.nativeStartHint"));
      onGoLive();
    });
  }

  async function handleEnd(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      if (stream.status === "ending") {
        const ended = await publisherStreamManagementService.transitionStream(stream.id, "ended");
        if (!ended.ok) throw new Error(ended.error.message);
      } else {
        const ending = await publisherStreamManagementService.transitionStream(stream.id, "ending");
        if (!ending.ok) throw new Error(ending.error.message);
        const ended = await publisherStreamManagementService.transitionStream(stream.id, "ended");
        if (!ended.ok) throw new Error(ended.error.message);
      }
      setNotice(t("streams.ended"));
    });
  }

  async function handleCreateCredential(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.createCredential(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setIngestByStream((prev) => ({ ...prev, [stream.id]: result.data.ingestUrl }));
      setSecretReveal(result.data);
      setObsPanelStreamId(stream.id);
      setNotice(t("streamCredential.createdOnce"));
    });
  }

  async function handleRotateCredential(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.rotateCredential(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setIngestByStream((prev) => ({ ...prev, [stream.id]: result.data.ingestUrl }));
      setSecretReveal(result.data);
      setObsPanelStreamId(stream.id);
      setNotice(t("streamCredential.rotatedOnce"));
    });
  }

  async function handleRevokeCredential(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.revokeCredential(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setIngestByStream((prev) => {
        const next = { ...prev };
        delete next[stream.id];
        return next;
      });
      setNotice(t("streamCredential.revoked"));
    });
  }

  async function handleTestCredential(stream: PublisherStream) {
    await runAction(stream.id, async () => {
      const result = await publisherStreamManagementService.testCredential(stream.id);
      if (!result.ok) throw new Error(result.error.message);
      setNotice(t("streamHealth.tested", { state: result.data.connectionState }));
    });
  }

  async function copySecret(value: string) {
    const result = await clipboardService.copyText(value);
    setNotice(result.ok ? t("streamCredential.copied") : result.reason);
  }

  if (!streamMgmtEnabled) {
    return (
      <section className="publisher-streams" aria-label={t("streams.aria")}>
        <div className="publisher-streams__gated publisher-card">
          <h2>{t("streams.gatedTitle")}</h2>
          <p>{t("streams.gatedBody")}</p>
        </div>
      </section>
    );
  }

  const visible = streams.filter((stream) => sectionFor(stream.status) === section);

  return (
    <section className="publisher-streams" aria-label={t("streams.aria")}>
      <header className="publisher-streams__header">
        <div>
          <h2>{t("streams.title")}</h2>
          <p>{t("streams.lede")}</p>
        </div>
        <button type="button" className="publisher-ghost" onClick={() => void refresh()}>
          {t("streams.refresh")}
        </button>
      </header>

      {error ? (
        <p className="publisher-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="publisher-streams__notice" role="status">
          {notice}
        </p>
      ) : null}

      <form className="publisher-card publisher-form publisher-streams__form" onSubmit={(event) => void handleCreateOrUpdate(event)}>
        <h3>{editingId ? t("streams.editTitle") : t("streams.createTitle")}</h3>
        <label>
          {t("streams.fieldTitle")}
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          {t("streams.fieldDescription")}
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            maxLength={2000}
            rows={3}
          />
        </label>
        <div className="publisher-streams__form-row">
          <label>
            {t("streams.fieldCategory")}
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              maxLength={64}
            />
          </label>
          <label>
            {t("streams.fieldVisibility")}
            <select
              value={form.visibility}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, visibility: event.target.value as PublisherStreamVisibility }))
              }
            >
              <option value="public">{t("streams.visibility.public")}</option>
              <option value="unlisted">{t("streams.visibility.unlisted")}</option>
              <option value="private">{t("streams.visibility.private")}</option>
            </select>
          </label>
          <label>
            {t("streams.fieldIngest")}
            <select
              value={form.ingestMode}
              disabled={Boolean(editingId)}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ingestMode: event.target.value as PublisherStreamIngestMode }))
              }
            >
              <option value="PICOM_NATIVE">{t("streams.ingest.native")}</option>
              <option value="OBS_EXTERNAL" disabled={!externalIngestEnabled}>
                {t("streams.ingest.obs")}
              </option>
            </select>
          </label>
          <label>
            {t("streams.fieldScheduledAt")}
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
            />
          </label>
        </div>
        <div className="publisher-streams__form-actions">
          <button type="submit" className="publisher-primary" disabled={busyId === "form"}>
            {editingId ? t("streams.save") : t("streams.create")}
          </button>
          {editingId ? (
            <button
              type="button"
              className="publisher-ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              {t("streams.cancelEdit")}
            </button>
          ) : null}
        </div>
      </form>

      <nav className="publisher-tabs publisher-streams__tabs" aria-label={t("streams.sectionsAria")}>
        {(["upcoming", "drafts", "live", "past"] as const).map((key) => (
          <button key={key} type="button" className={section === key ? "is-active" : ""} onClick={() => setSection(key)}>
            {t(`streams.section.${key}` as PublisherProgramI18nKey)}
          </button>
        ))}
      </nav>

      <ul className="publisher-list publisher-streams__list">
        {visible.map((stream) => {
          const busy = busyId === stream.id;
          const showObs =
            stream.ingestMode === "OBS_EXTERNAL" && externalIngestEnabled;
          const editable = stream.status === "draft" || stream.status === "scheduled" || stream.status === "ready";
          return (
            <li key={stream.id} className="publisher-streams__item">
              <div className="publisher-streams__item-main">
                <strong>{stream.title}</strong>
                <span>
                  {statusLabel(stream.status)} · {stream.ingestMode === "OBS_EXTERNAL" ? t("streams.ingest.obs") : t("streams.ingest.native")}
                  {stream.scheduledAt ? ` · ${new Date(stream.scheduledAt).toLocaleString()}` : ""}
                </span>
                <span className="publisher-streams__meta">
                  {t("streamHealth.label")}: {t(`streamHealth.${stream.healthStatus}` as PublisherProgramI18nKey)} ·{" "}
                  {t("controlRoom.connection")}: {t(`controlRoom.state.${stream.connectionState}` as PublisherProgramI18nKey)}
                </span>
              </div>
              <div className="publisher-streams__actions">
                {editable ? (
                  <button type="button" className="publisher-ghost" disabled={busy} onClick={() => beginEdit(stream)}>
                    {t("streams.action.edit")}
                  </button>
                ) : null}
                {stream.status === "draft" || stream.status === "ready" ? (
                  <button
                    type="button"
                    className="publisher-ghost"
                    disabled={busy}
                    onClick={() => {
                      setSchedulePromptId(stream.id);
                      setScheduleAt(stream.scheduledAt ? stream.scheduledAt.slice(0, 16) : "");
                    }}
                  >
                    {t("streams.action.schedule")}
                  </button>
                ) : null}
                {stream.status === "draft" || stream.status === "scheduled" || stream.status === "ready" ? (
                  <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleCancel(stream)}>
                    {t("streams.action.delete")}
                  </button>
                ) : null}
                {stream.status === "draft" || stream.status === "scheduled" ? (
                  <button type="button" className="publisher-primary" disabled={busy} onClick={() => void handlePrepare(stream)}>
                    {t("streams.action.prepare")}
                  </button>
                ) : null}
                {(stream.status === "ready" || stream.status === "draft" || stream.status === "scheduled") &&
                stream.ingestMode === "PICOM_NATIVE" ? (
                  <button type="button" className="publisher-primary" disabled={busy} onClick={() => void handleNativeStart(stream)}>
                    {t("streams.action.start")}
                  </button>
                ) : null}
                {LIVE_STATUSES.includes(stream.status) ? (
                  <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleEnd(stream)}>
                    {t("streams.action.end")}
                  </button>
                ) : null}
                {liveChatEnabled && liveModerationEnabled && LIVE_STATUSES.includes(stream.status) ? (
                  <button
                    type="button"
                    className="publisher-ghost"
                    disabled={busy}
                    onClick={() => setChatConsoleStreamId(stream.id === chatConsoleStreamId ? null : stream.id)}
                  >
                    {translateLiveChat("controlRoom.moderation", localizationService.getLanguage())}
                  </button>
                ) : null}
                {showObs ? (
                  <button
                    type="button"
                    className="publisher-ghost"
                    disabled={busy}
                    onClick={() => setObsPanelStreamId(stream.id === obsPanelStreamId ? null : stream.id)}
                  >
                    {t("streams.action.connection")}
                  </button>
                ) : null}
                {showObs ? (
                  <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleTestCredential(stream)}>
                    {t("streams.action.test")}
                  </button>
                ) : null}
              </div>
              {schedulePromptId === stream.id ? (
                <div className="publisher-streams__schedule-prompt">
                  <label>
                    {t("streams.fieldScheduledAt")}
                    <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} required />
                  </label>
                  <button type="button" className="publisher-primary" disabled={busy} onClick={() => void handleScheduleSubmit(stream.id)}>
                    {t("streams.action.schedule")}
                  </button>
                  <button type="button" className="publisher-ghost" onClick={() => setSchedulePromptId(null)}>
                    {t("streams.cancelEdit")}
                  </button>
                </div>
              ) : null}
              {liveChatEnabled && liveModerationEnabled && chatConsoleStreamId === stream.id ? (
                <LiveChatModeratorConsole
                  streamId={stream.id}
                  onNotice={(message, kind) => {
                    if (kind === "error") setError(message);
                    else setNotice(message);
                  }}
                />
              ) : null}
              {showObs && obsPanelStreamId === stream.id ? (
                <div className="publisher-streams__obs" aria-label={t("obs.panelAria")}>
                  <h4>{t("obs.panelTitle")}</h4>
                  <p>{t("obs.panelBody")}</p>
                  <label>
                    {t("obs.ingestUrl")}
                    <code className="publisher-streams__code">{ingestByStream[stream.id] || t("obs.ingestUrlPending")}</code>
                  </label>
                  <div className="publisher-streams__actions">
                    <button type="button" className="publisher-primary" disabled={busy} onClick={() => void handleCreateCredential(stream)}>
                      {t("obs.createKey")}
                    </button>
                    <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleRotateCredential(stream)}>
                      {t("obs.rotate")}
                    </button>
                    <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleRevokeCredential(stream)}>
                      {t("obs.revoke")}
                    </button>
                    <button type="button" className="publisher-ghost" disabled={busy} onClick={() => void handleTestCredential(stream)}>
                      {t("obs.test")}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {visible.length === 0 ? <li>{t("streams.empty")}</li> : null}
      </ul>

      {secretReveal ? (
        <div
          className="publisher-streams__secret-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="publisher-stream-secret-title"
          aria-describedby="publisher-stream-secret-warning"
        >
          <div className="publisher-streams__secret-card">
            <h3 id="publisher-stream-secret-title">{t("streamCredential.revealTitle")}</h3>
            <p id="publisher-stream-secret-warning" className="publisher-streams__secret-warning" role="status">
              {t("streamCredential.revealWarning")}
            </p>
            <label>
              {t("obs.ingestUrl")}
              <code className="publisher-streams__code">{secretReveal.ingestUrl}</code>
            </label>
            <label>
              {t("streamCredential.streamKey")}
              <code className="publisher-streams__code publisher-streams__code--secret">{secretReveal.plaintextSecret}</code>
            </label>
            <div className="publisher-streams__actions">
              <button type="button" className="publisher-primary" onClick={() => void copySecret(secretReveal.plaintextSecret)}>
                {t("streamCredential.copyKey")}
              </button>
              <button type="button" className="publisher-ghost" onClick={() => void copySecret(secretReveal.ingestUrl)}>
                {t("obs.copyIngestUrl")}
              </button>
              <button type="button" className="publisher-ghost" onClick={closeSecretModal}>
                {t("streamCredential.dismiss")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
