import type { ReactNode } from "react";
import { AppIcon, type IconName } from "../AppIcon";

export type LiveDiscoverySectionProps = Readonly<{
  id: string;
  title: string;
  icon?: IconName;
  showAllLabel?: string;
  onShowAll?: () => void;
  children: ReactNode;
  empty?: ReactNode;
  error?: string | null;
  onRetry?: () => void;
  hiddenWhenEmpty?: boolean;
  variant?: "default" | "rising" | "fresh";
}>;

export function LiveDiscoverySection({
  id,
  title,
  icon = "live",
  showAllLabel = "Show all",
  onShowAll,
  children,
  empty,
  error,
  onRetry,
  hiddenWhenEmpty = false,
  variant = "default",
}: LiveDiscoverySectionProps) {
  const headingId = `section-heading-${id}`;
  const hasChildren = Boolean(children);
  if (hiddenWhenEmpty && !hasChildren && !error && !empty) return null;

  return (
    <section className={`live-section live-section--${variant}`} aria-labelledby={headingId}>
      <header className="live-section__header">
        <h2 id={headingId} className="live-section__title">
          <AppIcon name={icon} size="sm" aria-hidden="true" />
          <span>{title}</span>
        </h2>
        {onShowAll ? (
          <button type="button" className="live-section__show-all" onClick={onShowAll}>
            {showAllLabel}
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="live-section__error" role="alert">
          <strong>Couldn&apos;t load {title}</strong>
          <span>{error}</span>
          {onRetry ? (
            <button type="button" className="live-section__retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : hasChildren ? (
        <div className="live-section__row">{children}</div>
      ) : (
        empty
      )}
    </section>
  );
}
