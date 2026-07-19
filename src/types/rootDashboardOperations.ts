export const ROOT_DASHBOARD_MODULE_SECTIONS = [
  "support_tickets",
  "support_team",
  "ad_campaigns",
  "ad_creative_review",
  "advertising_team",
  "subscriptions",
  "finance_approvals",
  "incidents",
  "security_alerts",
  "security_team",
  "moderation_team",
  "role_assignments",
  "audit_logs",
  "feature_flags",
  "voice_rooms",
  "radio_sessions",
  "podcast_shows",
  "notifications_ops",
  "content_reports",
  "dm_safety_reports",
] as const;

export type RootDashboardModuleSection = (typeof ROOT_DASHBOARD_MODULE_SECTIONS)[number];

export type RootDashboardListItem = Readonly<{
  id: string;
  label: string;
  detail: string;
  status: string;
  createdAt: string;
}>;

export type RootDashboardListPage = Readonly<{
  items: readonly RootDashboardListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}>;

export type RootDashboardModuleSummaryKind = "support" | "advertising" | "revenue" | "incidents";

export type RootDashboardOverviewMetrics = Readonly<{
  onlineUsers: number | null;
  activeSessions: number | null;
  activeVoiceRooms: number | null;
  registrations24h: number | null;
  dau: number | null;
  wau: number | null;
  mau: number | null;
  analyticsAvailable: boolean;
  supportBacklog: number | null;
  moderationBacklog: number | null;
  securityAlerts24h: number | null;
  adImpressions: number | null;
  adClicks: number | null;
  activeSubscriptions: number | null;
  mrrCents: number | null;
  openIncidents: number | null;
  privilegedActions24h: number | null;
  checkedAt: string;
  source: "app_admin_rpc" | "local_empty";
}>;

export type RootDashboardMutationOk = Readonly<{
  ok: boolean;
  id?: string;
  message?: string;
}>;

export type RootDashboardCommandSearchItem = Readonly<{
  id: string;
  label: string;
  routeKey: string;
  detail: string;
}>;

export type RootDashboardCommandSearchResult = Readonly<{
  items: readonly RootDashboardCommandSearchItem[];
}>;

export type RootDashboardExportJob = Readonly<{
  id: string;
  label: string;
  detail: string;
  status: string;
  createdAt: string;
}>;
