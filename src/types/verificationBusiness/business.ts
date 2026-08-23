import type { IsoTimestamp, Uuid } from "./shared";

export type BusinessApplicationStatus = "draft" | "submitted" | "under_review" | "requires_information" | "identity_verification_required" | "approved" | "rejected" | "suspended" | "revoked" | "expired";
export type BrandAssetType = "primary_logo" | "square_logo" | "light_logo" | "dark_logo" | "monochrome_logo" | "profile_cover" | "brand_guideline";
export type BusinessProductType = "physical_product" | "digital_product" | "service" | "subscription" | "event" | "software" | "game" | "application" | "membership" | "other";
export type BusinessProductStatus = "draft" | "in_review" | "published" | "unlisted" | "out_of_stock" | "archived" | "rejected" | "suspended";
export type BusinessPostType = "brand_update" | "product_announcement" | "product_launch" | "offer" | "discount" | "event" | "case_study" | "video" | "poll" | "job_posting" | "service_announcement" | "sponsored_content";

export type PublicBusinessProfile = Readonly<{
  organizationId: Uuid;
  slug: string;
  displayName: string;
  bio: string;
  description: string;
  websiteUrl: string | null;
  supportUrl: string | null;
  publicContactEmail: string | null;
  industry: string | null;
  foundedYear: number | null;
  headquartersCountry: string | null;
  profileLogoAssetId: Uuid | null;
  coverAssetId: Uuid | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  publishedAt: IsoTimestamp | null;
}>;

export type BusinessProfileAdminView = PublicBusinessProfile & Readonly<{
  legalName: string | null;
  publicStatus: "draft" | "published" | "suspended" | "archived";
}>;

export type BusinessProfileDraftInput = Readonly<{
  organizationId: Uuid;
  slug: string;
  displayName: string;
  bio?: string;
  description?: string;
  websiteUrl?: string | null;
  supportUrl?: string | null;
  publicContactEmail?: string | null;
  industry?: string | null;
  foundedYear?: number | null;
  headquartersCountry?: string | null;
  profileLogoAssetId?: Uuid | null;
  coverAssetId?: Uuid | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}>;

export type PublicProduct = Readonly<{
  id: Uuid;
  organizationId: Uuid;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  productType: BusinessProductType;
  sku: string | null;
  priceAmountMinor: number | null;
  compareAtPriceAmountMinor: number | null;
  currency: string;
  availability: "available" | "preorder" | "out_of_stock" | "discontinued";
  purchaseUrl: string | null;
  productUrl: string | null;
  supportUrl: string | null;
  publishedAt: IsoTimestamp | null;
}>;

export type BusinessProductEditorView = PublicProduct & Readonly<{
  status: BusinessProductStatus;
  moderationStatus: "pending" | "approved" | "rejected" | "not_required";
  createdBy: Uuid;
}>;

export type BusinessProductDraftInput = Readonly<{
  organizationId: Uuid;
  name: string;
  slug: string;
  productType: BusinessProductType;
  shortDescription?: string;
  description?: string;
  priceAmountMinor?: number | null;
  compareAtPriceAmountMinor?: number | null;
  currency?: string;
  availability?: PublicProduct["availability"];
  purchaseUrl?: string | null;
  productUrl?: string | null;
  supportUrl?: string | null;
}>;
