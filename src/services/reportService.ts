import type { CreateReportInput, ReportRecord, ReportStatus, UpdateReportStatusInput } from "../types/reports";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { auditLogService } from "./auditLogService";

type ReportResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;
type ReportRow = {
  id: string; community_id: string | null; reporter_id: string; target_type: string; target_id: string;
  reason: string; description: string; status: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string;
};

const reports: ReportRecord[] = [];
let reportCounter = 0;

function createReportId(): string { reportCounter += 1; return `local-report-${Date.now()}-${reportCounter}`; }
const REPORT_SECRET_PATTERN = /(bearer\s+)[a-z0-9._~+\/-]+|((?:password|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*)[^,;\s]+/gi;
const allowedTransitions: Record<ReportStatus, readonly ReportStatus[]> = { open: ["reviewed", "dismissed", "action_taken"], reviewed: ["dismissed", "action_taken"], dismissed: [], action_taken: [] };
function sanitizeDescription(value: string | undefined): string { return (value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(REPORT_SECRET_PATTERN, (_match, bearerPrefix: string | undefined, keyPrefix: string | undefined) => `${bearerPrefix ?? keyPrefix ?? ""}[REDACTED]`).trim() || "No additional details provided.").slice(0, 1000); }
export function canTransitionReportStatus(from: ReportStatus, to: ReportStatus): boolean { return allowedTransitions[from].includes(to); }
function cacheReport(report: ReportRecord): void { const index = reports.findIndex((item) => item.id === report.id); if (index >= 0) reports[index] = report; else reports.unshift(report); }
function isPodcastReportTarget(targetType: ReportRecord["targetType"]): boolean { return targetType === "podcast_episode" || targetType === "podcast_comment"; }
function mapReport(row: ReportRow): ReportRecord {
  return { id: row.id, communityId: row.community_id ?? undefined, reporterId: row.reporter_id, targetType: row.target_type as ReportRecord["targetType"], targetId: row.target_id, reason: row.reason as ReportRecord["reason"], description: sanitizeDescription(row.description), status: row.status as ReportStatus, reviewedById: row.reviewed_by ?? undefined, reviewedAt: row.reviewed_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

export const reportService = {
  async submitReport(input: CreateReportInput): Promise<ReportResult<ReportRecord>> {
    if (!input.reporterId || !input.targetId || !input.communityId) return { ok: false, message: "Report could not be submitted without a visible community context." };
    const now = new Date().toISOString();

    if (dataSourceService.getStatus().isMock) {
      const report: ReportRecord = { id: createReportId(), communityId: input.communityId, channelId: input.channelId, reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, description: sanitizeDescription(input.description), status: "open", createdAt: now, updatedAt: now };
      cacheReport(report);
      loggingService.logInfo("Local safety report created", { reportId: report.id, targetType: report.targetType, communityId: report.communityId }, "reports");
      return { ok: true, data: report };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Reporting is unavailable while the API is not configured." };
    const { data, error } = await client.from("reports").insert({ community_id: input.communityId, reporter_id: input.reporterId, target_type: input.targetType, target_id: input.targetId, reason: input.reason, description: sanitizeDescription(input.description), status: "open" }).select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,reviewed_at,created_at,updated_at").single();
    if (error || !data) return { ok: false, message: "Picom could not submit this report. Please try again." };
    const report = mapReport(data);
    cacheReport(report);
    return { ok: true, data: report };
  },

  listReports(communityId?: string): ReportRecord[] { return reports.filter((report) => !communityId || report.communityId === communityId).map((report) => ({ ...report })); },

  async listCommunityReports(communityId: string, canReview: boolean): Promise<ReportResult<ReportRecord[]>> {
    if (!canReview) return { ok: false, message: "You do not have permission to view community reports." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: this.listReports(communityId) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "The moderation queue is unavailable." };
    const { data, error } = await client.from("reports").select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,reviewed_at,created_at,updated_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, message: "Picom could not load the moderation queue." };
    const mapped = (data ?? []).map(mapReport); mapped.forEach(cacheReport); return { ok: true, data: mapped };
  },

  async updateReportStatus(input: UpdateReportStatusInput): Promise<ReportResult<ReportRecord>> {
    if (!input.canReview) return { ok: false, message: "You do not have permission to review community reports." };
    const current = reports.find((report) => report.id === input.reportId);
    if (dataSourceService.getStatus().isMock) {
      if (!current) return { ok: false, message: "Report was not found in the local queue." };
      if (!canTransitionReportStatus(current.status, input.status)) return { ok: false, message: "This report status transition is not allowed." };
      const now = new Date().toISOString();
      const next: ReportRecord = { ...current, status: input.status, reviewedById: input.reviewedById ?? "mock-current-reviewer", reviewedAt: now, updatedAt: now };
      cacheReport(next);
      loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status, targetType: next.targetType }, "audit");
      if (next.communityId) await auditLogService.append({ communityId: next.communityId, actorId: input.reviewedById, actionType: "moderation_action", targetType: "report", targetId: next.id, reason: `Report marked ${next.status}` });
      return { ok: true, data: next };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "The moderation queue is unavailable." };
    const { data: authData } = await client.auth.getUser();
    const reviewerId = input.reviewedById ?? authData.user?.id;
    if (!reviewerId) return { ok: false, message: "Sign in before reviewing reports." };
    const { data, error } = await client.from("reports").update({ status: input.status, reviewed_by: reviewerId, updated_at: new Date().toISOString() }).eq("id", input.reportId).select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,reviewed_at,created_at,updated_at").single();
    if (error || !data) return { ok: false, message: "Picom could not update this report." };
    const next = mapReport(data); cacheReport(next); loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status }, "audit"); if (next.communityId && !isPodcastReportTarget(next.targetType)) await auditLogService.append({ communityId: next.communityId, actionType: "moderation_action", targetType: "report", targetId: next.id, reason: `Report marked ${next.status}` }); return { ok: true, data: next };
  },

  getSummary(): Record<ReportStatus, number> { return reports.reduce<Record<ReportStatus, number>>((summary, report) => { summary[report.status] += 1; return summary; }, { open: 0, reviewed: 0, dismissed: 0, action_taken: 0 }); },
  canTransitionReportStatus,
};
