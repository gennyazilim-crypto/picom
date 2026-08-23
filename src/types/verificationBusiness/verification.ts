import type { IsoTimestamp, Uuid } from "./shared";

export type VerificationSubjectType = "user" | "organization";
export type VerificationStatus = "draft" | "pending" | "requires_input" | "under_review" | "verified" | "rejected" | "expired" | "cancelled";

export type VerificationCaseSubmission = Readonly<{
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  verificationType: string;
  metadata: Record<string, unknown>;
}>;

export type VerificationCaseOwnerView = Readonly<{
  id: Uuid;
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  verificationType: string;
  status: VerificationStatus;
  submittedAt: IsoTimestamp | null;
  reviewedAt: IsoTimestamp | null;
  expiresAt: IsoTimestamp | null;
  publicReasonCode: string | null;
}>;

export type VerificationCaseAdminView = VerificationCaseOwnerView & Readonly<{
  provider: string | null;
  providerReference: string | null;
  internalReasonCode: string | null;
  metadata: Record<string, unknown>;
}>;
