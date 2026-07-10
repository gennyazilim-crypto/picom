import type { CreateReportInput, ReportRecord, ReportStatus, UpdateReportStatusInput } from "../types/reports";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { auditLogService } from "./auditLogService";

type ReportResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;
type ReportRow = {
  id: string; community_id: string | null; reporter_id: string; target_type: string; target_id: string;
  reason: string; description: string; status: string; reviewed_by: string | null; created_at: string; updated_at: string;
};

const reports: ReportRecord[] = [];
let reportCounter = 0;

function createReportId(): string { reportCounter += 1; return `local-report-${Date.now()}-${reportCounter}`; }
function sanitizeDescription(value: string | undefined): string { return (value?.trim() || "No additional details provided.").slice(0, 1000); }
function cacheReport(report: ReportRecord): void { const index = reports.findIndex((item) => item.id === report.id); if (index >= 0) reports[index] = report; else reports.unshift(report); }
function mapReport(row: ReportRow): ReportRecord {
  return { id: row.id, communityId: row.community_id ?? undefined, reporterId: row.reporter_id, targetType: row.target_type as ReportRecord["targetType"], targetId: row.target_id, reason: row.reason as ReportRecord["reason"], description: row.description, status: row.status as ReportStatus, reviewedById: row.reviewed_by ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

export const reportService = {
  async submitReport(input: CreateReportInput): Promise<ReportResult<ReportRecord>> {
    if (!input.reporterId || !input.targetId) return { ok: false, message: "Report could not be submitted." };
    const now = new Date().toISOString();

    if (dataSourceService.getStatus().isMock) {
      const report: ReportRecord = { id: createReportId(), communityId: input.communityId, channelId: input.channelId, reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, description: sanitizeDescription(input.description), status: "open", createdAt: now, updatedAt: now };
      cacheReport(report);
      loggingService.logInfo("Local safety report created", { reportId: report.id, targetType: report.targetType, communityId: report.communityId }, "reports");
      return { ok: true, data: report };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Reporting is unavailable while the API is not configured." };
    const { data, error } = await client.from("reports").insert({ community_id: input.communityId ?? null, reporter_id: input.reporterId, target_type: input.targetType, target_id: input.targetId, reason: input.reason, description: sanitizeDescription(input.description), status: "open" }).select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,created_at,updated_at").single();
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
    const { data, error } = await client.from("reports").select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,created_at,updated_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, message: "Picom could not load the moderation queue." };
    const mapped = (data ?? []).map(mapReport); mapped.forEach(cacheReport); return { ok: true, data: mapped };
  },

  async updateReportStatus(input: UpdateReportStatusInput): Promise<ReportResult<ReportRecord>> {
    const current = reports.find((report) => report.id === input.reportId);
    if (dataSourceService.getStatus().isMock) {
      if (!current) return { ok: false, message: "Report was not found in the local queue." };
      const next: ReportRecord = { ...current, status: input.status, reviewedById: input.reviewedById, updatedAt: new Date().toISOString() };
      cacheReport(next);
      loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status, targetType: next.targetType }, "audit");
      if (next.communityId) await auditLogService.append({ communityId: next.communityId, actorId: input.reviewedById, actionType: "moderation_action", targetType: "report", targetId: next.id, reason: `Report marked ${next.status}` });
      return { ok: true, data: next };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "The moderation queue is unavailable." };
    const { data, error } = await client.from("reports").update({ status: input.status, reviewed_by: input.reviewedById ?? null, updated_at: new Date().toISOString() }).eq("id", input.reportId).select("id,community_id,reporter_id,target_type,target_id,reason,description,status,reviewed_by,created_at,updated_at").single();
    if (error || !data) return { ok: false, message: "Picom could not update this report." };
    const next = mapReport(data); cacheReport(next); loggingService.logInfo("Report moderation action", { reportId: next.id, status: next.status }, "audit"); if (next.communityId) await auditLogService.append({ communityId: next.communityId, actionType: "moderation_action", targetType: "report", targetId: next.id, reason: `Report marked ${next.status}` }); return { ok: true, data: next };
  },

  getSummary(): Record<ReportStatus, number> { return reports.reduce<Record<ReportStatus, number>>((summary, report) => { summary[report.status] += 1; return summary; }, { open: 0, reviewed: 0, dismissed: 0, action_taken: 0 }); },
};
