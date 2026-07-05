import type { CreateReportInput, ReportRecord, ReportStatus, UpdateReportStatusInput } from "../types/reports";
import { loggingService } from "./loggingService";

type ReportResult<T> = Readonly<
  | { ok: true; data: T }
  | { ok: false; message: string }
>;

const reports: ReportRecord[] = [];
let reportCounter = 0;

function createReportId(): string {
  reportCounter += 1;
  return `local-report-${Date.now()}-${reportCounter}`;
}

function sanitizeDescription(value: string | undefined): string {
  const description = value?.trim() || "Report submitted from local MVP placeholder.";
  return description.slice(0, 500);
}

function cloneReports(): ReportRecord[] {
  return reports.map((report) => ({ ...report }));
}

export const reportService = {
  submitReport(input: CreateReportInput): ReportResult<ReportRecord> {
    if (!input.reporterId || !input.targetId) {
      return { ok: false, message: "Report could not be created locally." };
    }

    const now = new Date().toISOString();
    const report: ReportRecord = {
      id: createReportId(),
      communityId: input.communityId,
      channelId: input.channelId,
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      description: sanitizeDescription(input.description),
      status: "open",
      createdAt: now,
      updatedAt: now
    };

    reports.unshift(report);
    loggingService.logInfo("Local report placeholder created", {
      reportId: report.id,
      targetType: report.targetType,
      status: report.status,
      communityId: report.communityId,
      channelId: report.channelId
    }, "reports");

    return { ok: true, data: report };
  },

  listReports(): ReportRecord[] {
    return cloneReports();
  },

  updateReportStatus(input: UpdateReportStatusInput): ReportResult<ReportRecord> {
    const index = reports.findIndex((report) => report.id === input.reportId);
    if (index === -1) {
      return { ok: false, message: "Report was not found in the local placeholder queue." };
    }

    const current = reports[index];
    const next: ReportRecord = {
      ...current,
      status: input.status,
      reviewedById: input.reviewedById,
      updatedAt: new Date().toISOString()
    };

    reports[index] = next;
    loggingService.logInfo("Local report placeholder status updated", {
      reportId: next.id,
      status: next.status,
      targetType: next.targetType
    }, "reports");

    return { ok: true, data: next };
  },

  getSummary(): Record<ReportStatus, number> {
    return reports.reduce<Record<ReportStatus, number>>((summary, report) => {
      summary[report.status] += 1;
      return summary;
    }, {
      open: 0,
      reviewed: 0,
      dismissed: 0,
      action_taken: 0
    });
  }
};
