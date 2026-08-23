import { getSupabaseClient } from "../supabase/supabaseClient";
import type { PlatformServiceError, PlatformServiceResult, Uuid } from "../../types/verificationBusiness/shared";
import { resolvePublicEligibilityDto } from "./payoutDomain";

type QueryFailure = Readonly<{ code?: string; message?: string }>;
type QueryResponse = Readonly<{ data: unknown; error: QueryFailure | null }>;

interface PlatformClient {
  from(relation: string): {
    select(columns: string): PromiseLike<QueryResponse> & {
      order(column: string, options?: Readonly<{ ascending?: boolean }>): PromiseLike<QueryResponse>;
      eq(column: string, value: unknown): PromiseLike<QueryResponse> & {
        eq(column: string, value: unknown): PromiseLike<QueryResponse>;
        maybeSingle(): PromiseLike<QueryResponse>;
      };
      maybeSingle(): PromiseLike<QueryResponse>;
    };
  };
  rpc(functionName: string, parameters?: Record<string, unknown>): PromiseLike<QueryResponse>;
  functions: {
    invoke(name: string, options?: Readonly<{ body?: Record<string, unknown> }>): PromiseLike<{ data: unknown; error: QueryFailure | null }>;
  };
}

type Row = Record<string, unknown>;

function platformClient(): PlatformClient | null {
  return getSupabaseClient() as unknown as PlatformClient | null;
}

function unavailable<T>(): PlatformServiceResult<T> {
  return { ok: false, error: { code: "NOT_CONFIGURED", message: "Monetization services are unavailable until Supabase is configured." } };
}

function mapFailure(error: QueryFailure | null): PlatformServiceError {
  const message = error?.message ?? "";
  if (message.includes("LEGAL_COPY_REQUIRED")) return { code: "VALIDATION", message: "LEGAL_COPY_REQUIRED" };
  if (message.includes("BADGE_REQUIRED")) return { code: "VALIDATION", message: "An active Creator or Publisher badge is required before monetization application." };
  if (message.includes("DUAL_APPROVAL_REQUIRED")) return { code: "FORBIDDEN", message: "A different finance approver must approve this batch." };
  if (message.includes("PAYOUT_KILL_SWITCH")) return { code: "VALIDATION", message: "Payout processing is disabled by kill switch." };
  if (message.includes("PAYOUT_PROVIDER")) return { code: "UNAVAILABLE", message: "Payout provider is not configured." };
  if (error?.code === "42501") return { code: "FORBIDDEN", message: "You do not have permission to perform this action." };
  if (error?.code === "23505") return { code: "CONFLICT", message: "This record already exists or conflicts with the current state." };
  return { code: "UNAVAILABLE", message: "Monetization request could not be completed." };
}

function asRows(data: unknown): readonly Row[] {
  return Array.isArray(data) ? data.filter((row): row is Row => typeof row === "object" && row !== null) : [];
}

function asRow(data: unknown): Row | null {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data as Row : null;
}

function publicSafePayoutProfile(row: Row): Row {
  const { provider_account_id: _provider, ...rest } = row;
  return {
    ...rest,
    provider_account_id: null,
    provider_account_masked: typeof _provider === "string" && _provider.length > 4
      ? `••••${_provider.slice(-4)}`
      : null,
  };
}

function publicSafeTaxProfile(row: Row): Row {
  const {
    tax_identifier_token_reference: _token,
    internal_notes: _notes,
    ...rest
  } = row;
  return {
    ...rest,
    tax_identifier_token_reference: null,
    internal_notes: null,
  };
}

