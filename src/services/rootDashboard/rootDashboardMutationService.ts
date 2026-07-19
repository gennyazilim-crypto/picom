import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { AdminOperationsResult } from "../../types/adminOperations";
import type { AdminOperationsAccess } from "../adminOperationsService";
import type {
  RootDashboardCommandSearchResult,
  RootDashboardExportJob,
  RootDashboardListPage,
  RootDashboardMutationOk,
} from "../../types/rootDashboardOperations";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function encodeRemoteCursor(value: unknown): string | null {
  const row = asRecord(value);
  return row && typeof row.created_at === "string" && typeof row.id === "string"
    ? `${row.created_at}|${row.id}`
    : null;
}

function isMissingRpcError(error: { code?: string; message?: string; details?: string; hint?: string } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    code === "PGRST202"
    || code === "42883"
    || text.includes("could not find the function")
    || text.includes("function public.")
    || text.includes("schema cache")
    || text.includes("does not exist")
  );
}

function missingRpcMessage(rpcName: string): string {
  return `The ${rpcName} RPC is not deployed yet. Apply the root dashboard mutation migration before using this action.`;
}

function parseMutationOk(value: unknown): RootDashboardMutationOk {
  if (typeof value === "string") return { ok: true, id: value };
  if (typeof value === "boolean") return { ok: value };
  const row = asRecord(value);
  if (!row) return { ok: true };
  return {
    ok: row.ok !== false,
    id: typeof row.id === "string" ? row.id : undefined,
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

function parseListPage(value: unknown, limit: number): RootDashboardListPage | null {
  const row = asRecord(value);
  if (!row || !Array.isArray(row.items)) return null;
  const items = row.items.flatMap((entry): RootDashboardListPage["items"][number][] => {
    const item = asRecord(entry);
    if (!item || typeof item.id !== "string" || typeof item.label !== "string") return [];
    const createdAt = typeof item.created_at === "string"
      ? item.created_at
      : typeof item.createdAt === "string"
        ? item.createdAt
        : new Date(0).toISOString();
    return [{
      id: item.id,
      label: item.label,
      detail: typeof item.detail === "string" ? item.detail : "",
      status: typeof item.status === "string" ? item.status : "unknown",
      createdAt,
    }];
  });
  return {
    items,
    nextCursor: encodeRemoteCursor(row.next_cursor),
    hasMore: row.has_more === true,
    limit,
  };
}

function parseExportJobs(value: unknown): RootDashboardExportJob[] {
  const row = asRecord(value);
  const rawItems = Array.isArray(value) ? value : Array.isArray(row?.items) ? row.items : [];
  return rawItems.flatMap((entry): RootDashboardExportJob[] => {
    const item = asRecord(entry);
    if (!item || typeof item.id !== "string") return [];
    return [{
      id: item.id,
      label: typeof item.label === "string" ? item.label : (typeof item.export_type === "string" ? item.export_type : item.id),
      detail: typeof item.detail === "string" ? item.detail : (typeof item.format === "string" ? item.format : ""),
      status: typeof item.status === "string" ? item.status : "unknown",
      createdAt: typeof item.created_at === "string" ? item.created_at : (typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString()),
    }];
  });
}

function parseCommandSearch(value: unknown): RootDashboardCommandSearchResult {
  const row = asRecord(value);
  const rawItems = Array.isArray(value) ? value : Array.isArray(row?.items) ? row.items : [];
  const items = rawItems.flatMap((entry): RootDashboardCommandSearchResult["items"][number][] => {
    const item = asRecord(entry);
    if (!item) return [];
    const routeKey = typeof item.route_key === "string"
      ? item.route_key
      : typeof item.routeKey === "string"
        ? item.routeKey
        : typeof item.id === "string"
          ? item.id
          : null;
    const label = typeof item.label === "string" ? item.label : null;
    if (!routeKey || !label) return [];
    return [{
      id: typeof item.id === "string" ? item.id : routeKey,
      label,
      routeKey,
      detail: typeof item.detail === "string" ? item.detail : "",
    }];
  });
  return { items };
}

async function invokeMutationRpc(
  access: AdminOperationsAccess,
  rpcName: string,
  args: Record<string, unknown>,
): Promise<AdminOperationsResult<RootDashboardMutationOk>> {
  if (!access.allowed || access.source === "none") {
    return { ok: false, message: "App admin access is required." };
  }

  if (dataSourceService.getStatus().isMock) {
    return { ok: true, data: { ok: true, id: crypto.randomUUID() } };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, message: "Root dashboard mutations are unavailable." };

  const { data, error } = await client.rpc(rpcName as never, args as never);
  if (error) {
    if (isMissingRpcError(error)) return { ok: false, message: missingRpcMessage(rpcName) };
    const message = error.message?.trim() || `Picom could not complete ${rpcName.replace(/_/g, " ")}.`;
    return { ok: false, message };
  }

  return { ok: true, data: parseMutationOk(data) };
}

export const rootDashboardMutationService = {
  createSupportTicket(
    access: AdminOperationsAccess,
    input: Readonly<{ subject: string; category?: string; priority?: string }>,
  ) {
    return invokeMutationRpc(access, "create_support_ticket", {
      p_subject: input.subject.trim(),
      p_category: input.category?.trim() || "general",
      p_priority: input.priority?.trim() || "normal",
    });
  },

  updateSupportTicketStatus(
    access: AdminOperationsAccess,
    input: Readonly<{ ticketId: string; status: string }>,
  ) {
    return invokeMutationRpc(access, "update_support_ticket_status", {
      p_ticket_id: input.ticketId,
      p_status: input.status,
    });
  },

  assignSupportTicket(
    access: AdminOperationsAccess,
    input: Readonly<{ ticketId: string; assigneeId: string }>,
  ) {
    return invokeMutationRpc(access, "assign_support_ticket", {
      p_ticket_id: input.ticketId,
      p_assignee_id: input.assigneeId,
    });
  },

  upsertAdCampaign(
    access: AdminOperationsAccess,
    input: Readonly<{ id?: string; name: string; objective?: string; budgetCents?: number }>,
  ) {
    return invokeMutationRpc(access, "upsert_ad_campaign", {
      p_id: input.id ?? null,
      p_name: input.name.trim(),
      p_objective: input.objective?.trim() || "awareness",
      p_budget_cents: input.budgetCents ?? 0,
    });
  },

  setAdCampaignStatus(
    access: AdminOperationsAccess,
    input: Readonly<{ campaignId: string; status: string }>,
  ) {
    return invokeMutationRpc(access, "set_ad_campaign_status", {
      p_campaign_id: input.campaignId,
      p_status: input.status,
    });
  },

  setAdReviewStatus(
    access: AdminOperationsAccess,
    input: Readonly<{ campaignId: string; reviewStatus: string }>,
  ) {
    return invokeMutationRpc(access, "set_ad_review_status", {
      p_campaign_id: input.campaignId,
      p_review_status: input.reviewStatus,
    });
  },

  createPlatformIncident(
    access: AdminOperationsAccess,
    input: Readonly<{ title: string; severity: string; publicMessage?: string }>,
  ) {
    return invokeMutationRpc(access, "create_platform_incident", {
      p_title: input.title.trim(),
      p_severity: input.severity,
      p_public_message: input.publicMessage?.trim() || null,
    });
  },

  updatePlatformIncidentStatus(
    access: AdminOperationsAccess,
    input: Readonly<{ incidentId: string; status: string }>,
  ) {
    return invokeMutationRpc(access, "update_platform_incident_status", {
      p_incident_id: input.incidentId,
      p_status: input.status,
    });
  },

  createFinanceApprovalRequest(
    access: AdminOperationsAccess,
    input: Readonly<{ requestType: string; amountCents: number; currency?: string }>,
  ) {
    return invokeMutationRpc(access, "create_finance_approval_request", {
      p_request_type: input.requestType.trim(),
      p_amount_cents: input.amountCents,
      p_currency: input.currency?.trim() || "USD",
    });
  },

  reviewFinanceApprovalRequest(
    access: AdminOperationsAccess,
    input: Readonly<{ requestId: string; status: string; stepUpChallengeId?: string | null }>,
  ) {
    return invokeMutationRpc(access, "review_finance_approval_request", {
      p_request_id: input.requestId,
      p_decision: input.status,
      p_step_up_challenge_id: input.stepUpChallengeId ?? null,
    });
  },

  upsertRemoteFeatureFlag(
    access: AdminOperationsAccess,
    input: Readonly<{ flagKey: string; enabled: boolean; description?: string; stepUpChallengeId?: string | null }>,
  ) {
    return invokeMutationRpc(access, "upsert_remote_feature_flag", {
      p_flag_key: input.flagKey.trim(),
      p_enabled: input.enabled,
      p_description: input.description?.trim() || "",
      p_step_up_challenge_id: input.stepUpChallengeId ?? null,
    });
  },

  assignPlatformRole(
    access: AdminOperationsAccess,
    input: Readonly<{ userId: string; roleKey: string; scopeType?: string; stepUpChallengeId?: string | null }>,
  ) {
    return invokeMutationRpc(access, "assign_platform_role", {
      p_user_id: input.userId.trim(),
      p_role_key: input.roleKey.trim(),
      p_scope_type: input.scopeType?.trim() || "global",
      p_step_up_challenge_id: input.stepUpChallengeId ?? null,
    });
  },

  revokePlatformRole(
    access: AdminOperationsAccess,
    input: Readonly<{ assignmentId: string; stepUpChallengeId?: string | null }>,
  ) {
    return invokeMutationRpc(access, "revoke_platform_role", {
      p_assignment_id: input.assignmentId.trim(),
      p_step_up_challenge_id: input.stepUpChallengeId ?? null,
    });
  },

  upsertSubscriptionRecord(
    access: AdminOperationsAccess,
    input: Readonly<{ externalRef: string; planKey: string; status: string; mrrCents?: number; currency?: string }>,
  ) {
    return invokeMutationRpc(access, "upsert_subscription_record", {
      p_external_ref: input.externalRef.trim(),
      p_plan_key: input.planKey.trim(),
      p_status: input.status.trim(),
      p_mrr_cents: input.mrrCents ?? 0,
      p_currency: input.currency?.trim() || "USD",
    });
  },

  createPrivilegedStepUp(
    access: AdminOperationsAccess,
    actionKey: string,
  ) {
    return invokeMutationRpc(access, "create_privileged_step_up", {
      action_key: actionKey.trim(),
    });
  },

  confirmPrivilegedStepUp(
    access: AdminOperationsAccess,
    challengeId: string,
  ) {
    return invokeMutationRpc(access, "confirm_privileged_step_up", {
      challenge_id: challengeId.trim(),
    });
  },

  async getCommandSearch(
    access: AdminOperationsAccess,
    queryText: string,
  ): Promise<AdminOperationsResult<RootDashboardCommandSearchResult>> {
    if (!access.allowed || access.source === "none") {
      return { ok: false, message: "App admin access is required." };
    }

    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: { items: [] } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Command search is unavailable." };

    const { data, error } = await client.rpc("get_root_dashboard_command_search_v1", {
      query: queryText.trim(),
    });
    if (error) {
      if (isMissingRpcError(error)) return { ok: false, message: missingRpcMessage("get_root_dashboard_command_search_v1") };
      return { ok: false, message: error.message || "Command search failed." };
    }
    return { ok: true, data: parseCommandSearch(data) };
  },

  createExportJob(
    access: AdminOperationsAccess,
    input: Readonly<{ exportType: string; format?: string }>,
  ) {
    return invokeMutationRpc(access, "create_root_dashboard_export_job", {
      p_module_name: input.exportType.trim(),
      p_format: input.format?.trim() || "csv",
    });
  },

  async listExportJobs(
    access: AdminOperationsAccess,
  ): Promise<AdminOperationsResult<RootDashboardListPage>> {
    if (!access.allowed || access.source === "none") {
      return { ok: false, message: "App admin access is required." };
    }
    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: { items: [], nextCursor: null, hasMore: false, limit: 25 } };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Export jobs are unavailable." };
    const { data, error } = await client.rpc("list_root_dashboard_export_jobs", {
      page_cursor_created_at: null,
      page_cursor_id: null,
      page_limit: 25,
    });
    if (error) {
      if (isMissingRpcError(error)) return { ok: false, message: missingRpcMessage("list_root_dashboard_export_jobs") };
      return { ok: false, message: error.message || "Could not list export jobs." };
    }
    const page = parseListPage(data, 25);
    return page
      ? { ok: true, data: page }
      : { ok: false, message: "Export job list returned an invalid response." };
  },
};
