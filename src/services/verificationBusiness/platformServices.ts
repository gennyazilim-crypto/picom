import { getSupabaseClient } from "../supabase/supabaseClient";
import type { AdvertiserAccount, AdvertiserType } from "../../types/verificationBusiness/advertising";
import type { PublicBadge } from "../../types/verificationBusiness/badges";
import type { BusinessProductDraftInput, BusinessProfileDraftInput, PublicBusinessProfile, PublicProduct } from "../../types/verificationBusiness/business";
import type { AccountEntitlement } from "../../types/verificationBusiness/entitlements";
import type { MonetizationAccount } from "../../types/verificationBusiness/monetization";
import type { Organization } from "../../types/verificationBusiness/organizations";
import type { PlatformServiceError, PlatformServiceResult, Uuid } from "../../types/verificationBusiness/shared";
import type { VerificationCaseSubmission, VerificationCaseOwnerView } from "../../types/verificationBusiness/verification";

type QueryFailure = Readonly<{ code?: string; message?: string }>;
type QueryResponse = Readonly<{ data: unknown; error: QueryFailure | null }>;

interface PlatformQuery extends PromiseLike<QueryResponse> {
  select(columns: string): PlatformQuery;
  eq(column: string, value: unknown): PlatformQuery;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): PlatformQuery;
  limit(count: number): PlatformQuery;
  insert(values: unknown): PlatformQuery;
  single(): PlatformQuery;
}

interface PlatformClient {
  from(relation: string): PlatformQuery;
  rpc(functionName: string, parameters?: Record<string, unknown>): PromiseLike<QueryResponse>;
}

type Row = Record<string, unknown>;

function platformClient(): PlatformClient | null {
  return getSupabaseClient() as unknown as PlatformClient | null;
}

function unavailable<T>(): PlatformServiceResult<T> {
  return { ok: false, error: { code: "NOT_CONFIGURED", message: "This Picom service is unavailable until Supabase is configured." } };
}

function mapFailure(error: QueryFailure | null): PlatformServiceError {
  if (error?.code === "42501") return { code: "FORBIDDEN", message: "You do not have permission to perform this action." };
  if (error?.code === "23505") return { code: "CONFLICT", message: "This record already exists or conflicts with the current state." };
  if (error?.code === "23514" || error?.code === "22023") return { code: "VALIDATION", message: "The supplied data does not meet the platform requirements." };
  if (error?.code === "PGRST116" || error?.code === "P0002") return { code: "NOT_FOUND", message: "The requested record was not found." };
  return { code: "UNAVAILABLE", message: "Picom could not complete this request right now." };
}

function asRows(data: unknown): readonly Row[] {
  return Array.isArray(data) ? data.filter((row): row is Row => typeof row === "object" && row !== null) : [];
}

function asRow(data: unknown): Row | null {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data as Row : null;
}

function stringValue(row: Row, key: string): string | null {
  return typeof row[key] === "string" ? row[key] as string : null;
}

function requiredString(row: Row, key: string): string {
  return stringValue(row, key) ?? "";
}

