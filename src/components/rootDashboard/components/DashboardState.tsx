import { AppIcon } from "../../AppIcon";

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

const copy: Record<DashboardStateVariant, { title: string; detail: string; icon: "search" | "inbox" | "close" | "lock" | "voice" }> = {
  loading: { title: "Loading", detail: "Resolving live dashboard data…", icon: "search" },
  empty: { title: "Nothing here yet", detail: "No rows match the current filters.", icon: "inbox" },
  error: { title: "Could not load", detail: "The data contract failed or timed out.", icon: "close" },
  noPermission: {
    title: "No Panel access",
    detail: "This root dashboard is limited to authorized app admins. Visibility alone is not security.",
    icon: "lock",
  },
  reconnect: {
    title: "Connection interrupted",
    detail: "Realtime or network status is degraded. Retry when connectivity returns.",
    icon: "voice",
  },
};

export type { DashboardStateVariant };

export function DashboardState({ variant, tone, title, detail, message, onRetry }: DashboardStateProps) {
  const resolved = variant ?? tone ?? "empty";
  const fallback = copy[resolved];
  return (
    <div className={`rd-state is-${resolved}`} role="status" aria-live="polite">
      <span className="rd-state__mark" aria-hidden="true">
        <AppIcon name={fallback.icon} size="md" />
      </span>
      <strong>{title ?? fallback.title}</strong>
      <p>{message ?? detail ?? fallback.detail}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
