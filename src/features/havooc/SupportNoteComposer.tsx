import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "../../i18n";
import {
  SUPPORT_NOTE_MAX_CHARS,
  SUPPORT_NOTE_MAX_WORDS,
} from "./havoocConfig";
import { supportNoteDraftMetrics, validateSupportNoteBody } from "./havoocSupportNoteText";

type ToastTone = "info" | "success" | "error";

type SupportNoteComposerProps = Readonly<{
  mode: "create" | "edit";
  initialBody?: string;
  authenticated: boolean;
  busy?: boolean;
  onRequestAuth: () => void;
  onSubmit: (body: string) => Promise<boolean>;
  onCancelEdit?: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
}>;

export function SupportNoteComposer({
  mode,
  initialBody = "",
  authenticated,
  busy = false,
  onRequestAuth,
  onSubmit,
  onCancelEdit,
  pushToast,
}: SupportNoteComposerProps) {
  const { t } = useTranslation("havooc");
  const fieldId = useId();
  const statusId = useId();
  const [draft, setDraft] = useState(initialBody);
  const metrics = supportNoteDraftMetrics(draft);
  const overWords = metrics.wordCount > SUPPORT_NOTE_MAX_WORDS;
  const overChars = metrics.charCount > SUPPORT_NOTE_MAX_CHARS;
  const overLimit = overWords || overChars;

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!authenticated) {
      onRequestAuth();
      return;
    }
    const validation = validateSupportNoteBody(draft);
    if (!validation.ok) {
      pushToast(t(`supportNotes.error.${validation.code}`), "error");
      return;
    }
    const ok = await onSubmit(validation.body);
    if (ok && mode === "create") setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <form className="support-notes__composer" onSubmit={(event) => void handleSubmit(event)}>
      <label className="support-notes__composer-label" htmlFor={fieldId}>
        {mode === "edit" ? t("supportNotes.composer.editLabel") : t("supportNotes.composer.label")}
      </label>
      <textarea
        id={fieldId}
        name="supportNote"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("supportNotes.composer.placeholder")}
        maxLength={SUPPORT_NOTE_MAX_CHARS + 40}
        aria-describedby={statusId}
        aria-invalid={overLimit || undefined}
        disabled={busy}
      />
      <div className="support-notes__composer-footer">
        <div className="support-notes__counters" data-over={overLimit ? "true" : "false"} id={statusId} aria-live="polite">
          <span>
            {t("supportNotes.composer.wordCount", {
              current: metrics.wordCount,
              max: SUPPORT_NOTE_MAX_WORDS,
            })}
          </span>
          {(overChars || metrics.charCount >= 120) && (
            <span>
              {t("supportNotes.composer.charCount", {
                current: metrics.charCount,
                max: SUPPORT_NOTE_MAX_CHARS,
              })}
            </span>
          )}
        </div>
        <div className="support-notes__actions">
          {mode === "edit" && onCancelEdit ? (
            <button type="button" className="support-notes__btn support-notes__btn--ghost" onClick={onCancelEdit} disabled={busy}>
              {t("supportNotes.actions.cancel")}
            </button>
          ) : null}
          <button
            type="submit"
            className="support-notes__btn support-notes__btn--primary"
            disabled={busy || overLimit || !draft.trim()}
          >
            {mode === "edit" ? t("supportNotes.actions.save") : t("supportNotes.actions.sign")}
          </button>
        </div>
      </div>
    </form>
  );
}
