import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import {
  HAVOOC_PROJECT_KEY,
  SUPPORT_NOTES_PAGE_SIZE,
} from "./havoocConfig";
import { SupportNoteCard } from "./SupportNoteCard";
import { SupportNoteComposer } from "./SupportNoteComposer";
import {
  havoocSupportNotesService,
  type SupportNote,
  type SupportNoteSort,
} from "./havoocSupportNotesService";

type ToastTone = "info" | "success" | "error";

type SupportNotesSectionProps = Readonly<{
  authenticated: boolean;
  canModerate?: boolean;
  onRequestAuth: () => void;
  onOpenProfile?: (username: string, userId: string) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
}>;

export function SupportNotesSection({
  authenticated,
  canModerate = false,
  onRequestAuth,
  onOpenProfile,
  pushToast,
}: SupportNotesSectionProps) {
  const { t } = useTranslation("havooc");
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [sort, setSort] = useState<SupportNoteSort>("newest");
  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingNote, setEditingNote] = useState<SupportNote | null>(null);
  const [ownNoteId, setOwnNoteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportNote | null>(null);

  const loadPage = useCallback(
    async (
      mode: "replace" | "append",
      pageCursor: { createdAt: string; id: string } | null = null,
    ) => {
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);

      const result = await havoocSupportNotesService.listNotes({
        projectKey: HAVOOC_PROJECT_KEY,
        limit: SUPPORT_NOTES_PAGE_SIZE,
        cursor: mode === "append" ? pageCursor : null,
        sort,
      });

      if (!result.ok) {
        pushToast(result.message, "error");
        if (mode === "replace") setNotes([]);
      } else {
        setNotes((previous) => {
          if (mode === "replace") return result.data.notes;
          const seen = new Set(previous.map((note) => note.id));
          const merged = [...previous];
          for (const note of result.data.notes) {
            if (!seen.has(note.id)) merged.push(note);
          }
          return merged;
        });
        setCursor(result.data.nextCursor);
        setHasMore(Boolean(result.data.nextCursor));
      }

      if (mode === "replace") setLoading(false);
      else setLoadingMore(false);
    },
    [pushToast, sort],
  );

  useEffect(() => {
    setCursor(null);
    void loadPage("replace");
  }, [loadPage, authenticated]);

  useEffect(() => {
    if (!authenticated) {
      setOwnNoteId(null);
      return;
    }
    void havoocSupportNotesService.getMyNote(HAVOOC_PROJECT_KEY).then((result) => {
      if (result.ok) setOwnNoteId(result.data?.id ?? null);
    });
  }, [authenticated, notes]);

  useEffect(() => {
    return havoocSupportNotesService.subscribeToProject(HAVOOC_PROJECT_KEY, () => {
      void loadPage("replace");
    });
  }, [loadPage]);

  async function handleCreate(body: string): Promise<boolean> {
    if (ownNoteId) {
      pushToast(t("supportNotes.error.already_exists"), "info");
      const existing = notes.find((note) => note.id === ownNoteId) ?? null;
      if (existing) setEditingNote(existing);
      return false;
    }
    setBusy(true);
    const result = await havoocSupportNotesService.createNote(body, HAVOOC_PROJECT_KEY);
    setBusy(false);
    if (!result.ok) {
      pushToast(t(`supportNotes.error.${result.code}`) !== `supportNotes.error.${result.code}`
        ? t(`supportNotes.error.${result.code}`)
        : result.message, "error");
      return false;
    }
    pushToast(t("supportNotes.toast.created"), "success");
    setOwnNoteId(result.data.id);
    await loadPage("replace");
    return true;
  }

  async function handleUpdate(body: string): Promise<boolean> {
    if (!editingNote) return false;
    setBusy(true);
    const result = await havoocSupportNotesService.updateNote(editingNote.id, body);
    setBusy(false);
    if (!result.ok) {
      pushToast(result.message, "error");
      return false;
    }
    pushToast(t("supportNotes.toast.updated"), "success");
    setEditingNote(null);
    await loadPage("replace");
    return true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await havoocSupportNotesService.deleteNote(deleteTarget.id);
    setBusy(false);
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }
    pushToast(t("supportNotes.toast.deleted"), "success");
    setDeleteTarget(null);
    setEditingNote(null);
    setOwnNoteId(null);
    await loadPage("replace");
  }

  async function handleReport(note: SupportNote) {
    if (!authenticated) {
      onRequestAuth();
      return;
    }
    const result = await havoocSupportNotesService.reportNote(note.id, "other");
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }
    pushToast(t("supportNotes.toast.reported"), "success");
  }

  const showCreateComposer = !editingNote && (!authenticated || !ownNoteId);

  return (
    <section className="profile-panel support-notes" aria-labelledby="havooc-support-notes-title">
      <header className="profile-panel-header">
        <div>
          <p className="eyebrow">{t("supportNotes.subtitle")}</p>
          <h2 id="havooc-support-notes-title">{t("supportNotes.title")}</h2>
        </div>
      </header>

      {editingNote ? (
        <SupportNoteComposer
          key={editingNote.id}
          mode="edit"
          initialBody={editingNote.body}
          authenticated={authenticated}
          busy={busy}
          onRequestAuth={onRequestAuth}
          onSubmit={handleUpdate}
          onCancelEdit={() => setEditingNote(null)}
          pushToast={pushToast}
        />
      ) : showCreateComposer ? (
        <SupportNoteComposer
          mode="create"
          authenticated={authenticated}
          busy={busy}
          onRequestAuth={onRequestAuth}
          onSubmit={handleCreate}
          pushToast={pushToast}
        />
      ) : null}

      <div className="support-notes__toolbar">
        <label className="support-notes__sr-only" htmlFor="support-notes-sort">
          {t("supportNotes.sort.label")}
        </label>
        <select
          id="support-notes-sort"
          className="support-notes__sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SupportNoteSort)}
        >
          <option value="newest">{t("supportNotes.sort.newest")}</option>
          <option value="oldest">{t("supportNotes.sort.oldest")}</option>
        </select>
      </div>

      {loading ? (
        <p className="support-notes__empty">{t("supportNotes.loading")}</p>
      ) : notes.length === 0 ? (
        <p className="support-notes__empty">{t("supportNotes.empty")}</p>
      ) : (
        <div className="support-notes__wall">
          {notes.map((note) => (
            <SupportNoteCard
              key={note.id}
              note={note}
              canModerate={canModerate}
              onEdit={setEditingNote}
              onDelete={setDeleteTarget}
              onReport={(target) => void handleReport(target)}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          className="support-notes__btn support-notes__btn--ghost support-notes__load-more"
          disabled={loadingMore}
          onClick={() => void loadPage("append", cursor)}
        >
          {loadingMore ? t("supportNotes.loading") : t("supportNotes.actions.loadMore")}
        </button>
      ) : null}

      {deleteTarget ? (
        <div className="support-notes__dialog-backdrop" role="presentation">
          <div
            className="support-notes__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="support-note-delete-title"
            aria-describedby="support-note-delete-desc"
          >
            <h3 id="support-note-delete-title">{t("supportNotes.deleteDialog.title")}</h3>
            <p id="support-note-delete-desc">{t("supportNotes.deleteDialog.body")}</p>
            <div className="support-notes__dialog-actions">
              <button
                type="button"
                className="support-notes__btn support-notes__btn--ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
              >
                {t("supportNotes.actions.cancel")}
              </button>
              <button
                type="button"
                className="support-notes__btn support-notes__btn--primary"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {t("supportNotes.actions.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
