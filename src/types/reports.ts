export type ReportTargetType = "message" | "user" | "community";
export type ReportStatus = "open" | "reviewed" | "dismissed" | "action_taken";
export type ReportReason = "spam" | "harassment" | "unsafe_content" | "impersonation" | "other";

export type ReportRecord = Readonly<{
  id: string;
  communityId?: string;
  channelId?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedById?: string;
}>;

export type CreateReportInput = Readonly<{
  communityId?: string;
  channelId?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}>;

export type UpdateReportStatusInput = Readonly<{
  reportId: string;
  status: ReportStatus;
  reviewedById?: string;
}>;
