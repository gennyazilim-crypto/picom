export type ReportTargetType = "message" | "direct_message" | "user" | "community" | "radio_session" | "podcast_episode" | "podcast_comment";
export type ReportStatus = "open" | "reviewed" | "dismissed" | "action_taken";
export type ReportReason = "spam" | "harassment" | "unsafe_content" | "impersonation" | "copyright" | "other";

export type ReportRecord = Readonly<{
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string;
  evidenceExcerpt?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedById?: string;
  reviewedAt?: string;
}>;

export type CreateReportInput = Readonly<{
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
  evidenceExcerpt?: string;
}>; 

export type UpdateReportStatusInput = Readonly<{
  reportId: string;
  status: ReportStatus;
  canReview: boolean;
  reviewedById?: string;
}>;
