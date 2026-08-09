import { getSupabaseClient } from "../supabase/supabaseClient";
import { emitLiveNowStructuredLog } from "./liveNowStructuredLog";
import { createLiveNowCorrelationId } from "./liveNowCorrelation";
import { LIVE_NOW_SERVICE_CATALOG } from "./liveNowHealthModel";
import { LIVE_NOW_SLO_OBSERVATION_STATUS } from "./liveNowSloDefinitions";
import { LIVE_NOW_ALERT_TRANSPORT } from "./liveNowAlertRules";
import { HISTORICAL_BLOCKERS_PRESERVED, LIVE_NOW_RELEASE_TIERS } from "./liveNowReleaseReadiness";

export type LiveNowOpsStatusPayload = Record<string, unknown>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRpcClient(client: NonNullable<ReturnType<typeof getSupabaseClient>>): RpcClient {
  return client as unknown as RpcClient;
}

export const liveNowOpsService = {
  catalog() {
    return LIVE_NOW_SERVICE_CATALOG;
  },

  localStatusSummary(): LiveNowOpsStatusPayload {
    return {
      source: "local_contracts",
      checkedAt: new Date().toISOString(),
      services: LIVE_NOW_SERVICE_CATALOG.map((entry) => ({
        key: entry.key,
        healthStatus: entry.healthStatus,
        productionEnabled: entry.productionEnabled,
        featureFlag: entry.featureFlag,
        certificationStatus: entry.certificationStatus,
      })),
      slo: { ...LIVE_NOW_SLO_OBSERVATION_STATUS },
      alertTransport: LIVE_NOW_ALERT_TRANSPORT,
      releaseTiers: LIVE_NOW_RELEASE_TIERS.map((tier) => ({
        tier: tier.tier,
        verdict: tier.verdict,
      })),
      historicalBlockers: [...HISTORICAL_BLOCKERS_PRESERVED],
    };
  },

  async fetchProductionStatus(): Promise<{ ok: true; data: LiveNowOpsStatusPayload } | { ok: false; message: string }> {
    const correlationId = createLiveNowCorrelationId("ops_probe");
    try {
      const client = getSupabaseClient();
      if (!client) {
        return { ok: true, data: { ...this.localStatusSummary(), source: "local_no_supabase_client" } };
      }
      const rpc = asRpcClient(client);
      const started = performance.now();
      const { data, error } = await rpc.rpc("get_live_now_ops_status");
      const latencyMs = Math.max(0, Math.round(performance.now() - started));
      if (error) {
        emitLiveNowStructuredLog({
          service: "live_now_ops",
          severity: "WARN",
          event: "ops.status.fetch_failed",
          correlationId,
          errorCode: error.code ?? "OPS_STATUS_FETCH_FAILED",
          metadata: { latencyMs },
        });
        return { ok: true, data: { ...this.localStatusSummary(), source: "local_fallback", rpc_error: error.message } };
      }
      const payload = asRecord(data) ?? {};
      void Promise.resolve(rpc.rpc("record_live_now_ops_metric", {
        p_service_key: "live_now_ops",
        p_metric_name: "status_fetch",
        p_success: true,
        p_latency_ms: latencyMs,
        p_dimensions: { source: "desktop" },
      })).then(() => undefined, () => undefined);
      emitLiveNowStructuredLog({
        service: "live_now_ops",
        severity: "INFO",
        event: "ops.status.fetch_ok",
        correlationId,
        metadata: { latencyMs, open_alerts: payload.open_alerts ?? null },
      });
      return { ok: true, data: payload };
    } catch (error) {
      emitLiveNowStructuredLog({
        service: "live_now_ops",
        severity: "ERROR",
        event: "ops.status.exception",
        correlationId,
        errorCode: "OPS_STATUS_EXCEPTION",
        metadata: { message: error instanceof Error ? error.message : "unknown" },
      });
      return { ok: true, data: { ...this.localStatusSummary(), source: "local_fallback_exception" } };
    }
  },
};
