export type EnterpriseAuditSource = "community_audit" | "admin_action" | "security_event";
export type EnterpriseAuditExportFormat = "json" | "csv";
export type EnterpriseAuditExportScope = "community" | "organization" | "app";

export type EnterpriseAuditExportRecord = Readonly<{
  id: string;
  source: EnterpriseAuditSource;
  action: string;
  createdAt: string;
  actorId?: string;
  communityId?: string;
  organizationId?: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  outcome?: "success" | "denied" | "failed";
  severity?: "info" | "warning" | "critical";
  reason?: string;
}>;

export type EnterpriseAuditExportAccess = Readonly<{
  canExport: boolean;
  scope: EnterpriseAuditExportScope;
  scopeId: string;
  allowedCommunityIds?: readonly string[];
}>;

export type EnterpriseAuditExportRequest = Readonly<{
  format: EnterpriseAuditExportFormat;
  access: EnterpriseAuditExportAccess;
  records: readonly EnterpriseAuditExportRecord[];
}>;

export type EnterpriseAuditExportPreview = Readonly<{
  fileName: string;
  mimeType: "application/json" | "text/csv";
  content: string;
  recordCount: number;
  productionEnabled: false;
}>;

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const MAX_PREVIEW_RECORDS = 500;

function sanitizeText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength) || undefined;
}

function normalizeRecord(record: EnterpriseAuditExportRecord): EnterpriseAuditExportRecord {
  return Object.freeze({
    id: sanitizeText(record.id, 160) ?? "unknown",
    source: record.source,
    action: sanitizeText(record.action, 160) ?? "unknown",
    createdAt: Number.isNaN(Date.parse(record.createdAt)) ? "invalid-timestamp" : new Date(record.createdAt).toISOString(),
    actorId: sanitizeText(record.actorId, 160),
    communityId: sanitizeText(record.communityId, 160),
    organizationId: sanitizeText(record.organizationId, 160),
    targetType: sanitizeText(record.targetType, 120),
    targetId: sanitizeText(record.targetId, 160),
    requestId: sanitizeText(record.requestId, 160),
    outcome: record.outcome,
    severity: record.severity,
    reason: sanitizeText(record.reason, 300),
  });
}

function isRecordInScope(record: EnterpriseAuditExportRecord, access: EnterpriseAuditExportAccess): boolean {
  if (access.scope === "app") return true;
  if (access.scope === "organization") return record.organizationId === access.scopeId;
  return record.communityId === access.scopeId && (access.allowedCommunityIds?.includes(access.scopeId) ?? false);
}

function escapeCsv(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(records: readonly EnterpriseAuditExportRecord[]): string {
  const fields: readonly (keyof EnterpriseAuditExportRecord)[] = [
    "id", "source", "action", "createdAt", "actorId", "communityId", "organizationId",
    "targetType", "targetId", "requestId", "outcome", "severity", "reason",
  ];
  const rows = records.map((record) => fields.map((field) => escapeCsv(record[field])).join(","));
  return [fields.join(","), ...rows].join("\r\n");
}

export const enterpriseAuditExportService = {
  isProductionEnabled(): false {
    return false;
  },

  createDevelopmentPreview(request: EnterpriseAuditExportRequest): Result<EnterpriseAuditExportPreview> {
    if (!import.meta.env.DEV) {
      return { ok: false, message: "Enterprise audit export requires the production backend export job." };
    }
    if (!request.access.canExport || !request.access.scopeId.trim()) {
      return { ok: false, message: "You do not have permission to export this audit scope." };
    }
    if (request.access.scope === "community" && !request.access.allowedCommunityIds?.includes(request.access.scopeId)) {
      return { ok: false, message: "The requested community is outside your permitted audit scope." };
    }

    const records = request.records
      .filter((record) => isRecordInScope(record, request.access))
      .slice(0, MAX_PREVIEW_RECORDS)
      .map(normalizeRecord);
    const exportedAt = new Date().toISOString();
    const safeScopeId = request.access.scopeId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "scope";
    const fileName = `picom-audit-preview-${request.access.scope}-${safeScopeId}.${request.format}`;

    return {
      ok: true,
      data: Object.freeze({
        fileName,
        mimeType: request.format === "json" ? "application/json" : "text/csv",
        content: request.format === "json"
          ? JSON.stringify({ schemaVersion: 1, exportedAt, scope: request.access.scope, scopeId: request.access.scopeId, records }, null, 2)
          : toCsv(records),
        recordCount: records.length,
        productionEnabled: false,
      }),
    };
  },
};

