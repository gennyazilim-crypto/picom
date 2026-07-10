export type VerificationSubjectType = "user" | "community" | "role";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected" | "revoked";
export type VerificationType = "verified_user" | "official_community" | "picom_staff" | "verified_bot";
export type VerificationSummary = Readonly<{
  status: VerificationStatus;
  type?: VerificationType;
  approvedAt?: string;
}>;
export type VerificationBadgeKind = "profile_reviewed" | "community_official" | "role_managed" | VerificationType | "creator_verified";
export type VerificationBadge = Readonly<{
  id: string;
  subjectType: VerificationSubjectType;
  subjectId: string;
  kind: VerificationBadgeKind;
  label: string;
  scopeNote: string;
  grantedAt: string;
  revokedAt?: string | null;
}>;
