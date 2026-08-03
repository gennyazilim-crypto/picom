import type { BadgeType, PublicBadge } from "../types/verificationBusiness/badges";
import type { Uuid } from "../types/verificationBusiness/shared";
import type { VerificationSubjectType } from "../types/verificationBusiness/verification";

export type BadgeFrameVariant = "minimal" | "premium" | "signature";

export type BadgeResolutionInput = Readonly<{
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  badges: readonly PublicBadge[];
  businessAffiliation?: Readonly<{ organizationId: Uuid; displayName: string }>;
}>;

export type PublicBadgeResolution = Readonly<{
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  primaryBadge: PublicBadge | null;
  secondaryBadges: readonly PublicBadge[];
  businessAffiliation: Readonly<{ organizationId: Uuid; displayName: string }> | null;
  verificationDisplayState: "verified" | "unverified";
  frameVariant: BadgeFrameVariant;
  accessibilityLabel: string;
}>;

const badgePriority: Record<BadgeType, number> = {
  verified: 0,
  publisher: 1,
  creator: 2,
  business: 3,
};

function compareBadges(left: PublicBadge, right: PublicBadge): number {
  if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
  const priorityDelta = badgePriority[left.badgeType] - badgePriority[right.badgeType];
  if (priorityDelta !== 0) return priorityDelta;
  return left.issuedAt.localeCompare(right.issuedAt);
}

function frameVariantFor(badges: readonly PublicBadge[]): BadgeFrameVariant {
  if (badges.some((badge) => badge.badgeType === "verified")) return "signature";
  if (badges.length > 1) return "premium";
  return "minimal";
}

function labelFor(badges: readonly PublicBadge[], affiliation: BadgeResolutionInput["businessAffiliation"] | null): string {
  const badgeLabel = badges.length === 0 ? "Unverified account" : badges.map((badge) => `${badge.badgeType} badge`).join(", ");
  return affiliation ? `${badgeLabel}; affiliated with ${affiliation.displayName}` : badgeLabel;
}

export function resolvePublicBadges(input: BadgeResolutionInput): PublicBadgeResolution {
  const matchingBadges = input.badges.filter((badge) => badge.subjectType === input.subjectType && badge.subjectId === input.subjectId && badge.status === "active").sort(compareBadges);
  const primaryBadge = matchingBadges[0] ?? null;
  const secondaryBadges = primaryBadge ? matchingBadges.slice(1) : [];
  const businessAffiliation = input.subjectType === "user" ? input.businessAffiliation ?? null : null;
  return {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    primaryBadge,
    secondaryBadges,
    businessAffiliation,
    verificationDisplayState: matchingBadges.some((badge) => badge.badgeType === "verified") ? "verified" : "unverified",
    frameVariant: frameVariantFor(matchingBadges),
    accessibilityLabel: labelFor(matchingBadges, businessAffiliation),
  };
}
