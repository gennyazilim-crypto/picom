import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "../services/dataSourceService";
import type { VerificationBadge, VerificationBadgeKind, VerificationSummary, VerificationType } from "../types/verification";

export type VerificationBadgeVariant = VerificationType;

const approved = (type: VerificationType): VerificationSummary => ({ status: "approved", type, approvedAt: "2026-07-01T00:00:00.000Z" });

export const mockVerificationFixtures = Object.freeze({
  approvedUser: approved("verified_user"),
  staff: approved("picom_staff"),
  officialCommunity: approved("official_community"),
  verifiedBot: approved("verified_bot"),
  pending: { status: "pending", type: "verified_user" } satisfies VerificationSummary,
  rejected: { status: "rejected", type: "verified_user" } satisfies VerificationSummary,
  revoked: { status: "revoked", type: "verified_user" } satisfies VerificationSummary,
});

const mockUserVerifications = new Map<string, VerificationSummary>([
  [currentUserId, mockVerificationFixtures.staff],
  ["u-naines", mockVerificationFixtures.approvedUser],
  ["u-krishna", mockVerificationFixtures.approvedUser],
  ["u-picom-assistant", mockVerificationFixtures.verifiedBot],
  ["u-verification-pending", mockVerificationFixtures.pending],
  ["u-verification-rejected", mockVerificationFixtures.rejected],
  ["u-verification-revoked", mockVerificationFixtures.revoked],
]);

const mockCommunityVerifications = new Map<string, VerificationSummary>([
  ["aurora", mockVerificationFixtures.officialCommunity],
]);
const runtimeVerifications = new Map<string, VerificationSummary>();
const runtimeKey = (targetType: "profile" | "community", targetId: string) => `${targetType}:${targetId}`;

export function registerRuntimeVerification(targetType: "profile" | "community", targetId: string, verification: VerificationSummary | VerificationType | null): void {
  runtimeVerifications.set(runtimeKey(targetType, targetId), typeof verification === "string" ? approved(verification) : verification ?? { status: "revoked" });
}

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

export function isApprovedVerification(verification: VerificationSummary | null | undefined): verification is VerificationSummary & { status: "approved"; type: VerificationType } {
  return verification?.status === "approved" && Boolean(verification.type);
}

export function getVerificationType(verification: VerificationSummary | null | undefined): VerificationType | null {
  return isApprovedVerification(verification) ? verification.type : null;
}

export function getVerificationLabel(type: VerificationType): string {
  if (type === "official_community") return "Official community";
  if (type === "picom_staff") return "Picom staff";
  if (type === "verified_bot") return "Verified bot";
  return "Verified user";
}

export function getVerificationIcon(_type: VerificationType): "check" {
  return "check";
}

export function isVerifiedUser(profile: { verification?: VerificationSummary } | null | undefined): boolean {
  const type = getVerificationType(profile?.verification);
  return type === "verified_user" || type === "picom_staff" || type === "verified_bot";
}

export function verificationSummaryFromBadges(badges: readonly VerificationBadge[] = []): VerificationSummary | null {
  const type = verificationVariantFromBadges(badges);
  if (!type) return null;
  const approvedAt = badges.find((badge) => !badge.revokedAt && verificationVariantFromKind(badge.kind) === type)?.grantedAt;
  return { status: "approved", type, approvedAt };
}

export function getUserVerificationSummary(userId: string, badges: readonly VerificationBadge[] = [], entityVerification?: VerificationSummary): VerificationSummary {
  const key = runtimeKey("profile", userId);
  if (runtimeVerifications.has(key)) return runtimeVerifications.get(key) ?? { status: "none" };
  if (entityVerification) return entityVerification;
  const persisted = verificationSummaryFromBadges(badges);
  if (persisted) return persisted;
  return dataSourceService.getStatus().isMock ? mockUserVerifications.get(userId) ?? { status: "none" } : { status: "none" };
}

export function getCommunityVerificationSummary(communityId: string, badges: readonly VerificationBadge[] = [], entityVerification?: VerificationSummary): VerificationSummary {
  const key = runtimeKey("community", communityId);
  if (runtimeVerifications.has(key)) return runtimeVerifications.get(key) ?? { status: "none" };
  if (entityVerification) return entityVerification;
  const persisted = verificationSummaryFromBadges(badges);
  if (getVerificationType(persisted) === "official_community") return persisted ?? { status: "none" };
  return dataSourceService.getStatus().isMock ? mockCommunityVerifications.get(communityId) ?? { status: "none" } : { status: "none" };
}

export function getUserVerificationVariant(userId: string, badges: readonly VerificationBadge[] = [], entityVerification?: VerificationSummary): VerificationBadgeVariant | null {
  return getVerificationType(getUserVerificationSummary(userId, badges, entityVerification));
}

export function getCommunityVerificationVariant(communityId: string, badges: readonly VerificationBadge[] = [], entityVerification?: VerificationSummary): VerificationBadgeVariant | null {
  return getVerificationType(getCommunityVerificationSummary(communityId, badges, entityVerification));
}

export function isVerifiedSubject(verification: VerificationSummary | null | undefined): boolean {
  return isApprovedVerification(verification);
}
