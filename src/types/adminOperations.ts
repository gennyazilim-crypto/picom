export type AdminOperationsListSection = "users" | "communities" | "reports" | "abuse_events";
export type AdminOperationsListItem = Readonly<{ id: string; section: AdminOperationsListSection; label: string; detail: string; status: string; createdAt: string }>;
export type AdminOperationsPage = Readonly<{ items: readonly AdminOperationsListItem[]; nextCursor: string | null; hasMore: boolean; limit: number }>;
export type AdminSystemStatusV2 = Readonly<{ database: "operational"; users: number; communities: number; openReports: number; abuseEvents24h: number; adminAuditEvents24h: number; checkedAt: string; source: "local" | "app_admin_rpc" }>;
export type AdminOperationsResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;

export type AdminInfrastructureStatus = Readonly<{
  overall: "operational" | "degraded" | "not_configured";
  deployment: "self_hosted" | "cloud" | "not_configured";
  database: "operational" | "unavailable" | "development";
  livekit: "operational" | "unavailable" | "not_configured" | "configured_unverified";
  turn: "configured" | "not_configured";
  redis: "configured" | "not_configured";
  livekitLatencyMs: number | null;
  checkedAt: string;
  source: "admin_health_edge" | "local";
}>;
