import { useEffect, useId, useMemo, useRef, useState } from "react";
import { UserAvatar } from "../UserAvatar";
import { ProfileDisplayName, useProfileUsername } from "../ProfileDisplayName";
import { featureFlagService } from "../../services/featureFlagService";
import { localizationService } from "../../services/localizationService";
import { dateTimeService } from "../../services/dateTimeService";
import { profileMediaPreloadService } from "../../services/profileMedia/profileMediaPreloadService";
import { translateHavoocSupport } from "../../services/localization/havoocSupportCatalog";
import {
  projectSupportNotesService,
  type ProjectSupportNote,
  type SupportNoteSort,
} from "../../services/havooc/projectSupportNotesService";
import { countSupportNoteWords, normalizeSupportNoteBody, validateSupportNoteBody } from "../../services/havooc/supportNoteText";
import {
  HAVOOC_DEVELOPMENT_GOAL_EUR,
  HAVOOC_LINKS,
  HAVOOC_PROJECT_ID,
  SUPPORT_NOTE_MAX_CHARS,
  SUPPORT_NOTE_MAX_WORDS,
  getHavoocOwnerUserId,
} from "../../config/havoocLinks";
import "./HavoocSupportHub.css";

type Props = Readonly<{
  currentUserId: string | null;
  onClose: () => void;
  onNotice: (message: string, kind?: "success" | "error" | "info") => void;
  onRequireSignIn?: () => void;
  onOpenProfile?: (userId: string) => void;
}>;

function t(key: string, params?: Record<string, string | number>): string {
  return translateHavoocSupport(key, localizationService.getLanguage(), params);
}

function NoteAuthorName({ userId }: Readonly<{ userId: string }>) {
  const username = useProfileUsername(userId, "");
  return (
    <span className="havooc-note-card__identity">
      <ProfileDisplayName userId={userId} fallback={username || "Player"} />
      {username ? <span className="havooc-note-card__badge">@{username}</span> : null}
    </span>
  );
}