function numberValue(row: Row, key: string): number | null {
  return typeof row[key] === "number" ? row[key] as number : null;
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function mapBadge(row: Row): PublicBadge {
  return {
    id: requiredString(row, "id"),
    subjectType: requiredString(row, "subject_type") as PublicBadge["subjectType"],
    subjectId: requiredString(row, "subject_id"),
    badgeType: requiredString(row, "badge_type") as PublicBadge["badgeType"],
    status: "active",
    issuedAt: requiredString(row, "issued_at"),
    expiresAt: stringValue(row, "expires_at"),
    publicReasonCode: stringValue(row, "public_reason_code"),
    isPrimary: booleanValue(row, "is_primary"),
  };
}

function mapProfile(row: Row): PublicBusinessProfile {
  return {
    organizationId: requiredString(row, "organization_id"),
    slug: requiredString(row, "slug"),
    displayName: requiredString(row, "display_name"),
    bio: requiredString(row, "bio"),
    description: requiredString(row, "description"),
    websiteUrl: stringValue(row, "website_url"),
    supportUrl: stringValue(row, "support_url"),
    publicContactEmail: stringValue(row, "public_contact_email"),
    industry: stringValue(row, "industry"),
    foundedYear: numberValue(row, "founded_year"),
    headquartersCountry: stringValue(row, "headquarters_country"),
    profileLogoAssetId: stringValue(row, "profile_logo_asset_id"),
    coverAssetId: stringValue(row, "cover_asset_id"),
    primaryColor: stringValue(row, "primary_color"),
    secondaryColor: stringValue(row, "secondary_color"),
    publishedAt: stringValue(row, "published_at"),
  };
}

function mapProduct(row: Row): PublicProduct {
  return {
    id: requiredString(row, "id"),
    organizationId: requiredString(row, "organization_id"),
    name: requiredString(row, "name"),
    slug: requiredString(row, "slug"),
    shortDescription: requiredString(row, "short_description"),
    description: requiredString(row, "description"),
    productType: requiredString(row, "product_type") as PublicProduct["productType"],
    sku: stringValue(row, "sku"),
    priceAmountMinor: numberValue(row, "price_amount_minor"),
    compareAtPriceAmountMinor: numberValue(row, "compare_at_price_amount_minor"),
    currency: requiredString(row, "currency"),
    availability: requiredString(row, "availability") as PublicProduct["availability"],
    purchaseUrl: stringValue(row, "purchase_url"),
    productUrl: stringValue(row, "product_url"),
    supportUrl: stringValue(row, "support_url"),
    publishedAt: stringValue(row, "published_at"),
  };
}

export const verificationService = {
  async submit(input: VerificationCaseSubmission): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("submit_verification_case", {
      target_subject_type: input.subjectType,
      target_subject_id: input.subjectId,
      target_verification_type: input.verificationType,
      target_metadata: input.metadata,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async listMine(): Promise<PlatformServiceResult<readonly VerificationCaseOwnerView[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("verification_cases").select("id,subject_type,subject_id,verification_type,status,submitted_at,reviewed_at,expires_at,public_reason_code").order("created_at", { ascending: false });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return {
      ok: true,
      data: asRows(response.data).map((row) => ({
        id: requiredString(row, "id"),
        subjectType: requiredString(row, "subject_type") as VerificationCaseOwnerView["subjectType"],
        subjectId: requiredString(row, "subject_id"),
        verificationType: requiredString(row, "verification_type"),
        status: requiredString(row, "status") as VerificationCaseOwnerView["status"],
        submittedAt: stringValue(row, "submitted_at"),
        reviewedAt: stringValue(row, "reviewed_at"),
        expiresAt: stringValue(row, "expires_at"),
        publicReasonCode: stringValue(row, "public_reason_code"),
      })),
    };
  },
};

export const badgeService = {
  async listPublic(subjectType: "user" | "organization", subjectId: Uuid): Promise<PlatformServiceResult<readonly PublicBadge[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("public_profile_badges").select("id,subject_type,subject_id,badge_type,status,issued_at,expires_at,public_reason_code,is_primary").eq("subject_type", subjectType).eq("subject_id", subjectId).order("issued_at", { ascending: true });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRows(response.data).map(mapBadge) };
  },
};

export const entitlementService = {
  async listMine(): Promise<PlatformServiceResult<readonly AccountEntitlement[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("account_entitlements").select("id,subject_type,subject_id,entitlement_key,status,starts_at,ends_at,grace_until,version").order("created_at", { ascending: false });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return {
      ok: true,
      data: asRows(response.data).map((row) => ({
        id: requiredString(row, "id"),
        subjectType: requiredString(row, "subject_type") as AccountEntitlement["subjectType"],
        subjectId: requiredString(row, "subject_id"),
        entitlementKey: requiredString(row, "entitlement_key") as AccountEntitlement["entitlementKey"],
        status: requiredString(row, "status") as AccountEntitlement["status"],
        startsAt: stringValue(row, "starts_at"),
        endsAt: stringValue(row, "ends_at"),
        graceUntil: stringValue(row, "grace_until"),
        version: numberValue(row, "version") ?? 1,
      })),
    };
  },
};

export const organizationService = {
  async create(displayName: string, legalName?: string): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_organization", { target_display_name: displayName, target_legal_name: legalName ?? null });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async listMine(): Promise<PlatformServiceResult<readonly Organization[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("organizations").select("id,display_name,status,created_at").order("created_at", { ascending: false });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRows(response.data).map((row) => ({ id: requiredString(row, "id"), displayName: requiredString(row, "display_name"), status: requiredString(row, "status") as Organization["status"], createdAt: requiredString(row, "created_at") })) };
  },
};

export const businessProfileService = {
  async getPublic(slug: string): Promise<PlatformServiceResult<PublicBusinessProfile>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("public_business_profiles").select("organization_id,slug,display_name,bio,description,website_url,support_url,public_contact_email,industry,founded_year,headquarters_country,profile_logo_asset_id,cover_asset_id,primary_color,secondary_color,published_at").eq("slug", slug).single();
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    const row = asRow(response.data);
    return row ? { ok: true, data: mapProfile(row) } : { ok: false, error: { code: "NOT_FOUND", message: "The public business profile was not found." } };
  },

  async saveDraft(input: BusinessProfileDraftInput): Promise<PlatformServiceResult<null>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("upsert_business_profile", {
      target_organization_id: input.organizationId,
      target_slug: input.slug,
      target_display_name: input.displayName,
      target_bio: input.bio ?? "",
      target_description: input.description ?? "",
      target_website_url: input.websiteUrl ?? null,
      target_support_url: input.supportUrl ?? null,
      target_public_contact_email: input.publicContactEmail ?? null,
      target_industry: input.industry ?? null,
      target_founded_year: input.foundedYear ?? null,
      target_headquarters_country: input.headquartersCountry ?? null,
      target_profile_logo_asset_id: input.profileLogoAssetId ?? null,
      target_cover_asset_id: input.coverAssetId ?? null,
      target_primary_color: input.primaryColor ?? null,
      target_secondary_color: input.secondaryColor ?? null,
    });
    return response.error ? { ok: false, error: mapFailure(response.error) } : { ok: true, data: null };
  },
};

