import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { dateTimeService } from "../../services/dateTimeService";
import type { SupportNote } from "./havoocSupportNotesService";

type SupportNoteCardProps = Readonly<{
  note: SupportNote;
  canModerate?: boolean;
  onEdit: (note: SupportNote) => void;
  onDelete: (note: SupportNote) => void;
  onReport: (note: SupportNote) => void;
  onOpenProfile?: (username: string, userId: string) => void;
}>;

export function SupportNoteCard({
  note,
  canModerate = false,
  onEdit,
  onDelete,
  onReport,
  onOpenProfile,
}: SupportNoteCardProps) {
  const { t } = useTranslation("havooc");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initial = (note.author.displayName.trim().charAt(0) || "?").toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const showOwnActions = note.isOwnNote;
  const showReport = !note.isOwnNote;
  const showMenu = showOwnActions || showReport || canModerate;

  return (
    <article className="support-note-card">
      <header className="support-note-card__header">
        {note.author.avatarUrl ? (
          <img className="support-note-card__avatar" src={note.author.avatarUrl} alt="" />
        ) : (
          <span className="support-note-card__avatar-fallback" aria-hidden="true">
            {initial}
          </span>
        )}
        <div className="support-note-card__identity">
          <div className="support-note-card__name-row">
            {onOpenProfile && note.author.username ? (
              <button
                type="button"
                className="support-note-card__name-button"
                onClick={() => onOpenProfile(note.author.username, note.author.userId)}
              >
                {note.author.displayName}
              </button>
            ) : (
              <span className="support-note-card__name">{note.author.displayName}</span>
            )}
            {note.author.isProjectOwner ? (
              <span className="support-note-card__owner-badge">{t("supportNotes.ownerBadge")}</span>
            ) : null}
          </div>
          {note.author.username ? (
            <span className="support-note-card__username">@{note.author.username}</span>
          ) : null}
        </div>
        {showMenu ? (
          <div className="support-note-card__menu" ref={menuRef}>
            <button
              type="button"
              className="support-note-card__menu-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={t("supportNotes.actions.more")}
              onClick={() => setMenuOpen((open) => !open)}
            >
              …
            </button>
            {menuOpen ? (
              <div className="support-note-card__menu-panel" role="menu" id={menuId}>
                {showOwnActions ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(note); }}>
                      {t("supportNotes.actions.edit")}
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(note); }}>
                      {t("supportNotes.actions.delete")}
                    </button>
                  </>
                ) : null}
                {showReport ? (
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReport(note); }}>
                    {t("supportNotes.actions.report")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <p className="support-note-card__body">{note.body}</p>
      <time className="support-note-card__meta" dateTime={note.createdAt}>
        {dateTimeService.formatRelativeTime(note.createdAt)}
      </time>
    </article>
  );
}
