import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "../services/dataSourceService";
import type { VerificationBadge, VerificationBadgeKind } from "../types/verification";

export type VerificationBadgeVariant = "verified_user" | "official_community" | "picom_staff" | "verified_bot";

const mockUserVerifications = new Map<string, VerificationBadgeVariant>([
  [currentUserId, "picom_staff"],
  ["u-naines", "verified_user"],
  ["u-krishna", "verified_user"],
  ["u-picom-assistant", "verified_bot"],
]);

const mockCommunityVerifications = new Map<string, VerificationBadgeVariant>([
  ["aurora", "official_community"],
]);

const priority: readonly VerificationBadgeVariant[] = ["picom_staff", "official_community", "verified_bot", "verified_user"];

export function verificationVariantFromKind(kind: VerificationBadgeKind): VerificationBadgeVariant | null {
  if (kind === "picom_staff") return "picom_staff";
  if (kind === "official_community" || kind === "community_official") return "official_community";
  if (kind === "verified_bot") return "verified_bot";
  if (kind === "verified_user" || kind === "profile_reviewed" || kind === "creator_verified") return "verified_user";
  return null;
}

export function verificationVariantFromBadges(badges: readonly VerificationBadge[] = []): VerificationBadgeVariant | null {
  const variants = badges.filter((badge) => !badge.revokedAt).map((badge) => verificationVariantFromKind(badge.kind)).filter((variant): variant is VerificationBadgeVariant => Boolean(variant));
  return priority.find((variant) => variants.includes(variant)) ?? null;
}

export function getUserVerificationVariant(userId: string, badges: readonly VerificationBadge[] = []): VerificationBadgeVariant | null {
  const persisted = verificationVariantFromBadges(badges);
  if (persisted) return persisted;
  return dataSourceService.getStatus().isMock ? mockUserVerifications.get(userId) ?? null : null;
}

export function getCommunityVerificationVariant(communityId: string, badges: readonly VerificationBadge[] = []): VerificationBadgeVariant | null {
  const persisted = verificationVariantFromBadges(badges);
  if (persisted === "official_community") return persisted;
  return dataSourceService.getStatus().isMock ? mockCommunityVerifications.get(communityId) ?? null : null;
}

export function isVerifiedSubject(variant: VerificationBadgeVariant | null | undefined): variant is VerificationBadgeVariant {
  return Boolean(variant);
}