export const monetizationService = {
  async getMonetizationStatus(programType: "creator" | "publisher"): Promise<PlatformServiceResult<Row | null>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("monetization_accounts")
      .select("id,subject_id,program_type,badge_status,monetization_status,application_status,payout_onboarding_status,compliance_status,contract_id,payout_profile_id,tax_profile_id,activated_at,suspended_at")
      .eq("program_type", programType)
      .maybeSingle();
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRow(response.data) };
  },

  async createApplication(programType: "creator" | "publisher", idempotencyKey: string): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_monetization_application", {
      target_program_type: programType,
      target_idempotency_key: idempotencyKey,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async submitApplication(applicationId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("submit_monetization_application", { target_application_id: applicationId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async acceptAgreement(input: Readonly<{
    monetizationAccountId: Uuid;
    documentKey: string;
    documentVersion: string;
    locale?: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("accept_monetization_agreement", {
      target_monetization_account_id: input.monetizationAccountId,
      target_document_key: input.documentKey,
      target_document_version: input.documentVersion,
      target_locale: input.locale ?? "en",
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async listAgreements(programType: "creator" | "publisher"): Promise<PlatformServiceResult<readonly Row[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("monetization_legal_document_versions")
      .select("id,document_key,version,status,effective_at,created_at");
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    const prefix = programType === "creator" ? "creator_" : "publisher_";
    const shared = asRows(response.data).filter((row) => {
      const key = String(row.document_key ?? "");
      return key.startsWith(prefix) || !key.startsWith("creator_") && !key.startsWith("publisher_");
    });
    return { ok: true, data: shared };
  },

  async createPayoutProfile(input: Readonly<{
    monetizationAccountId: Uuid;
    payeeType: string;
    legalName: string;
    countryCode: string;
    payoutCurrency: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_payout_profile", {
      target_monetization_account_id: input.monetizationAccountId,
      target_payee_type: input.payeeType,
      target_legal_name: input.legalName,
      target_country_code: input.countryCode,
      target_payout_currency: input.payoutCurrency,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async getPayoutProfile(profileId: Uuid): Promise<PlatformServiceResult<Row | null>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("payout_profiles")
      .select("id,owner_type,owner_id,payee_type,legal_name,country_code,payout_currency,provider,onboarding_status,capabilities_status,requirements_status,payout_status,risk_status,provider_account_id,created_at,updated_at")
      .eq("id", profileId)
      .maybeSingle();
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    const row = asRow(response.data);
    return { ok: true, data: row ? publicSafePayoutProfile(row) : null };
  },

  async requestOnboardingLink(profileId: Uuid): Promise<PlatformServiceResult<{ url: string; providerReady: boolean }>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.functions.invoke("payout-onboarding-link", {
      body: { payout_profile_id: profileId, mode: "onboarding" },
    });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    const data = asRow(response.data);
    if (!data || typeof data.url !== "string") {
      return { ok: false, error: { code: "UNAVAILABLE", message: "Payout provider onboarding is not configured." } };
    }
    return { ok: true, data: { url: data.url, providerReady: data.provider_ready === true } };
  },

  async createTaxProfile(input: Readonly<{
    payoutProfileId: Uuid;
    taxResidencyCountry: string;
    taxEntityType: string;
    taxIdentifierLast4?: string | null;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_tax_profile", {
      target_payout_profile_id: input.payoutProfileId,
      target_tax_residency_country: input.taxResidencyCountry,
      target_tax_entity_type: input.taxEntityType,
      target_tax_identifier_last4: input.taxIdentifierLast4 ?? null,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async getTaxProfile(profileId: Uuid): Promise<PlatformServiceResult<Row | null>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("tax_profiles")
      .select("id,owner_type,owner_id,payout_profile_id,tax_residency_country,tax_entity_type,tax_identifier_last4,vat_status,tax_form_type,tax_form_status,withholding_status,submitted_at,verified_at,expires_at")
      .eq("id", profileId)
      .maybeSingle();
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    const row = asRow(response.data);
    return { ok: true, data: row ? publicSafeTaxProfile(row) : null };
  },

  async getEarningsBalance(monetizationAccountId: Uuid, currency: string): Promise<PlatformServiceResult<Row>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("compute_partner_balance", {
      target_monetization_account_id: monetizationAccountId,
      target_currency: currency,
    });
    if (response.error || !response.data) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRow(response.data) ?? {} };
  },

  async getPayoutEligibility(monetizationAccountId: Uuid, currency: string): Promise<PlatformServiceResult<Row>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("resolve_payout_eligibility", {
      target_monetization_account_id: monetizationAccountId,
      target_currency: currency,
    });
    if (response.error || !response.data) return { ok: false, error: mapFailure(response.error) };
    const row = asRow(response.data) ?? {};
    return {
      ok: true,
      data: resolvePublicEligibilityDto({
        eligible: row.eligible === true,
        reason_code: typeof row.reason_code === "string" ? row.reason_code : "unknown",
        next_required_action: typeof row.next_required_action === "string" ? row.next_required_action : null,
        available_amount_minor: typeof row.available_amount_minor === "number" ? row.available_amount_minor : 0,
        minimum_payout_minor: typeof row.minimum_payout_minor === "number" ? row.minimum_payout_minor : 0,
        currency: typeof row.currency === "string" ? row.currency : currency,
      }),
    };
  },

  async listPayoutHistory(monetizationAccountId: Uuid): Promise<PlatformServiceResult<readonly Row[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.from("payout_items")
      .select("id,currency,gross_amount_minor,net_amount_minor,status,failure_code,failure_message_safe,paid_at,returned_at,created_at")
      .eq("monetization_account_id", monetizationAccountId);
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRows(response.data) };
  },

  async listPublicTransparency(limit = 50): Promise<PlatformServiceResult<readonly Row[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("get_public_ad_transparency_archive", { target_limit: limit });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRows(response.data) };
  },

  // Root / finance
  async rootReviewApplication(input: Readonly<{
    applicationId: Uuid;
    decision: string;
    publicReasonCode?: string;
    internalReasonCode?: string;
    policyVersion?: string;
    idempotencyKey: string;
  }>): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("root_review_monetization_application", {
      target_application_id: input.applicationId,
      target_decision: input.decision,
      public_reason_code: input.publicReasonCode ?? null,
      internal_reason_code: input.internalReasonCode ?? null,
      policy_version: input.policyVersion ?? "v1",
      idempotency_key: input.idempotencyKey,
    });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async previewPayoutBatch(input: Readonly<{
    periodStart: string;
    periodEnd: string;
    currency: string;
    programType?: string | null;
  }>): Promise<PlatformServiceResult<Row>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("preview_payout_batch", {
      period_start: input.periodStart,
      period_end: input.periodEnd,
      target_currency: input.currency,
      target_program_type: input.programType ?? null,
    });
    if (response.error || !response.data) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: asRow(response.data) ?? {} };
  },

  async createPayoutBatch(input: Readonly<{
    periodStart: string;
    periodEnd: string;
    currency: string;
    programType?: string | null;
    idempotencyKey: string;
  }>): Promise<PlatformServiceResult<Uuid>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("create_payout_batch", {
      period_start: input.periodStart,
      period_end: input.periodEnd,
      target_currency: input.currency,
      target_program_type: input.programType ?? null,
      target_idempotency_key: input.idempotencyKey,
    });
    if (response.error || typeof response.data !== "string") return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data };
  },

  async approvePayoutBatch(batchId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("approve_payout_batch", { target_batch_id: batchId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async cancelPayoutBatch(batchId: Uuid): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("cancel_payout_batch", { target_batch_id: batchId });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },

  async togglePayoutSetting(key: string, enabled: boolean): Promise<PlatformServiceResult<true>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("root_toggle_payout_setting", {
      target_key: key,
      target_enabled: enabled,
    });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: true };
  },
};
