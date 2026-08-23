export const BUSINESS_APPLICATION_STATUSES = [
  "draft", "submitted", "under_review", "requires_information",
  "identity_verification_required", "approved", "rejected", "suspended", "revoked", "expired",
] as const;
export type BusinessApplicationStatus = (typeof BUSINESS_APPLICATION_STATUSES)[number];

export const BUSINESS_COMPANY_TYPES = [
  "sole_trader", "partnership", "limited_company", "corporation",
  "nonprofit", "public_institution", "agency", "other",
] as const;
export type BusinessCompanyType = (typeof BUSINESS_COMPANY_TYPES)[number];
export type BusinessDocumentMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export type BusinessApplicationDraftInput = Readonly<{
  organizationId: string; legalName: string; brandName: string; companyType: BusinessCompanyType;
  registeredCountry: string; registeredAddress: string; representativeName: string;
  representativeJobTitle?: string; representativeEmail?: string; representativePhone?: string;
  companyDescription?: string; advertisingPurpose?: string; partnershipPurpose?: string;
  productsOrServicesSummary?: string; industry?: string; industryCode?: string;
  officialWebsite?: string; corporateEmailDomain?: string; idempotencyKey?: string;
}>;

export type BusinessApplicationApplicantDto = Readonly<{
  id: string; organizationId: string; legalName: string; brandName: string; companyType: BusinessCompanyType;
  registeredCountry: string; officialWebsite: string | null; corporateEmailDomain: string | null;
  representativeName: string; representativeJobTitle: string | null; industry: string | null;
  industryCode: string | null; status: BusinessApplicationStatus; submissionVersion: number;
  publicDecisionReason: string | null; submittedAt: string | null; reviewedAt: string | null;
}>;

/** Admin DTO is intentionally opaque because the server is its sole privacy boundary. */
export type BusinessApplicationAdminDto = Readonly<Record<string, unknown>>;
export type BusinessDocument = Readonly<{
  id: string; applicationId: string; organizationId: string; documentType: string; fileName: string;
  mimeType: BusinessDocumentMimeType; storagePath: string; malwareScanStatus: string; reviewStatus: string;
}>;
export type BusinessInvitation = Readonly<{
  id: string; organizationId: string; invitedEmail: string; invitedRole: string; expiresAt: string; status: string;
}>;
export type PublicBusinessProfileBundle = Readonly<{
  profile: Record<string, unknown>; products: readonly Record<string, unknown>[]; posts: readonly Record<string, unknown>[];
}>;
