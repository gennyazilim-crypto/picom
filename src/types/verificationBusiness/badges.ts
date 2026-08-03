import type { IsoTimestamp, Uuid } from "./shared";
import type { VerificationSubjectType } from "./verification";

export type BadgeType = "verified" | "creator" | "publisher" | "business";
export type BadgeStatus = "pending" | "active" | "suspended" | "revoked" | "expired";

export type PublicBadge = Readonly<{
  id: Uuid;
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  badgeType: BadgeType;
  status: "active";
  issuedAt: IsoTimestamp;
  expiresAt: IsoTimestamp | null;
  publicReasonCode: string | null;
  isPrimary: boolean;
}>;

export type BadgeAdminView = PublicBadge & Readonly<{
  status: BadgeStatus;
  sourceType: string | null;
  sourceId: Uuid | null;
  suspendedAt: IsoTimestamp | null;
  revokedAt: IsoTimestamp | null;
  internalReasonCode: string | null;
  metadata: Record<string, unknown>;
}>;
