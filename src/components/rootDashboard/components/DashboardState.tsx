import { AppIcon } from "../../AppIcon";
import { useTranslation } from "../../../i18n";

type DashboardStateVariant = "loading" | "empty" | "error" | "noPermission" | "reconnect";

export type DashboardStateProps = Readonly<{
  /** Preferred prop used by module pages */
  variant?: DashboardStateVariant;
  /** Alias used by early shell drafts */
  tone?: DashboardStateVariant;
  title?: string;
  detail?: string;
  message?: string;
  onRetry?: () => void;
}>;

const ICONS: Record<DashboardStateVariant, "search" | "inbox" | "close" | "lock" | "voice"> = {
  loading: "search",
  empty: "inbox",
  error: "close",
  noPermission: "lock",
  reconnect: "voice",
};

export type { DashboardStateVariant };

export function DashboardState({ variant, tone, title, detail, message, onRetry }: DashboardStateProps) {
  const { t } = useTranslation("admin");
  const resolved = variant ?? tone ?? "empty";
  return (
    <div className={`rd-state is-${resolved}`} role="status" aria-live="polite">
      <span className="rd-state__mark" aria-hidden="true">
        <AppIcon name={ICONS[resolved]} size="md" />
      </span>
      <strong>{title ?? t(`state.${resolved}.title`)}</strong>
      <p>{message ?? detail ?? t(`state.${resolved}.detail`)}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {t("action.retry")}
        </button>
      ) : null}
    </div>
  );
}
