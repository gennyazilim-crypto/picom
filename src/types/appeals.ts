export type AppealStatus = "open" | "under_review" | "accepted" | "denied" | "closed";

export type ModerationAppeal = Readonly<{
  id: string;
  communityId: string;
  affectedUserId: string;
  moderationActionId: string;
  reason: string;
  status: AppealStatus;
  decisionNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type SubmitAppealInput = Readonly<{
  communityId: string;
  affectedUserId: string;
  currentUserId: string;
  moderationActionId: string;
  reason: string;
}>;

export type ReviewAppealInput = Readonly<{
  appealId: string;
  status: Exclude<AppealStatus, "open">;
  decisionNote?: string;
  reviewerId?: string;
  canReview: boolean;
}>;