export function HavoocSupportHubWorkspace({
  currentUserId,
  onClose,
  onNotice,
  onRequireSignIn,
  onOpenProfile,
}: Props) {
  const enabled = featureFlagService.isEnabled("enableHavoocSupportHub");
  const ownerId = getHavoocOwnerUserId();
  const [sort, setSort] = useState<SupportNoteSort>("newest");
  const [notes, setNotes] = useState<ProjectSupportNote[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [myNote, setMyNote] = useState<ProjectSupportNote | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportNote, setReportNote] = useState<ProjectSupportNote | null>(null);
  const [reportCategory, setReportCategory] = useState<"spam" | "harassment" | "hate" | "scam" | "other">("spam");
  const [reportDescription, setReportDescription] = useState("");
  const composerLabelId = useId();
  const validationLiveId = useId();
  const deleteTitleId = useId();
  const reportTitleId = useId();
  const reloadToken = useRef(0);

  const normalizedDraft = useMemo(() => normalizeSupportNoteBody(draft), [draft]);
  const words = countSupportNoteWords(normalizedDraft);
  const chars = normalizedDraft.length;
  const clientValidation = validateSupportNoteBody(draft);
  const invalid = draft.length > 0 && !clientValidation.ok;

  const goalLabel = t("hub.goal", {
    amount: HAVOOC_DEVELOPMENT_GOAL_EUR.toLocaleString(localizationService.getLanguage()),
  });

  async function loadInitial() {
    if (!enabled) return;
    const token = ++reloadToken.current;
    const page = await projectSupportNotesService.listNotes({ sort });
    if (token !== reloadToken.current) return;
    if (!page.ok) {
      onNotice(t(`errors.${page.code}`), "error");
      return;
    }
    setNotes(page.data.notes);
    setHasMore(page.data.hasMore);
    setCursorCreatedAt(page.data.nextCursorCreatedAt);
    setCursorId(page.data.nextCursorId);
    void profileMediaPreloadService.preload(page.data.notes.map((n) => n.userId));

    if (currentUserId) {
      const mine = await projectSupportNotesService.getMyNote();
      if (token !== reloadToken.current) return;
      if (mine.ok) {
        setMyNote(mine.data);
        if (mine.data && editing) setDraft(mine.data.body);
      }
    } else {
      setMyNote(null);
    }
  }

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on sort/auth/flag
  }, [sort, currentUserId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return projectSupportNotesService.subscribeNotes(HAVOOC_PROJECT_ID, () => {
      void loadInitial();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  async function loadMore() {
    if (!hasMore || busy) return;
    setBusy(true);
    const page = await projectSupportNotesService.listNotes({
      sort,
      cursorCreatedAt,
      cursorId,
    });
    setBusy(false);
    if (!page.ok) {
      onNotice(t(`errors.${page.code}`), "error");
      return;
    }
    setNotes((prev) => {
      const seen = new Set(prev.map((n) => n.id));
      const merged = [...prev];
      for (const note of page.data.notes) {
        if (!seen.has(note.id)) merged.push(note);
      }
      return merged;
    });
    setHasMore(page.data.hasMore);
    setCursorCreatedAt(page.data.nextCursorCreatedAt);
    setCursorId(page.data.nextCursorId);
    void profileMediaPreloadService.preload(page.data.notes.map((n) => n.userId));
  }

  async function handleSubmit() {
    if (!currentUserId) {
      onNotice(t("notes.signInRequired"), "info");
      onRequireSignIn?.();
      return;
    }
    if (!clientValidation.ok) {
      onNotice(t(`errors.${clientValidation.code}`), "error");
      return;
    }
    setBusy(true);
    const wasEdit = Boolean(myNote);
    const result = await projectSupportNotesService.upsertNote(draft);
    setBusy(false);
    if (!result.ok) {
      onNotice(t(`errors.${result.code}`), "error");
      return;
    }
    setMyNote(result.data);
    setEditing(false);
    setDraft(result.data.body);
    onNotice(wasEdit ? t("notes.updated") : t("notes.added"), "success");
    void loadInitial();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await projectSupportNotesService.deleteNote();
    setBusy(false);
    setDeleteOpen(false);
    if (!result.ok) {
      onNotice(t(`errors.${result.code}`), "error");
      return;
    }
    setMyNote(null);
    setDraft("");
    setEditing(false);
    onNotice(t("notes.removed"), "success");
    void loadInitial();
  }

  async function handleReport() {
    if (!reportNote) return;
    if (!currentUserId) {
      onRequireSignIn?.();
      return;
    }
    setBusy(true);
    const result = await projectSupportNotesService.reportNote({
      noteId: reportNote.id,
      category: reportCategory,
      description: reportDescription,
    });
    setBusy(false);
    if (!result.ok) {
      onNotice(t(`errors.${result.code}`), "error");
      return;
    }
    setReportNote(null);
    setReportDescription("");
    onNotice(t("notes.reported"), "success");
  }

  if (!enabled) {
    return (
      <div className="havooc-hub">
        <div className="havooc-hub__inner">
          <div className="havooc-hub__topbar">
            <h1 className="havooc-hub__title">{t("hub.title")}</h1>
            <button type="button" className="havooc-hub__close" onClick={onClose}>
              {t("hub.close")}
            </button>
          </div>
          <p>{t("notes.disabled")}</p>
        </div>
      </div>
    );
  }

  const composerMode = myNote && !editing;

  return (
    <div className="havooc-hub">
      <div className="havooc-hub__inner">
        <div className="havooc-hub__topbar">
          <header className="havooc-hub__hero">
            <div className="havooc-hub__kicker">HAVOOC</div>
            <h1 className="havooc-hub__title">{t("hub.title")}</h1>
            <p className="havooc-hub__subtitle">{t("hub.subtitle")}</p>
          </header>
          <button type="button" className="havooc-hub__close" onClick={onClose}>
            {t("hub.close")}
          </button>
        </div>

        <section className="havooc-hub__section" aria-labelledby="havooc-roadmap">
          <h2 id="havooc-roadmap">{t("hub.roadmap")}</h2>
          <p>{t("hub.roadmap.body")}</p>
        </section>

        <section className="havooc-hub__section" aria-labelledby="havooc-media">
          <h2 id="havooc-media">{t("hub.media")}</h2>
          <p>{t("hub.media.body")}</p>
          <div className="havooc-hub__media-placeholder">{t("hub.media.empty")}</div>
        </section>

        <section className="havooc-notes" aria-labelledby="havooc-notes-title">
          <div className="havooc-notes__header">
            <div>
              <h2 id="havooc-notes-title">{t("notes.title")}</h2>
              <p>{t("notes.subtitle")}</p>
            </div>
            <div className="havooc-notes__sort" role="group" aria-label="Sort">
              <button type="button" aria-pressed={sort === "newest"} onClick={() => setSort("newest")}>
                {t("notes.sortNewest")}
              </button>
              <button type="button" aria-pressed={sort === "oldest"} onClick={() => setSort("oldest")}>
                {t("notes.sortOldest")}
              </button>
            </div>
          </div>

          <div className="havooc-notes__composer">
            <label id={composerLabelId} htmlFor="havooc-support-note-input">
              {t("notes.composerLabel")}
            </label>
            {composerMode ? (
              <p className="havooc-note-card__body">{myNote.body}</p>
            ) : (
              <textarea
                id="havooc-support-note-input"
                aria-labelledby={composerLabelId}
                aria-describedby={validationLiveId}
                aria-invalid={invalid}
                placeholder={t("notes.placeholder")}
                value={draft}
                maxLength={SUPPORT_NOTE_MAX_CHARS + 40}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
            )}
            <div className="havooc-notes__composer-actions">
              <div className="havooc-notes__counters" data-invalid={invalid} id={validationLiveId} aria-live="polite">
                <span>
                  {t("notes.wordCounter", { words, max: SUPPORT_NOTE_MAX_WORDS })}
                </span>
                <span>
                  {t("notes.charCounter", { chars, max: SUPPORT_NOTE_MAX_CHARS })}
                </span>
              </div>
              {composerMode ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setDraft(myNote.body);
                    }}
                  >
                    {t("notes.edit")}
                  </button>
                  <button type="button" onClick={() => setDeleteOpen(true)}>
                    {t("notes.delete")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || !clientValidation.ok}
                  onClick={() => void handleSubmit()}
                >
                  {localizationService.getLanguage() === "tr" ? t("notes.leaveNote") : t("notes.sign")}
                </button>
              )}
            </div>
          </div>

          {notes.length === 0 ? <p>{t("notes.empty")}</p> : null}

          <div className="havooc-notes__wall">
            {notes.map((note) => {
              const isOwnerNote = Boolean(ownerId && note.userId === ownerId);
              const isMine = currentUserId === note.userId;
              return (
                <article key={note.id} className="havooc-note-card">
                  <div className="havooc-note-card__top">
                    <button
                      type="button"
                      className="havooc-note-card__name"
                      onClick={() => onOpenProfile?.(note.userId)}
                      aria-label="Open profile"
                    >
                      <UserAvatar userId={note.userId} displayName="Player" size={32} />
                    </button>
                    <button type="button" className="havooc-note-card__name" onClick={() => onOpenProfile?.(note.userId)}>
                      <NoteAuthorName userId={note.userId} />
                    </button>
                    {isOwnerNote ? <span className="havooc-note-card__badge">{t("notes.ownerBadge")}</span> : null}
                    <div className="havooc-note-card__menu">
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={menuNoteId === note.id}
                        aria-label={t("notes.menu")}
                        onClick={() => setMenuNoteId((id) => (id === note.id ? null : note.id))}
                      >
                        …
                      </button>
                      {menuNoteId === note.id ? (
                        <div className="havooc-note-card__menu-panel" role="menu">
                          {isMine ? (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuNoteId(null);
                                  setEditing(true);
                                  setDraft(note.body);
                                }}
                              >
                                {t("notes.edit")}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuNoteId(null);
                                  setDeleteOpen(true);
                                }}
                              >
                                {t("notes.delete")}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuNoteId(null);
                                if (!currentUserId) {
                                  onRequireSignIn?.();
                                  return;
                                }
                                setReportNote(note);
                              }}
                            >
                              {t("notes.report")}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="havooc-note-card__body">{note.body}</p>
                  <div className="havooc-note-card__meta">
                    <time dateTime={note.createdAt}>{dateTimeService.formatRelativeTime(note.createdAt)}</time>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore ? (
            <button type="button" className="havooc-notes__load-more" disabled={busy} onClick={() => void loadMore()}>
              {t("notes.loadMore")}
            </button>
          ) : null}

          <div className="havooc-notes__cta">
            <strong>{t("notes.ctaHelp")}</strong>
            <span>{goalLabel}</span>
            <div className="havooc-notes__cta-actions">
              <a className="primary" href={HAVOOC_LINKS.donate} target="_blank" rel="noopener noreferrer">
                {t("notes.donate")}
              </a>
              <a href={HAVOOC_LINKS.support} target="_blank" rel="noopener noreferrer">
                {t("notes.support")}
              </a>
            </div>
          </div>
        </section>

        <section className="havooc-hub__section" aria-labelledby="havooc-community">
          <h2 id="havooc-community">{t("hub.community")}</h2>
          <div className="havooc-hub__links">
            <a href={HAVOOC_LINKS.picomCommunity} target="_blank" rel="noopener noreferrer">
              {t("link.picom")}
            </a>
            <a href={HAVOOC_LINKS.reddit} target="_blank" rel="noopener noreferrer">
              {t("link.reddit")}
            </a>
            <a href={HAVOOC_LINKS.instagram} target="_blank" rel="noopener noreferrer">
              {t("link.instagram")}
            </a>
          </div>
        </section>

        <section className="havooc-hub__section" aria-labelledby="havooc-kickstarter">
          <h2 id="havooc-kickstarter">{t("hub.kickstarter")}</h2>
          <p>{t("hub.kickstarter.body")}</p>
          <div className="havooc-hub__links">
            <a href={HAVOOC_LINKS.kickstarter} target="_blank" rel="noopener noreferrer">
              {t("link.kickstarter")}
            </a>
          </div>
        </section>

        <section className="havooc-hub__section" aria-labelledby="havooc-patience">
          <h2 id="havooc-patience">{t("hub.patience")}</h2>
          <p>{t("hub.patience.body")}</p>
        </section>

        <section className="havooc-hub__section" aria-labelledby="havooc-final-cta">
          <h2 id="havooc-final-cta">{t("hub.finalCta")}</h2>
          <p>{goalLabel}</p>
          <div className="havooc-hub__links">
            <a href={HAVOOC_LINKS.donate} target="_blank" rel="noopener noreferrer">
              {t("notes.donate")}
            </a>
            <a href={HAVOOC_LINKS.support} target="_blank" rel="noopener noreferrer">
              {t("notes.support")}
            </a>
          </div>
        </section>
      </div>

      {deleteOpen ? (
        <div className="havooc-dialog-backdrop" role="presentation">
          <div className="havooc-dialog" role="alertdialog" aria-modal="true" aria-labelledby={deleteTitleId}>
            <h3 id={deleteTitleId}>{t("notes.deleteConfirmTitle")}</h3>
            <p>{t("notes.deleteConfirmBody")}</p>
            <div className="havooc-dialog__actions">
              <button type="button" onClick={() => setDeleteOpen(false)}>
                {t("notes.cancel")}
              </button>
              <button type="button" className="primary" disabled={busy} onClick={() => void handleDelete()}>
                {t("notes.deleteConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportNote ? (
        <div className="havooc-dialog-backdrop" role="presentation">
          <div className="havooc-dialog" role="dialog" aria-modal="true" aria-labelledby={reportTitleId}>
            <h3 id={reportTitleId}>{t("report.title")}</h3>
            <label>
              {t("report.category")}
              <select
                value={reportCategory}
                onChange={(event) =>
                  setReportCategory(event.target.value as "spam" | "harassment" | "hate" | "scam" | "other")
                }
              >
                <option value="spam">{t("report.spam")}</option>
                <option value="harassment">{t("report.harassment")}</option>
                <option value="hate">{t("report.hate")}</option>
                <option value="scam">{t("report.scam")}</option>
                <option value="other">{t("report.other")}</option>
              </select>
            </label>
            <label>
              {t("report.description")}
              <textarea
                value={reportDescription}
                maxLength={500}
                onChange={(event) => setReportDescription(event.target.value)}
              />
            </label>
            <div className="havooc-dialog__actions">
              <button type="button" onClick={() => setReportNote(null)}>
                {t("notes.cancel")}
              </button>
              <button type="button" className="primary" disabled={busy} onClick={() => void handleReport()}>
                {t("report.submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
