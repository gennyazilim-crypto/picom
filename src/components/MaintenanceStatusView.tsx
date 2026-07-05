import type { MaintenanceStatusSnapshot } from "../services/maintenanceStatusService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";

type MaintenanceStatusViewProps = {
  status: MaintenanceStatusSnapshot;
  onRetry: () => void;
  onOpenStatusPage?: () => void;
};

export function MaintenanceStatusView({ status, onRetry, onOpenStatusPage }: MaintenanceStatusViewProps) {
  return (
    <main className="maintenance-screen" aria-live="polite">
      <section className="maintenance-card">
        <span className="maintenance-mark" aria-hidden="true">
          <AppIcon name="settings" size="xl" />
        </span>
        <p className="eyebrow">Scheduled maintenance</p>
        <h1>Picom is temporarily unavailable</h1>
        <p>{status.message || "We are performing scheduled service maintenance. Please retry in a moment."}</p>
        {status.estimatedEndAt ? <small>Estimated end: {dateTimeService.formatFullTimestamp(status.estimatedEndAt)}</small> : null}
        <div className="maintenance-actions">
          <button type="button" onClick={onRetry}>
            Retry status check
          </button>
          {onOpenStatusPage ? (
            <button type="button" onClick={onOpenStatusPage}>
              System status
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

type MaintenanceStatusBannerProps = {
  status: MaintenanceStatusSnapshot;
  onRetry: () => void;
};

export function MaintenanceStatusBanner({ status, onRetry }: MaintenanceStatusBannerProps) {
  if (status.status !== "degraded") {
    return null;
  }

  return (
    <div className="maintenance-banner" role="status" aria-live="polite">
      <AppIcon name="bell" size="sm" />
      <span>{status.message}</span>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
