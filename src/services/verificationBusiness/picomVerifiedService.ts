import { getSupabaseClient } from "../supabase/supabaseClient";
import type {
  BillingCatalogPlan,
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreatePortalResult,
  PicomVerifiedPaymentSummary,
  PicomVerifiedPublicSummary,
  ReconcileVerifiedPaymentResult,
} from "../../types/verificationBusiness/picomVerified";
import type { AdEligibilityDecision } from "../../types/ads/adEligibility";
import type { PlatformServiceError, PlatformServiceResult } from "../../types/verificationBusiness/shared";

type QueryFailure = Readonly<{ code?: string; message?: string }>;
type QueryResponse = Readonly<{ data: unknown; error: QueryFailure | null }>;

interface PlatformQuery extends PromiseLike<QueryResponse> {
  select(columns: string): PlatformQuery;
  eq(column: string, value: unknown): PlatformQuery;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): PlatformQuery;
  limit(count: number): PlatformQuery;
}

interface PlatformClient {
  from(relation: string): PlatformQuery;
  rpc(functionName: string, parameters?: Record<string, unknown>): PromiseLike<QueryResponse>;
  auth: {
    getSession(): PromiseLike<{ data: { session: { access_token?: string; user?: { id?: string } } | null } }>;
  };
}

type Row = Record<string, unknown>;

function platformClient(): PlatformClient | null {
  return getSupabaseClient() as unknown as PlatformClient | null;
}

function unavailable<T>(): PlatformServiceResult<T> {
  return {
    ok: false,
    error: {
      code: "NOT_CONFIGURED",
      message: "PICOM Verified billing is unavailable until Supabase is configured.",
    },
  };
}

function mapFailure(error: QueryFailure | null): PlatformServiceError {
  if (error?.code === "42501") return { code: "FORBIDDEN", message: "You do not have permission to perform this action." };
  if (error?.code === "PGRST116") return { code: "NOT_FOUND", message: "The requested billing record was not found." };
  if (error?.message?.toLowerCase().includes("not configured")) {
    return { code: "NOT_CONFIGURED", message: "PICOM Verified billing provider is not configured." };
  }
  if (error?.code === "PROVIDER_VERIFICATION_BLOCKED" || error?.code === "PLAN_NOT_CONFIGURED") {
    return { code: "NOT_CONFIGURED", message: error.message ?? "PICOM Verified payments are not configured." };
  }
  if (error?.code === "PAYMENT_INTENT_NOT_FOUND") return { code: "NOT_FOUND", message: error.message ?? "The payment request was not found." };
  return { code: "UNAVAILABLE", message: "Picom could not complete this billing request right now." };
}

function functionsBaseUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || typeof url !== "string" || !url.trim()) return null;
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

async function authHeader(): Promise<string | null> {
  const client = platformClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

async function invokeJson<T>(path: string, init?: RequestInit): Promise<PlatformServiceResult<T>> {
  const base = functionsBaseUrl();
  if (!base) return unavailable();
  const requestAuthHeader = await authHeader();
  if (!requestAuthHeader) return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in to manage PICOM Verified." } };

  let response: Response;
  try {
    response = await fetch(`${base}/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: requestAuthHeader,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE", message: "Picom could not reach billing services." } };
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string } }
    | T
    | null;

  if (!response.ok) {
    const err = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
    if (response.status === 503) return { ok: false, error: { code: "NOT_CONFIGURED", message: err?.message ?? "Billing provider is not configured." } };
    return { ok: false, error: mapFailure({ code: err?.code, message: err?.message }) };
  }

  if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
    return { ok: true, data: payload.data };
  }
  return { ok: true, data: payload as T };
}

function asRows(data: unknown): readonly Row[] {
  return Array.isArray(data) ? data.filter((row): row is Row => typeof row === "object" && row !== null) : [];
}

export type VerificationSessionResult = Readonly<{
  sessionUrl: string | null;
  status: string;
  provider: string;
  message?: string;
}>;

export const picomVerifiedService = {
  async getSummary(): Promise<PlatformServiceResult<PicomVerifiedPublicSummary>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("get_picom_verified_summary");
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data as PicomVerifiedPublicSummary };
  },

  async listCatalog(): Promise<PlatformServiceResult<readonly BillingCatalogPlan[]>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client
      .from("billing_catalog_public")
      .select("plan_key,billing_interval,currency,amount_minor,status")
      .order("billing_interval", { ascending: true });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return {
      ok: true,
      data: asRows(response.data).map((row) => ({
        planKey: String(row.plan_key) as BillingCatalogPlan["planKey"],
        billingInterval: String(row.billing_interval) as BillingCatalogPlan["billingInterval"],
        currency: String(row.currency ?? "USD"),
        amountMinor: typeof row.amount_minor === "number" ? row.amount_minor : 0,
        status: "active" as const,
      })),
    };
  },

  async createCheckout(input: CreateCheckoutInput): Promise<PlatformServiceResult<CreateCheckoutResult>> {
    return invokeJson<CreateCheckoutResult>("verified-payment", {
      method: "POST",
      body: JSON.stringify({ action: "create", planKey: input.planKey, idempotencyKey: input.idempotencyKey }),
    });
  },

  async getPaymentStatus(): Promise<PlatformServiceResult<PicomVerifiedPaymentSummary | null>> {
    const client = platformClient();
    if (!client) return unavailable();
    const response = await client.rpc("get_picom_verified_payment_status");
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data as PicomVerifiedPaymentSummary | null };
  },

  async reconcilePayment(intentId: string): Promise<PlatformServiceResult<ReconcileVerifiedPaymentResult>> {
    return invokeJson<ReconcileVerifiedPaymentResult>("verified-payment", {
      method: "POST",
      body: JSON.stringify({ action: "reconcile", intentId }),
    });
  },

  async createPortal(returnPath = "/account/billing"): Promise<PlatformServiceResult<CreatePortalResult>> {
    return invokeJson<CreatePortalResult>("billing-portal", {
      method: "POST",
      body: JSON.stringify({ returnPath }),
    });
  },

  async createVerificationSession(returnPath = "/account/verification"): Promise<PlatformServiceResult<VerificationSessionResult>> {
    return invokeJson<VerificationSessionResult>("verification-account-session", {
      method: "POST",
      body: JSON.stringify({ returnPath }),
    });
  },

  async resolveAdEligibility(placement: string, contentKind?: string): Promise<PlatformServiceResult<AdEligibilityDecision>> {
    const client = platformClient();
    if (!client) return unavailable();
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;
    const response = await client.rpc("resolve_ad_eligibility", {
      target_user_id: userId,
      target_placement: placement,
      target_context: { contentKind: contentKind ?? null },
    });
    if (response.error) return { ok: false, error: mapFailure(response.error) };
    return { ok: true, data: response.data as AdEligibilityDecision };
  },
};
