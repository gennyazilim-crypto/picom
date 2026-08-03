export type PublisherApplicationType = "creator" | "publisher";

export type PublisherEligibilityPath = "follower_threshold" | "community_founder_threshold";

export type PublisherApplicationEligibility = {
  eligible: boolean;
  eligibilityPaths: PublisherEligibilityPath[];
  activeFollowerCount: number;
  requiredFollowerCount: 5000;
  largestOwnedCommunityId: string | null;
  largestOwnedCommunityName: string | null;
  largestOwnedCommunityActiveMemberCount: number;
  requiredCommunityMemberCount: 3000;
  evaluatedAt: string;
  ruleVersion?: string;
  accountActive?: boolean;
  hasActiveLiveBan?: boolean;
};

export type PublisherCtaState =
  | "threshold_not_met"
  | "eligible_not_applied"
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_information_required"
  | "approved_active"
  | "suspended"
  | "rejected"
  | "revoked";

export type PublisherProgramState = {
  canBroadcast: boolean;
  profile: {
    accountKind: PublisherApplicationType;
    status: string;
    displayPublisherName: string;
  } | null;
  activeBadge: {
    id: string;
    badgeType: string;
    status: string;
    approvedAt: string | null;
    expiresAt: string | null;
  } | null;
  eligibility: PublisherApplicationEligibility;
  /** Server-derived Live Now / publisher header CTA state. */
  ctaState?: PublisherCtaState;
  latestApplication?: {
    id: string;
    applicationType: PublisherApplicationType;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    decisionReason: string | null;
  } | null;
};

export type PublisherApplicationSummary = {
  id: string;
  applicationType: PublisherApplicationType;
  status: string;
  displayPublisherName: string;
  eligibilityPaths: PublisherEligibilityPath[];
  followerCountAtApplication: number;
  communityMemberCountAtApplication: number;
  decisionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type PublisherReviewQueueItem = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  applicationType: PublisherApplicationType;
  status: string;
  displayPublisherName: string;
  eligibilityPaths: PublisherEligibilityPath[];
  followerCountAtApplication: number;
  currentFollowerCount: number;
  communityMemberCountAtApplication: number;
  currentCommunityMemberCount: number;
  qualifiedCommunityId: string | null;
  qualifiedCommunityName: string | null;
  isStillCommunityOwner: boolean;
  eligibilityRiskStatus: string;
  decisionReason: string | null;
  internalNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  shortBio: string;
  companyName: string | null;
};

export type SubmitPublisherApplicationInput = {
  applicationType: PublisherApplicationType;
  displayPublisherName: string;
  legalName?: string;
  countryCode?: string;
  legalAddress?: string;
  categories?: string[];
  shortBio: string;
  experienceText?: string;
  streamTypes?: string[];
  socialLinks?: string[];
  portfolioLinks?: string[];
  companyName?: string | null;
  tradeName?: string | null;
  companyRegistrationNumber?: string | null;
  taxNumber?: string | null;
  companyCountryCode?: string | null;
  companyAddress?: string | null;
  authorizedPersonName?: string | null;
  authorizedPersonTitle?: string | null;
  corporateEmail?: string | null;
  websiteUrl?: string | null;
};

export type CanStartPicomLiveStream = {
  allowed: boolean;
  accountActive: boolean;
  hasActiveBadge: boolean;
  hasLiveBan: boolean;
  hasApprovedApplication: boolean;
  profileActive: boolean;
};