export const businessProductService = {
  async listPublic(organizationId: Uuid): Promise<PlatformServiceResult<readonly PublicProduct[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("public_business_products").select("id,organization_id,name,slug,short_description,description,product_type,sku,price_amount_minor,compare_at_price_amount_minor,currency,availability,purchase_url,product_url,support_url,published_at").eq("organization_id", organizationId).order("published_at", { ascending: false }).limit(100);
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRows(response.data).map(mapProduct) };
  },

  async createDraft(input: BusinessProductDraftInput): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_business_product", {
      target_organization_id: input.organizationId,
      target_name: input.name,
      target_slug: input.slug,
      target_product_type: input.productType,
      target_short_description: input.shortDescription ?? "",
      target_description: input.description ?? "",
      target_price_amount_minor: input.priceAmountMinor ?? null,
      target_compare_at_price_amount_minor: input.compareAtPriceAmountMinor ?? null,
      target_currency: input.currency ?? "USD",
      target_availability: input.availability ?? "available",
      target_purchase_url: input.purchaseUrl ?? null,
      target_product_url: input.productUrl ?? null,
      target_support_url: input.supportUrl ?? null,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },
};

export const advertiserAccountService = {
  async create(ownerType: "user" | "organization", ownerId: Uuid, advertiserType: AdvertiserType, displayName: string): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_advertiser_account", { target_owner_type: ownerType, target_owner_id: ownerId, target_advertiser_type: advertiserType, target_display_name: displayName });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async listMine(): Promise<PlatformServiceResult<readonly AdvertiserAccount[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("advertiser_accounts").select("id,owner_type,owner_id,advertiser_type,display_name,billing_status,verification_status,advertising_status,risk_status,created_at").order("created_at", { ascending: false });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return {
      ok: true,
      data: asRows(response.data).map((row) => ({
        id: requiredString(row, "id"),
        ownerType: requiredString(row, "owner_type") as AdvertiserAccount["ownerType"],
        ownerId: requiredString(row, "owner_id"),
        advertiserType: requiredString(row, "advertiser_type") as AdvertiserType,
        displayName: requiredString(row, "display_name"),
        billingStatus: requiredString(row, "billing_status") as AdvertiserAccount["billingStatus"],
        verificationStatus: requiredString(row, "verification_status") as AdvertiserAccount["verificationStatus"],
        advertisingStatus: requiredString(row, "advertising_status") as AdvertiserAccount["advertisingStatus"],
        riskStatus: requiredString(row, "risk_status") as AdvertiserAccount["riskStatus"],
        createdAt: requiredString(row, "created_at"),
      })),
    };
  },
};

export const monetizationService = {
  async listMine(): Promise<PlatformServiceResult<readonly MonetizationAccount[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("monetization_accounts").select("id,subject_id,program_type,badge_status,monetization_status,payout_onboarding_status,compliance_status,contract_id,activated_at,suspended_at").order("created_at", { ascending: false });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return {
      ok: true,
      data: asRows(response.data).map((row) => ({
        id: requiredString(row, "id"),
        subjectId: requiredString(row, "subject_id"),
        programType: requiredString(row, "program_type") as MonetizationAccount["programType"],
        badgeStatus: requiredString(row, "badge_status") as MonetizationAccount["badgeStatus"],
        monetizationStatus: requiredString(row, "monetization_status") as MonetizationAccount["monetizationStatus"],
        payoutOnboardingStatus: requiredString(row, "payout_onboarding_status") as MonetizationAccount["payoutOnboardingStatus"],
        complianceStatus: requiredString(row, "compliance_status") as MonetizationAccount["complianceStatus"],
        contractId: stringValue(row, "contract_id"),
        activatedAt: stringValue(row, "activated_at"),
        suspendedAt: stringValue(row, "suspended_at"),
      })),
    };
  },
};
