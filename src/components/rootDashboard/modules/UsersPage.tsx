import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import {
  rootDashboardUserService,
  type RootUserRealtimeSubscription,
} from "../../../services/rootDashboard/rootDashboardUserService";
import type {
  RootUserAction,
  RootUserActionRequest,
  RootUserDetail,
  RootUserDetailTab,
  RootUserFilters,
  RootUserListItem,
  RootUserListResponse,
} from "../../../types/rootDashboardUsers";

type UsersPageProps = Readonly<{
  access: AdminOperationsAccess;
  isRootOwner?: boolean;
}>;

type ActionDialogState = {
  action: RootUserAction;
  targets: string[];
  label: string;
  dangerous: boolean;
} | null;

const DEFAULT_FILTERS: RootUserFilters = {
  search: "",
  status: "all",
  emailStatus: "all",
  role: "all",
  risk: "all",
  platform: "all",
  createdFrom: "",
  createdTo: "",
  lastSeen: "all",
  sort: "created_at",
  direction: "desc",
  page: 1,
  pageSize: 25,
  includeDeleted: false,
};

const DETAIL_TABS: Array<{ id: RootUserDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "sessions", label: "Sessions" },
  { id: "roles", label: "Roles" },
  { id: "content", label: "Content" },
  { id: "communities", label: "Communities" },
  { id: "dm-safety", label: "DM Safety" },
  { id: "moderation", label: "Moderation" },
  { id: "emails", label: "Emails" },
  { id: "notifications", label: "Notifications" },
  { id: "audit", label: "Audit History" },
];

const STATUS_OPTIONS = [
  "active",
  "limited",
  "under_review",
  "suspended",
  "temporarily_banned",
  "permanently_banned",
  "deletion_pending",
  "deleted",
] as const;

const formatDate = (value?: string | null): string => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const titleCase = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const isDangerousAction = (action: RootUserAction): boolean =>
  action === "suspend"
  || action === "temporary_ban"
  || action === "permanent_ban"
  || action === "start_deletion"
  || action === "permanent_delete"
  || action === "reset_mfa";

const actionLabel = (action: RootUserAction): string => {
  const labels: Record<RootUserAction, string> = {
    manual_verify_email: "Manually verify email",
    resend_verification: "Resend verification",
    send_password_reset: "Send password reset",
    revoke_sessions: "Revoke all sessions",
    reset_mfa: "Reset MFA",
    set_under_review: "Mark under review",
    limit_account: "Limit account",
    suspend: "Suspend account",
    temporary_ban: "Temporarily ban",
    permanent_ban: "Permanently ban",
    unban: "Remove ban",
    reactivate: "Reactivate account",
    add_restriction: "Add product restriction",
    remove_restriction: "Remove product restriction",
    assign_role: "Change platform role",
    add_tag: "Add internal tag",
    start_deletion: "Start deletion",
    permanent_delete: "Permanently delete",
    export_user: "Export user data",
    export_selection: "Export selected rows",
  };
  return labels[action];
};

