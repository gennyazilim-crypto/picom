import { AppIcon } from "../AppIcon";
import { UserAvatar } from "../UserAvatar";
import type { LiveScreenShareSummary } from "../../types/liveScreenShare";
import { broadcasterLabel } from "./LiveShareCard";
import { useTranslation } from "../../i18n";

export type LiveWatchEndedStateProps = Readonly<{
  session: LiveScreenShareSummary | null;
  onBackToLiveNow: () => void;
  onOpenCommunity?: () => void;
}>;

export function LiveWatchEndedState({ session, onBackToLiveNow, onOpenCommunity }: LiveWatchEndedStateProps) {
  const { t } = useTranslation("live");
  const name = session ? broadcasterLabel(session) : t("ended.broadcasterFallback");
  const sessionTitle = session?.title.trim();
  return (
    <div className="live-watch-ended" role="status" aria-live="polite">
      <div className="live-watch-ended__card">
        {session ? <UserAvatar userId={session.broadcasterUserId} displayName={name} size={56} /> : <AppIcon name="live" size="xl" />}
        <strong>{t("ended.title")}</strong>
        <p>{sessionTitle ? t("ended.bodyWithTitle", { title: sessionTitle }) : t("ended.body")}</p>
        <div className="live-watch-ended__actions">
          <button type="button" className="live-watch-btn live-watch-btn--primary" onClick={onBackToLiveNow}>
            {t("ended.backToLiveNow")}
          </button>
          {onOpenCommunity && session ? (
            <button type="button" className="live-watch-btn" onClick={onOpenCommunity}>
              {t("ended.openCommunity")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LiveWatchConnectionState({
  label,
}: Readonly<{
  label: string;
}>) {
  return (
    <div className="live-watch-connection" role="status" aria-live="polite">
      <span className="live-watch-player__spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function LiveWatchHeader({
  title,
  onBack,
}: Readonly<{
  title: string;
  onBack: () => void;
}>) {
  const { t } = useTranslation("live");
  return (
    <header className="live-watch-header">
      <button type="button" className="live-watch-btn" onClick={onBack} aria-label={t("header.back")}>
        <AppIcon name="chevronRight" size="sm" />
        <span>{t("header.liveNow")}</span>
      </button>
      <h1 className="live-watch-header__title">{title}</h1>
    </header>
  );
}

export function LiveWatchReportMenu({
  open,
  reasons,
  busy,
  onClose,
  onSelect,
}: Readonly<{
  open: boolean;
  reasons: readonly { id: string; label: string }[];
  busy: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}>) {
  const { t } = useTranslation("live");
  if (!open) return null;
  return (
    <div className="live-watch-report" role="dialog" aria-modal="true" aria-label={t("report.dialogAria")}>
      <div className="live-watch-report__panel">
        <div className="live-watch-report__head">
          <strong>{t("report.title")}</strong>
          <button type="button" className="live-watch-controls__btn" aria-label={t("report.close")} onClick={onClose}>
            <AppIcon name="close" size="sm" />
          </button>
        </div>
        <ul>
          {reasons.map((reason) => (
            <li key={reason.id}>
              <button type="button" disabled={busy} onClick={() => onSelect(reason.id)}>
                {reason.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
