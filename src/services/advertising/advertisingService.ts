import { getSupabaseClient } from "../supabase/supabaseClient";
import type {
  AdvertiserAccount,
  AdvertiserType,
  AdDeliveryResolveResult,
  CampaignObjective,
} from "../../types/verificationBusiness/advertising";
import type { PlatformServiceError, PlatformServiceResult, Uuid } from "../../types/verificationBusiness/shared";

type QueryFailure = Readonly<{ code?: string; message?: string }>;
type QueryResponse = Readonly<{ data: unknown; error: QueryFailure | null }>;

interface PlatformClient {
  from(relation: string): {
    select(columns: string): PromiseLike<QueryResponse> & {
      order(column: string, options?: Readonly<{ ascending?: boolean }>): PromiseLike<QueryResponse>;
      eq(column: string, value: unknown): PromiseLike<QueryResponse>;
    };
  };
  rpc(functionName: string, parameters?: Record<string, unknown>): PromiseLike<QueryResponse>;
}

type Row = Record<string, unknown>;

function platformClient(): PlatformClient | null {
  return getSupabaseClient() as unknown as PlatformClient | null;
}

function unavailable<T>(): PlatformServiceResult<T> {
  return { ok: false, error: { code: "NOT_CONFIGURED", message: "Advertising services are unavailable until Supabase is configured." } };
}

function mapFailure(error: QueryFailure | null): PlatformServiceError {
  const message = error?.message ?? "";
  if (message.includes("LEGAL_COPY_REQUIRED")) return { code: "VALIDATION", message: "LEGAL_COPY_REQUIRED" };
  if (message.includes("POLITICAL_ADVERTISING_DISABLED")) return { code: "VALIDATION", message: "Political advertising is disabled." };
  if (message.includes("INSUFFICIENT_FUNDS")) return { code: "VALIDATION", message: "Insufficient advertiser funding." };
  if (message.includes("BUDGET_RESERVATION_REQUIRED")) return { code: "VALIDATION", message: "Budget reservation is required before activation." };
  if (error?.code === "42501") return { code: "FORBIDDEN", message: "You do not have permission to perform this action." };
  if (error?.code === "23505") return { code: "CONFLICT", message: "This record already exists or conflicts with the current state." };
  if (error?.code === "23514" || error?.code === "22023") return { code: "VALIDATION", message: "The supplied data does not meet advertising requirements." };
  return { code: "UNAVAILABLE", message: "Advertising request could not be completed." };
}

function asRows(data: unknown): readonly Row[] {
  return Array.isArray(data) ? data.filter((row): row is Row => typeof row === "object" && row !== null) : [];
}

function requiredString(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}

