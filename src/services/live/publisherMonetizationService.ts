import { getSupabaseClient } from "../supabase/supabaseClient";

export type PublisherEarningsCurrencyBalance = Readonly<{
  currency: string;
  pending_balance_minor: number;
  available_balance_minor: number;
  paid_balance_minor: number;
  refunded_or_reversed_minor: number;
  gross_revenue_minor: number;
  net_revenue_minor: number;
  subscriptions_net_minor: number;
  donations_net_minor: number;
  ads_net_minor: number;
}>;

export type PublisherEarningsOverview = Readonly<{
  ok: boolean;
  publisher_user_id?: string;
  payouts_available: boolean;
  payouts_status: string;
  balances_by_currency: ReadonlyArray<PublisherEarningsCurrencyBalance>;
  note?: string;
}>;

export type PublisherFinanceTransaction = Readonly<{
  id: string;
  created_at: string;
  source_type: string;
  entry_type: string;
  amount_minor: number;
  currency: string;
  direction: string;
  balance_bucket: string;
  status: string;
  correlation_id: string;
}>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function client(): RpcClient | null {
  return getSupabaseClient() as unknown as RpcClient | null;
}

function asOverview(data: unknown): PublisherEarningsOverview {
  const row = (data ?? {}) as Partial<PublisherEarningsOverview>;
  return {
    ok: Boolean(row.ok),
    publisher_user_id: row.publisher_user_id,
    payouts_available: false,
    payouts_status: row.payouts_status ?? "PAYOUTS_NOT_IMPLEMENTED",
    balances_by_currency: Array.isArray(row.balances_by_currency)
      ? (row.balances_by_currency as PublisherEarningsCurrencyBalance[])
      : [],
    note: row.note,
  };
}

/** Format integer minor units without floating money math. */
export function formatMinorUnits(amountMinor: number, currency: string, locale: string): string {
  const safe = Number.isFinite(amountMinor) ? Math.trunc(amountMinor) : 0;
  const code = (currency || "EUR").toUpperCase();
  try {
    const fractionDigits =
      new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const divisor = 10 ** fractionDigits;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "symbol",
    }).format(safe / divisor);
  } catch {
    return `${safe} ${code} (minor)`;
  }
}

export const publisherMonetizationService = {
  async getEarningsOverview(): Promise<{ ok: true; data: PublisherEarningsOverview } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_publisher_earnings_overview", {
      p_include_internal_test: false,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: asOverview(data) };
  },

  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    sourceType?: string;
    currency?: string;
  }): Promise<{ ok: true; items: PublisherFinanceTransaction[] } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_publisher_transactions", {
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
      p_source_type: params?.sourceType ?? null,
      p_currency: params?.currency ?? null,
      p_include_internal_test: false,
    });
    if (error) return { ok: false, error: error.message };
    const payload = (data ?? {}) as { items?: PublisherFinanceTransaction[] };
    return { ok: true, items: Array.isArray(payload.items) ? payload.items : [] };
  },

  async getRevenueTimeseries(params?: {
    bucket?: "day" | "week" | "month";
    currency?: string;
  }): Promise<{ ok: true; series: unknown[] } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_publisher_revenue_timeseries", {
      p_bucket: params?.bucket ?? "day",
      p_currency: params?.currency ?? null,
      p_include_internal_test: false,
    });
    if (error) return { ok: false, error: error.message };
    const payload = (data ?? {}) as { series?: unknown[] };
    return { ok: true, series: Array.isArray(payload.series) ? payload.series : [] };
  },

  async getSubscriptionMetrics(): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_publisher_subscription_metrics", {
      p_include_internal_test: false,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },

  async getFinanceSetup(): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_my_publisher_finance_setup");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? {}) as Record<string, unknown> };
  },

  async getPayoutRequests(): Promise<{ ok: true; items: unknown[] } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_my_publisher_payout_requests", { p_limit: 40 });
    if (error) return { ok: false, error: error.message };
    const payload = (data ?? {}) as { items?: unknown[] };
    return { ok: true, items: Array.isArray(payload.items) ? payload.items : [] };
  },

  async getStatements(): Promise<{ ok: true; items: unknown[] } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_my_publisher_finance_statements", { p_limit: 24 });
    if (error) return { ok: false, error: error.message };
    const payload = (data ?? {}) as { items?: unknown[] };
    return { ok: true, items: Array.isArray(payload.items) ? payload.items : [] };
  },

  async requestKycOnboarding(): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("request_publisher_kyc_onboarding");
    if (error) return { ok: false, error: error.message };
    const payload = (data ?? {}) as { ok?: boolean; error?: string; message?: string };
    if (payload.ok === false) return { ok: false, error: payload.error ?? payload.message ?? "KYC_UNAVAILABLE" };
    return { ok: true, data };
  },
};
