export type VerificationSubjectType = "user" | "community" | "role";
export type VerificationBadgeKind = "profile_reviewed" | "community_official" | "role_managed" | "verified_user" | "official_community" | "picom_staff" | "verified_bot" | "creator_verified";
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
