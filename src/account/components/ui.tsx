import type { ReactNode } from "react";

export function AccountPageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="ac-page-header">
      {breadcrumb ? <div className="ac-page-header__crumb">{breadcrumb}</div> : null}
      <div className="ac-page-header__row">
        <div>
          <h1 className="ac-page-header__title">{title}</h1>
          {description ? <p className="ac-page-header__desc">{description}</p> : null}
        </div>
        {actions ? <div className="ac-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function AccountCard({
  children,
  className = "",
  title,
  icon,
  actions,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={`ac-surface-card${padded ? " ac-surface-card--padded" : ""} ${className}`.trim()}>
      {title || actions ? (
        <div className="ac-surface-card__head">
          <div className="ac-surface-card__title-wrap">
            {icon}
            {title ? <h2 className="ac-surface-card__title">{title}</h2> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  return <span className={`ac-status-badge ac-status-badge--${tone}`}>{children}</span>;
}

export function SettingsRow({
  title,
  description,
  control,
  icon,
}: {
  title: string;
  description?: string;
  control?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ac-settings-row">
      {icon ? <div className="ac-settings-row__icon">{icon}</div> : null}
      <div className="ac-settings-row__copy">
        <div className="ac-settings-row__title">{title}</div>
        {description ? <p className="ac-settings-row__desc">{description}</p> : null}
      </div>
      {control ? <div className="ac-settings-row__control">{control}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="ac-empty-state">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}
