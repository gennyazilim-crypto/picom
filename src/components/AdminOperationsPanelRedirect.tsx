import { AppIcon } from "./AppIcon";

type AdminOperationsPanelRedirectProps = Readonly<{
  onOpenPanel: () => void;
}>;

export function AdminOperationsPanelRedirect({ onOpenPanel }: AdminOperationsPanelRedirectProps) {
  return (
    <div className="admin-operations-settings-stack">
      <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label="Panel redirect">
        <span>Panel</span>
        <strong>Admin operations moved to Panel</strong>
        <small>
          Platform operations, trust &amp; safety, support, advertising, revenue, and audit tools now live in the full-screen root dashboard Panel.
          Settings keeps account and device preferences only.
        </small>
        <button type="button" className="settings-inline-action" onClick={onOpenPanel}>
          <AppIcon name="settings" size="sm" />
          Open Panel
        </button>
      </div>
    </div>
  );
}