export const advertisingService = {
  async createAdvertiserAccount(input: Readonly<{
    ownerType: "user" | "organization";
    ownerId: Uuid;
    advertiserType: AdvertiserType;
    displayName: string;
    legalName?: string;
    countryCode?: string;
    billingCurrency?: string;
    purpose?: string;
    estimatedMonthlySpendMinor?: number;
    termsVersion?: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_advertiser_account_v2", {
      target_owner_type: input.ownerType,
      target_owner_id: input.ownerId,
      target_advertiser_type: input.advertiserType,
      target_display_name: input.displayName,
      target_legal_name: input.legalName ?? null,
      target_country_code: input.countryCode ?? null,
      target_billing_currency: input.billingCurrency ?? "USD",
      target_purpose: input.purpose ?? null,
      target_estimated_monthly_spend_minor: input.estimatedMonthlySpendMinor ?? null,
      target_terms_version: input.termsVersion ?? null,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async submitAdvertiserAccount(advertiserAccountId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("submit_advertiser_account", { target_account_id: advertiserAccountId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async listMine(): Promise<PlatformServiceResult<readonly AdvertiserAccount[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("advertiser_accounts").select(
      "id,owner_type,owner_id,advertiser_type,display_name,billing_status,verification_status,advertising_status,risk_status,created_at",
    ).order("created_at", { ascending: false });
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

  async createCampaign(input: Readonly<{
    advertiserAccountId: Uuid;
    name: string;
    objective: CampaignObjective;
    buyingType?: string;
    totalBudgetMinor?: number;
    dailyBudgetMinor?: number;
    startAt?: string;
    endAt?: string;
    timezone?: string;
    pacingMode?: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_ad_campaign", {
      target_advertiser_account_id: input.advertiserAccountId,
      target_name: input.name,
      target_objective: input.objective,
      target_buying_type: input.buyingType ?? "fixed_cpm",
      target_total_budget_minor: input.totalBudgetMinor ?? 0,
      target_daily_budget_minor: input.dailyBudgetMinor ?? null,
      target_start_at: input.startAt ?? null,
      target_end_at: input.endAt ?? null,
      target_timezone: input.timezone ?? "UTC",
      target_pacing_mode: input.pacingMode ?? "even",
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async createAdSet(input: Readonly<{
    campaignId: Uuid;
    name: string;
    placementKeys: readonly string[];
    targetingSpec?: Record<string, unknown>;
    exclusionSpec?: Record<string, unknown>;
    billingEvent?: string;
    bidAmountMinor?: number;
    dailyBudgetMinor?: number;
    lifetimeBudgetMinor?: number;
    frequencyCapCount?: number;
    frequencyCapWindowSeconds?: number;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_ad_set", {
      target_campaign_id: input.campaignId,
      target_name: input.name,
      target_placement_keys: input.placementKeys,
      target_targeting_spec: input.targetingSpec ?? {},
      target_exclusion_spec: input.exclusionSpec ?? {},
      target_billing_event: input.billingEvent ?? "impression",
      target_bid_amount_minor: input.bidAmountMinor ?? null,
      target_daily_budget_minor: input.dailyBudgetMinor ?? null,
      target_lifetime_budget_minor: input.lifetimeBudgetMinor ?? null,
      target_frequency_cap_count: input.frequencyCapCount ?? 3,
      target_frequency_cap_window_seconds: input.frequencyCapWindowSeconds ?? 86400,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async createCreative(input: Readonly<{
    advertiserAccountId: Uuid;
    campaignId: Uuid;
    adSetId: Uuid;
    creativeType: string;
    headline?: string;
    body?: string;
    cta?: string;
    destinationUrl?: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_ad_creative", {
      target_advertiser_account_id: input.advertiserAccountId,
      target_campaign_id: input.campaignId,
      target_ad_set_id: input.adSetId,
      target_creative_type: input.creativeType,
      target_headline: input.headline ?? null,
      target_body: input.body ?? null,
      target_cta: input.cta ?? null,
      target_destination_url: input.destinationUrl ?? null,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async createCreativeSnapshot(creativeId: Uuid): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_ad_creative_snapshot", { target_creative_id: creativeId });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async submitCampaign(campaignId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("submit_ad_campaign", { target_campaign_id: campaignId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async reserveBudget(campaignId: Uuid, fundingAccountId: Uuid, amountMinor: number, idempotencyKey: string): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("reserve_campaign_budget", {
      target_campaign_id: campaignId,
      target_funding_account_id: fundingAccountId,
      target_amount_minor: amountMinor,
      target_idempotency_key: idempotencyKey,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async activateCampaign(campaignId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("activate_ad_campaign", { target_campaign_id: campaignId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async pauseCampaign(campaignId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("pause_ad_campaign", { target_campaign_id: campaignId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async resolveDelivery(input: Readonly<{
    userId?: Uuid | null;
    anonymousSessionId?: string | null;
    placement: string;
    context?: Record<string, unknown>;
    requestId?: string;
  }>): Promise<PlatformServiceResult<AdDeliveryResolveResult>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("resolve_ad_delivery", {
      target_user_id: input.userId ?? null,
      anonymous_session_id: input.anonymousSessionId ?? null,
      target_placement: input.placement,
      target_context: input.context ?? {},
      target_request_id: input.requestId ?? null,
    });
    if (response.error || typeof response.data !== "object" || response.data === null) {
      return { ok: false, error: mapFailure(response.error) };
    }
    const row = response.data as Row;
    return {
      ok: true,
      data: {
        eligible: row.eligible === true,
        reason: typeof row.reason === "string" ? row.reason : "unknown",
        requestId: typeof row.request_id === "string" ? row.request_id : "",
        decisionId: typeof row.decision_id === "string" ? row.decision_id : undefined,
        expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined,
      },
    };
  },

  async hideDecision(decisionId: Uuid, action: string): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("hide_ad_decision", { target_decision_id: decisionId, target_action: action });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async reportDecision(decisionId: Uuid, reason: string): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("report_ad_decision", { target_decision_id: decisionId, target_reason: reason });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async getExplanation(decisionId: Uuid): Promise<PlatformServiceResult<Record<string, unknown>>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("get_ad_decision_explanation", { target_decision_id: decisionId });
    if (response.error || typeof response.data !== "object" || response.data === null) {
      return { ok: false, error: mapFailure(response.error) };
    }
    return { ok: true, data: response.data as Record<string, unknown> };
  },
};