function UserAvatar({ row, large = false }: { row: RootUserListItem; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = (row.displayName || row.username || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <span className={`rd-user-avatar${large ? " is-large" : ""}`} aria-hidden="true">
      {row.avatarUrl && !failed ? (
        <img src={row.avatarUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`rd-user-badge rd-user-badge--${value.replace(/_/g, "-")}`}>
      {titleCase(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  return (
    <article className={`rd-user-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function DetailValue({ label, value }: { label: string; value: unknown }) {
  const output =
    value === null || value === undefined || value === ""
      ? "Not available"
      : typeof value === "boolean"
        ? value ? "Yes" : "No"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return (
    <div className="rd-user-detail-value">
      <span>{label}</span>
      <strong>{output}</strong>
    </div>
  );
}

function DetailCollection({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <section className="rd-user-detail-section">
      <header>
        <h4>{title}</h4>
        <span>{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="rd-user-empty-copy">No records are available for this section.</p>
      ) : (
        <div className="rd-user-detail-records">
          {rows.map((row, index) => (
            <article key={`${title}-${index}`}>
              {Object.entries(row)
                .filter(([, value]) => value !== null && value !== undefined)
                .slice(0, 8)
                .map(([key, value]) => (
                  <DetailValue key={key} label={titleCase(key)} value={value} />
                ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UserDetailDrawer({
  detail,
  loading,
  tab,
  onTabChange,
  onClose,
  onAction,
}: {
  detail: RootUserDetail | null;
  loading: boolean;
  tab: RootUserDetailTab;
  onTabChange: (tab: RootUserDetailTab) => void;
  onClose: () => void;
  onAction: (action: RootUserAction, target: RootUserListItem) => void;
}) {
  if (!loading && !detail) return null;
  const user = detail?.user;

  return (
    <div className="rd-user-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="rd-user-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="User details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rd-user-drawer__header">
          {user ? (
            <>
              <UserAvatar row={user} large />
              <div>
                <span>User details</span>
                <h3>{user.displayName}</h3>
                <p>@{user.username} / {user.id}</p>
              </div>
            </>
          ) : (
            <div className="rd-user-drawer__loading-title">Loading user details...</div>
          )}
          <button type="button" onClick={onClose} aria-label="Close user details">Close</button>
        </header>

        <nav className="rd-user-drawer__tabs" aria-label="User detail sections">
          {DETAIL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : ""}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="rd-user-drawer__body">
          {loading || !detail || !user ? (
            <div className="rd-user-detail-skeleton" aria-label="Loading user details">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <div className="rd-user-detail-grid">
                  <DetailValue label="Display name" value={user.displayName} />
                  <DetailValue label="Username" value={`@${user.username}`} />
                  <DetailValue label="Account status" value={titleCase(user.accountStatus)} />
                  <DetailValue label="Email verification" value={titleCase(user.emailStatus)} />
                  <DetailValue label="Created" value={formatDate(user.createdAt)} />
                  <DetailValue label="Last seen" value={formatDate(user.lastSeenAt)} />
                  <DetailValue label="Platform" value={user.platform} />
                  <DetailValue label="Risk" value={titleCase(user.risk)} />
                </div>
              )}
              {tab === "account" && (
                <div className="rd-user-detail-grid">
                  <DetailValue label="Email" value={user.email} />
                  <DetailValue label="Auth provider" value={detail.auth.provider} />
                  <DetailValue label="Auth email confirmed" value={detail.auth.emailConfirmedAt ? "Yes" : "No"} />
                  <DetailValue label="Deletion requested" value={formatDate(detail.account.deletionRequestedAt)} />
                  <DetailValue label="Onboarding complete" value={detail.account.onboardingCompleted} />
                  <DetailValue label="Profile updated" value={formatDate(detail.account.updatedAt)} />
                </div>
              )}
              {tab === "security" && (
                <>
                  <div className="rd-user-detail-grid">
                    <DetailValue label="MFA factors" value={detail.security.mfaFactorCount} />
                    <DetailValue label="Active sessions" value={detail.security.activeSessionCount} />
                    <DetailValue label="Risk level" value={detail.security.riskLevel} />
                    <DetailValue label="Last sign in" value={formatDate(detail.auth.lastSignInAt)} />
                  </div>
                  <DetailCollection title="Security flags" rows={detail.securityFlags} />
                </>
              )}
              {tab === "sessions" && <DetailCollection title="Sessions" rows={detail.sessions} />}
              {tab === "roles" && <DetailCollection title="Platform roles" rows={detail.roles} />}
              {tab === "content" && (
                <div className="rd-user-detail-grid">
                  {Object.entries(detail.content).map(([key, value]) => (
                    <DetailValue key={key} label={titleCase(key)} value={value} />
                  ))}
                </div>
              )}
              {tab === "communities" && <DetailCollection title="Communities" rows={detail.communities} />}
              {tab === "dm-safety" && (
                <div className="rd-user-detail-grid">
                  {Object.entries(detail.dmSafety).map(([key, value]) => (
                    <DetailValue key={key} label={titleCase(key)} value={value} />
                  ))}
                </div>
              )}
              {tab === "moderation" && (
                <>
                  <DetailCollection title="Restrictions" rows={detail.restrictions} />
                  <DetailCollection title="Bans" rows={detail.bans} />
                  <DetailCollection title="Internal tags" rows={detail.tags} />
                </>
              )}
              {tab === "emails" && <DetailCollection title="Email deliveries" rows={detail.emails} />}
              {tab === "notifications" && (
                <div className="rd-user-detail-grid">
                  {Object.entries(detail.notifications).map(([key, value]) => (
                    <DetailValue key={key} label={titleCase(key)} value={value} />
                  ))}
                </div>
              )}
              {tab === "audit" && <DetailCollection title="Audit history" rows={detail.audit} />}
            </>
          )}
        </div>

        {user && (
          <footer className="rd-user-drawer__footer">
            <button type="button" onClick={() => onAction("revoke_sessions", user)}>Revoke sessions</button>
            <button type="button" onClick={() => onAction("send_password_reset", user)}>Password reset</button>
            <button type="button" className="is-danger" onClick={() => onAction("suspend", user)}>Suspend</button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function ActionDialog({
  state,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  state: NonNullable<ActionDialogState>;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (request: RootUserActionRequest) => void;
}) {
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [restriction, setRestriction] = useState("dm_sending");
  const [roleKey, setRoleKey] = useState("support_agent");
  const [tag, setTag] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reasonRequired =
    state.dangerous
    || state.action === "manual_verify_email"
    || state.action === "limit_account"
    || state.action === "set_under_review"
    || state.action === "assign_role";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      action: state.action,
      targetUserIds: state.targets,
      reason: reason.trim() || undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      restriction: state.action === "add_restriction" || state.action === "remove_restriction"
        ? restriction
        : undefined,
      roleKey: state.action === "assign_role" ? roleKey : undefined,
      tag: state.action === "add_tag" ? tag.trim() : undefined,
      confirmation: state.action === "permanent_delete" ? confirmation : undefined,
      confirmEmail: state.action === "permanent_delete" ? confirmEmail.trim() : undefined,
    });
  };

  const invalid =
    (reasonRequired && reason.trim().length < 8)
    || (state.action === "temporary_ban" && !expiresAt)
    || (state.action === "add_tag" && tag.trim().length < 2)
    || (state.action === "permanent_delete"
      && (confirmation !== "DELETE USER PERMANENTLY" || !confirmEmail.includes("@")));

  return (
    <div className="rd-user-modal-backdrop" role="presentation">
      <section
        className={`rd-user-action-modal${state.dangerous ? " is-dangerous" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rd-user-action-title"
      >
        <header>
          <span>{state.dangerous ? "Protected action" : "User action"}</span>
          <h3 id="rd-user-action-title">{state.label}</h3>
          <p>This action targets {state.targets.length} user{state.targets.length === 1 ? "" : "s"}.</p>
        </header>
        <form onSubmit={submit}>
          {reasonRequired && (
            <label>
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={8}
                maxLength={500}
                required
                placeholder="Enter a clear internal reason (minimum 8 characters)"
              />
            </label>
          )}
          {state.action === "temporary_ban" && (
            <label>
              Ban expires
              <input
                type="datetime-local"
                value={expiresAt}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
              />
            </label>
          )}
          {(state.action === "add_restriction" || state.action === "remove_restriction") && (
            <label>
              Product capability
              <select value={restriction} onChange={(event) => setRestriction(event.target.value)}>
                <option value="feed_posting">Feed posting</option>
                <option value="commenting">Commenting</option>
                <option value="dm_sending">DM sending</option>
                <option value="community_creation">Community creation</option>
                <option value="community_joining">Community joining</option>
                <option value="voice">Voice</option>
                <option value="camera">Camera</option>
                <option value="screen_share">Screen share</option>
                <option value="file_upload">File upload</option>
                <option value="event_creation">Event creation</option>
                <option value="invite_sending">Invite sending</option>
              </select>
            </label>
          )}
          {state.action === "assign_role" && (
            <label>
              Platform role
              <select value={roleKey} onChange={(event) => setRoleKey(event.target.value)}>
                <option value="support_agent">Support agent</option>
                <option value="support_manager">Support manager</option>
                <option value="security_analyst">Security analyst</option>
                <option value="security_manager">Security manager</option>
                <option value="moderator">Moderator</option>
                <option value="trust_safety_manager">Trust and safety manager</option>
                <option value="platform_admin">Platform admin</option>
              </select>
            </label>
          )}
          {state.action === "add_tag" && (
            <label>
              Internal tag
              <input value={tag} onChange={(event) => setTag(event.target.value)} maxLength={80} required />
            </label>
          )}
          {state.action === "permanent_delete" && (
            <>
              <label>
                Confirm target email
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Type DELETE USER PERMANENTLY
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
            </>
          )}
          {error && <p className="rd-user-form-error" role="alert">{error}</p>}
          <footer>
            <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className={state.dangerous ? "is-danger" : "is-primary"} disabled={busy || invalid}>
              {busy ? "Applying..." : state.label}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function UsersPage({ access: _access, isRootOwner = false }: UsersPageProps) {
  const [filters, setFilters] = useState<RootUserFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState<RootUserFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<RootUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RootUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<RootUserDetailTab>("overview");
  const [dialog, setDialog] = useState<ActionDialogState>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((current) => ({ ...filters, page: filters.search !== current.search ? 1 : filters.page }));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const loadUsers = useCallback(async (silent = false) => {
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await rootDashboardUserService.listUsers(query);
      if (requestId !== requestRef.current) return;
      setData(response);
      setSelected((current) => {
        const visible = new Set(response.items.map((item) => item.id));
        return new Set([...current].filter((id) => visible.has(id)));
      });
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let subscription: RootUserRealtimeSubscription | null = null;
    subscription = rootDashboardUserService.subscribe(() => {
      void loadUsers(true);
      if (detailId) {
        void rootDashboardUserService.getUserDetail(detailId).then(setDetail).catch(() => undefined);
      }
    });
    return () => subscription?.unsubscribe();
  }, [detailId, loadUsers]);

  const openDetail = useCallback(async (userId: string) => {
    setDetailId(userId);
    setDetail(null);
    setDetailTab("overview");
    setDetailLoading(true);
    try {
      setDetail(await rootDashboardUserService.getUserDetail(userId));
    } catch (detailError) {
      setNotice(detailError instanceof Error ? detailError.message : "Could not load user details.");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const beginAction = useCallback((action: RootUserAction, user: RootUserListItem) => {
    setOpenMenu(null);
    setActionError(null);
    setDialog({
      action,
      targets: [user.id],
      label: actionLabel(action),
      dangerous: isDangerousAction(action),
    });
  }, []);

  const beginBulkAction = useCallback((action: RootUserAction) => {
    if (selected.size === 0) return;
    setActionError(null);
    setDialog({
      action,
      targets: [...selected],
      label: actionLabel(action),
      dangerous: isDangerousAction(action),
    });
  }, [selected]);

  const submitAction = useCallback(async (request: RootUserActionRequest) => {
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await rootDashboardUserService.performAction(request);
      if (!result.success) throw new Error(result.message || "The action was not completed.");
      if (result.download) rootDashboardUserService.downloadExport(result.download);
      setNotice(result.message || "Action completed.");
      setDialog(null);
      setSelected(new Set());
      await loadUsers(true);
      if (detailId) setDetail(await rootDashboardUserService.getUserDetail(detailId));
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : "The action failed.");
    } finally {
      setActionBusy(false);
    }
  }, [detailId, loadUsers]);

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize));
  const allVisibleSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const capabilities = data?.capabilities;

  const summaryCards = useMemo(() => {
    const summary = data?.summary;
    return [
      { label: "Total users", value: summary?.total ?? 0, tone: "neutral" as const },
      { label: "Active", value: summary?.active ?? 0, tone: "good" as const },
      { label: "Unverified", value: summary?.unverified ?? 0, tone: "warning" as const },
      { label: "Suspended", value: summary?.suspended ?? 0, tone: "warning" as const },
      { label: "Temporary bans", value: summary?.temporarilyBanned ?? 0, tone: "danger" as const },
      { label: "Permanent bans", value: summary?.permanentlyBanned ?? 0, tone: "danger" as const },
      { label: "Registered 24h", value: summary?.registered24h ?? 0, tone: "neutral" as const },
      { label: "Active 7d", value: summary?.active7d ?? 0, tone: "good" as const },
      { label: "Deletion pending", value: summary?.deletionPending ?? 0, tone: "warning" as const },
    ];
  }, [data?.summary]);

  return (
    <section className="rd-users-page" aria-labelledby="rd-users-title">
      <header className="rd-users-header">
        <div>
          <span className="rd-users-eyebrow">Identity and access</span>
          <h2 id="rd-users-title">User Management</h2>
          <p>Search, review, secure, and audit Picom accounts through protected server-side operations.</p>
        </div>
        <div className="rd-users-header__actions">
          <div className={`rd-users-backend ${error ? "is-error" : "is-online"}`}>
            <span aria-hidden="true" />
            {error ? "Backend degraded" : "Supabase connected"}
          </div>
          <span className="rd-users-updated">Updated {data ? formatDate(data.checkedAt) : "pending"}</span>
          <button type="button" onClick={() => void loadUsers()} disabled={loading}>Refresh</button>
          {(capabilities?.canExport || isRootOwner) && (
            <button type="button" onClick={() => beginBulkAction("export_selection")} disabled={selected.size === 0}>
              Export selected
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="rd-users-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">Dismiss</button>
        </div>
      )}

      <div className="rd-user-metrics">
        {summaryCards.map((card) => <MetricCard key={card.label} {...card} />)}
      </div>

      <section className="rd-user-filters" aria-label="User filters">
        <label className="rd-user-search">
          <span>Search users</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
            placeholder="Name, @handle, exact email, or UUID"
          />
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select>
        </label>
        <label>
          <span>Email</span>
          <select value={filters.emailStatus} onChange={(event) => setFilters((current) => ({ ...current, emailStatus: event.target.value, page: 1 }))}>
            <option value="all">All email states</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending</option>
            <option value="delivery_failed">Delivery failed</option>
            <option value="invalid">Invalid</option>
          </select>
        </label>
        <label>
          <span>Role</span>
          <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))}>
            <option value="all">All roles</option>
            <option value="root_owner">Root owner</option>
            <option value="platform_admin">Platform admin</option>
            <option value="security_manager">Security manager</option>
            <option value="security_analyst">Security analyst</option>
            <option value="trust_safety_manager">Trust and safety</option>
            <option value="moderator">Moderator</option>
            <option value="support_manager">Support manager</option>
            <option value="support_agent">Support agent</option>
            <option value="member">Member</option>
          </select>
        </label>
        <label>
          <span>Risk</span>
          <select value={filters.risk} onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value, page: 1 }))}>
            <option value="all">All risk levels</option>
            <option value="none">No risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          <span>Platform</span>
          <select value={filters.platform} onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value, page: 1 }))}>
            <option value="all">All platforms</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
            <option value="macOS">macOS</option>
            <option value="Web">Web</option>
            <option value="Unknown">Unknown</option>
          </select>
        </label>
        <label>
          <span>Created from</span>
          <input type="date" value={filters.createdFrom} onChange={(event) => setFilters((current) => ({ ...current, createdFrom: event.target.value, page: 1 }))} />
        </label>
        <label>
          <span>Created to</span>
          <input type="date" value={filters.createdTo} onChange={(event) => setFilters((current) => ({ ...current, createdTo: event.target.value, page: 1 }))} />
        </label>
        <label>
          <span>Last seen</span>
          <select value={filters.lastSeen} onChange={(event) => setFilters((current) => ({ ...current, lastSeen: event.target.value, page: 1 }))}>
            <option value="all">Any time</option>
            <option value="24h">Past 24 hours</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
            <option value="never">Never</option>
          </select>
        </label>
        <label className="rd-user-filter-check">
          <input type="checkbox" checked={filters.includeDeleted} onChange={(event) => setFilters((current) => ({ ...current, includeDeleted: event.target.checked, page: 1 }))} />
          <span>Include deleted</span>
        </label>
        <div className="rd-user-filter-actions">
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("picom.root.users.saved-filter", JSON.stringify(filters));
              setNotice("Filter saved on this administrator device.");
            }}
          >
            Save filter
          </button>
        </div>
      </section>

      {selected.size > 0 && (
        <div className="rd-user-bulkbar">
          <strong>{selected.size} selected</strong>
          <button type="button" onClick={() => beginBulkAction("resend_verification")}>Resend verification</button>
          <button type="button" onClick={() => beginBulkAction("set_under_review")}>Mark under review</button>
          <button type="button" onClick={() => beginBulkAction("add_restriction")}>Add restriction</button>
          <button type="button" onClick={() => beginBulkAction("add_tag")}>Add internal tag</button>
          {capabilities?.canExport && <button type="button" onClick={() => beginBulkAction("export_selection")}>Export CSV</button>}
          <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <section className="rd-user-table-card">
        {error ? (
          <div className="rd-user-table-state is-error" role="alert">
            <h3>Users could not be loaded</h3>
            <p>{error}</p>
            <button type="button" onClick={() => void loadUsers()}>Retry</button>
          </div>
        ) : (
          <div className="rd-user-table-scroll">
            <table className="rd-user-table">
              <thead>
                <tr>
                  <th className="rd-user-select-cell">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      aria-label="Select all users on this page"
                      onChange={(event) => {
                        if (event.target.checked) setSelected(new Set(items.map((item) => item.id)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                  <th>User</th>
                  <th>Handle</th>
                  <th>Email</th>
                  <th>Email verification</th>
                  <th>
                    <button
                      type="button"
                      className="rd-user-sort"
                      onClick={() => setFilters((current) => ({
                        ...current,
                        sort: "status",
                        direction: current.sort === "status" && current.direction === "asc" ? "desc" : "asc",
                      }))}
                    >
                      Account status
                    </button>
                  </th>
                  <th>Role</th>
                  <th>Security</th>
                  <th>
                    <button
                      type="button"
                      className="rd-user-sort"
                      onClick={() => setFilters((current) => ({
                        ...current,
                        sort: "created_at",
                        direction: current.sort === "created_at" && current.direction === "asc" ? "desc" : "asc",
                      }))}
                    >
                      Created
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="rd-user-sort"
                      onClick={() => setFilters((current) => ({
                        ...current,
                        sort: "last_seen_at",
                        direction: current.sort === "last_seen_at" && current.direction === "asc" ? "desc" : "asc",
                      }))}
                    >
                      Last seen
                    </button>
                  </th>
                  <th>Platform</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }, (_, index) => (
                    <tr key={`skeleton-${index}`} className="rd-user-skeleton-row">
                      <td><span /></td>
                      {Array.from({ length: 11 }, (__, cell) => <td key={cell}><span /></td>)}
                    </tr>
                  ))
                  : items.map((user) => (
                    <tr key={user.id}>
                      <td className="rd-user-select-cell">
                        <input
                          type="checkbox"
                          checked={selected.has(user.id)}
                          aria-label={`Select ${user.displayName}`}
                          onChange={(event) => {
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(user.id);
                              else next.delete(user.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button type="button" className="rd-user-identity" onClick={() => void openDetail(user.id)}>
                          <UserAvatar row={user} />
                          <span>
                            <strong>{user.displayName}</strong>
                            <small>{user.id}</small>
                          </span>
                        </button>
                      </td>
                      <td>@{user.username}</td>
                      <td className="rd-user-email">{user.email}</td>
                      <td><StatusBadge value={user.emailStatus} /></td>
                      <td><StatusBadge value={user.accountStatus} /></td>
                      <td>{titleCase(user.role)}</td>
                      <td>
                        <span className={`rd-user-risk is-${user.risk}`}>{titleCase(user.risk)}</span>
                        {user.mfaEnabled && <span className="rd-user-mfa">MFA</span>}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.lastSeenAt)}</td>
                      <td>{user.platform}</td>
                      <td className="rd-user-actions-cell">
                        <button
                          type="button"
                          aria-label={`Actions for ${user.displayName}`}
                          aria-expanded={openMenu === user.id}
                          onClick={() => setOpenMenu((current) => current === user.id ? null : user.id)}
                        >
                          More
                        </button>
                        {openMenu === user.id && (
                          <div className="rd-user-actions-menu">
                            <button type="button" onClick={() => void openDetail(user.id)}>View details</button>
                            <button type="button" onClick={() => beginAction("manual_verify_email", user)} disabled={user.emailStatus === "verified"}>Manual verify</button>
                            <button type="button" onClick={() => beginAction("resend_verification", user)}>Resend verification</button>
                            <button type="button" onClick={() => beginAction("send_password_reset", user)}>Password reset</button>
                            <button type="button" onClick={() => beginAction("revoke_sessions", user)}>Revoke sessions</button>
                            <button type="button" onClick={() => beginAction("reset_mfa", user)} disabled={!user.mfaEnabled}>Reset MFA</button>
                            <button type="button" onClick={() => beginAction("add_restriction", user)}>Add restriction</button>
                            <button type="button" onClick={() => beginAction("set_under_review", user)}>Mark under review</button>
                            <button type="button" onClick={() => beginAction("suspend", user)}>Suspend</button>
                            <button type="button" onClick={() => beginAction("temporary_ban", user)}>Temporary ban</button>
                            <button type="button" className="is-danger" onClick={() => beginAction("permanent_ban", user)}>Permanent ban</button>
                            {(user.accountStatus === "temporarily_banned" || user.accountStatus === "permanently_banned") && (
                              <button type="button" onClick={() => beginAction("unban", user)}>Remove ban</button>
                            )}
                            {user.accountStatus !== "active" && <button type="button" onClick={() => beginAction("reactivate", user)}>Reactivate</button>}
                            {capabilities?.canManageRoles && <button type="button" onClick={() => beginAction("assign_role", user)}>Change role</button>}
                            {capabilities?.canExport && <button type="button" onClick={() => beginAction("export_user", user)}>Export user</button>}
                            <button type="button" onClick={() => beginAction("start_deletion", user)}>Start deletion</button>
                            {capabilities?.canPermanentlyDelete && (
                              <button type="button" className="is-danger" onClick={() => beginAction("permanent_delete", user)}>Permanent delete</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!loading && items.length === 0 && (
              <div className="rd-user-table-state">
                <h3>No users match these filters</h3>
                <p>Clear one or more filters and try again.</p>
                <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
              </div>
            )}
          </div>
        )}

        <footer className="rd-user-pagination">
          <span>{data?.total ?? 0} users</span>
          <label>
            Rows
            <select value={query.pageSize} onChange={(event) => setFilters((current) => ({ ...current, pageSize: Number(event.target.value) as 25 | 50 | 100, page: 1 }))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button type="button" disabled={query.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
          <span>Page {query.page} of {totalPages}</span>
          <button type="button" disabled={query.page >= totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
        </footer>
      </section>

      {detailId && (
        <UserDetailDrawer
          detail={detail}
          loading={detailLoading}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => {
            setDetailId(null);
            setDetail(null);
          }}
          onAction={beginAction}
        />
      )}

      {dialog && (
        <ActionDialog
          key={`${dialog.action}-${dialog.targets.join("-")}`}
          state={dialog}
          busy={actionBusy}
          error={actionError}
          onCancel={() => {
            if (!actionBusy) {
              setDialog(null);
              setActionError(null);
            }
          }}
          onSubmit={(request) => void submitAction(request)}
        />
      )}
    </section>
  );
}
