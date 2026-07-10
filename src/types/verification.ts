export type VerificationSubjectType = "user" | "community" | "role";
export type VerificationBadgeKind = "profile_reviewed" | "community_official" | "role_managed";
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
