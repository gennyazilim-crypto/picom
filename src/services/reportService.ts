import type { CreateReportInput, ReportRecord, ReportStatus, UpdateReportStatusInput } from "../types/reports";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { auditLogService } from "./auditLogService";

type ReportResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;
type ReportRow = {
  id: string; community_id: string | null; conversation_id: string | null; reporter_id: string; target_type: string; target_id: string;
  reason: string; description: string; evidence_excerpt: string | null; status: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string;
};

const reports: ReportRecord[] = [];
let reportCounter = 0;

function createReportId(): string { reportCounter += 1; return `local-report-${Date.now()}-${reportCounter}`; }
const REPORT_SECRET_PATTERN = /(bearer\s+)[a-z0-9._~+\/-]+|((?:password|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*)[^,;\s]+/gi;
const allowedTransitions: Record<ReportStatus, readonly ReportStatus[]> = { open: ["reviewed", "dismissed", "action_taken"], reviewed: ["dismissed", "action_taken"], dismissed: [], action_taken: [] };
function sanitizeDescription(value: string | undefined): string { return (value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(REPORT_SECRET_PATTERN, (_match, bearerPrefix: string | undefined, keyPrefix: string | undefined) => `${bearerPrefix ?? keyPrefix ?? ""}[REDACTED]`).trim() || "No additional details provided.").slice(0, 1000); }
function sanitizeEvidence(value: string | undefined): string | undefined { const sanitized = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(REPORT_SECRET_PATTERN, (_match, bearerPrefix: string | undefined, keyPrefix: string | undefined) => `${bearerPrefix ?? keyPrefix ?? ""}[REDACTED]`).trim().slice(0, 280); return sanitized || undefined; }
export function canTransitionReportStatus(from: ReportStatus, to: ReportStatus): boolean { return allowedTransitions[from].includes(to); }
function cacheReport(report: ReportRecord): void { const index = reports.findIndex((item) => item.id === report.id); if (index >= 0) reports[index] = report; else reports.unshift(report); }
function isPodcastReportTarget(targetType: ReportRecord["targetType"]): boolean { return targetType === "podcast_episode" || targetType === "podcast_comment"; }
function mapReport(row: ReportRow): ReportRecord {
  return { id: row.id, communityId: row.community_id ?? undefined, conversationId: row.conversation_id ?? undefined, reporterId: row.reporter_id, targetType: row.target_type as ReportRecord["targetType"], targetId: row.target_id, reason: row.reason as ReportRecord["reason"], description: sanitizeDescription(row.description), evidenceExcerpt: sanitizeEvidence(row.evidence_excerpt ?? undefined), status: row.status as ReportStatus, reviewedById: row.reviewed_by ?? undefined, reviewedAt: row.reviewed_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

export const reportService = {
  async submitReport(input: CreateReportInput): Promise<ReportResult<ReportRecord>> {
    const directContext = Boolean(input.conversationId) && (input.targetType === "direct_message" || input.targetType === "user");
    if (!input.reporterId || !input.targetId || (!input.communityId && !directContext)) return { ok: false, message: "Report could not be submitted without an authorized content context." };
    const now = new Date().toISOString();

    if (dataSourceService.getStatus().isMock) {
      const recentCount = reports.filter((report) => report.reporterId === input.reporterId && Date.parse(report.createdAt) >= Date.now() - 10 * 60 * 1000).length;
      if (recentCount >= 5) return { ok: false, message: "Too many reports were submitted. Please wait before trying again." };
      const report: ReportRecord = { id: createReportId(), communityId: input.communityId, channelId: input.channelId, conversationId: input.conversationId, reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, description: sanitizeDescription(input.description), evidenceExcerpt: sanitizeEvidence(input.evidenceExcerpt), status: "open", createdAt: now, updatedAt: now };
      cacheReport(report);
      loggingService.logInfo("Local safety report created", { reportId: report.id, targetType: report.targetType, communityId: report.communityId }, "reports");
      return { ok: true, data: report };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Reporting is unavailable while the API is not configured." };
    const { data, error } = await client.rpc("submit_safety_report", { report_target_type: input.targetType, report_target_id: input.targetId, report_reason: input.reason, report_description: sanitizeDescription(input.description), report_community_id: input.communityId ?? null, report_conversation_id: input.conversationId ?? null });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: false, message: error?.message.includes("REPORT_RATE_LIMITED") ? "Too many reports were submitted. Please wait before trying again." : "Picom could not submit this report. Please try again." };
    const report = mapReport(row as ReportRow);
    cacheReport(report);
    return { ok: true, data: report };
  },

  listReports(communityId?: string): ReportRecord[] { return reports.filter((report) => !communityId || report.communityId === communityId).map((report) => ({ ...report })); },

  async listCommunityReports(communityId: string, canReview: boolean): Promise<ReportResult<ReportRecord[]>> {
    if (!canReview) return { ok: false, message: "You do not have permission to view community reports." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: this.listReports(communityId) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "The moderation queue is unavailable." };
    const response = await client.rpc("list_community_report_queue" as never, { target_community_id: communityId } as never);
    const data = response.data as unknown as ReportRow[] | null; const error = response.error;
    if (error) return { ok: false, message: "Picom could not load the moderation queue." };
    const mapped = (data ?? []).map(mapReport); mapped.forEach(cacheReport); return { ok: true, data: mapped };
  },

  async updateReportStatus(input: UpdateReportStatusInput): Promise<ReportResult<ReportRecord>> {
    if (!input.canReview) return { ok: false, message: "You do not have permission to review community reports." };
    const current = reports.find((report) => report.id === input.reportId);
    const reviewReason = input.reviewReason?.trim() || `Report marked ${input.status}`;
    if (reviewReason.length < 3 || reviewReason.length > 500) return { ok: false, message: "Review reason must be between 3 and 500 characters." };
    if (dataSourceService.getStatus().isMock) {
      if (!current) return { ok: false, message: "Report was not found in the local queue." };
      if (!canTransitionReportStatus(current.status, input.status)) return { ok: false, message: "This report status transition is not allowed." };
      const now = new Date().toISOString();
      const next: ReportRecord = { ...current, status: input.status, reviewedById: input.reviewedById ?? "mock-current-reviewer", reviewedAt: now, updatedAt: now };
      cacheReport(next);
      loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status, targetType: next.targetType }, "audit");
      if (next.communityId) await auditLogService.append({ communityId: next.communityId, actorId: input.reviewedById, actionType: "moderation_action", targetType: "report", targetId: next.id, reason: reviewReason });
      return { ok: true, data: next };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "The moderation queue is unavailable." };
    const { data: authData } = await client.auth.getUser();
    const reviewerId = input.reviewedById ?? authData.user?.id;
    if (!reviewerId) return { ok: false, message: "Sign in before reviewing reports." };
    const response = await client.rpc("review_community_report" as never, { target_report_id: input.reportId, next_status: input.status, review_reason: reviewReason } as never);
    const row = (response.data as unknown as ReportRow[] | null)?.[0];
    if (response.error || !row) return { ok: false, message: response.error?.message.includes("REPORT_TRANSITION_INVALID") ? "This report status transition is not allowed." : "Picom could not update this report." };
    const next = mapReport(row); cacheReport(next); loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status }, "audit"); return { ok: true, data: next };
  },

  getSummary(): Record<ReportStatus, number> { return reports.reduce<Record<ReportStatus, number>>((summary, report) => { summary[report.status] += 1; return summary; }, { open: 0, reviewed: 0, dismissed: 0, action_taken: 0 }); },
  canTransitionReportStatus,
};
