import { getSupabaseClient } from "./supabase/supabaseClient";

export type AccountDeletionState = "none" | "email_pending" | "pending_deletion" | "canceled" | "completed" | "failed";

export type AccountDeletionStatus = Readonly<{
  requested: boolean;
  status: AccountDeletionState;
  requestId: string | null;
  deletionRequestedAt: string | null;
  scheduledDeletionAt: string | null;
  sessionsRevoked: boolean;
  safety: {
    destructiveActionPerformed: false;
    requiresBackendConfirmation: true;
    ownedCommunitiesRequireTransfer: true;
    gracePeriodDays: 30;
  };
}>;

export type AccountDeletionResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; message: string }>;

const EMPTY: AccountDeletionStatus = {
  requested: false,
  status: "none",
  requestId: null,
  deletionRequestedAt: null,
  scheduledDeletionAt: null,
  sessionsRevoked: false,
  safety: {
    destructiveActionPerformed: false,
    requiresBackendConfirmation: true,
    ownedCommunitiesRequireTransfer: true,
    gracePeriodDays: 30,
  },
};

function statusFromRow(row: {
  request_id?: string | null;
  status?: string | null;
  requested_at?: string | null;
  scheduled_deletion_at?: string | null;
} | null | undefined): AccountDeletionStatus {
  const status: AccountDeletionState =
    row?.status === "email_pending" || row?.status === "pending_deletion" || row?.status === "canceled" || row?.status === "completed" || row?.status === "failed"
      ? row.status
      : "none";
  return {
    ...EMPTY,
    requested: status === "email_pending" || status === "pending_deletion",
    status,
    requestId: row?.request_id ?? null,
    deletionRequestedAt: row?.requested_at ?? null,
    scheduledDeletionAt: row?.scheduled_deletion_at ?? null,
  };
}

function failure(): AccountDeletionResult<never> {
  return { ok: false, message: "" };
}

/** The backend owns requests, email confirmation, recovery, and finalization. */
export const accountDeletionService = {
  getStatus(): AccountDeletionStatus {
    return EMPTY;
  },

  async refreshStatus(): Promise<AccountDeletionStatus> {
    const client = getSupabaseClient();
    if (!client) return EMPTY;
    const { data, error } = await client.rpc("get_current_user_account_deletion_status");
    if (error) return EMPTY;
    return statusFromRow(Array.isArray(data) ? data[0] : data);
  },

  async requestDeletion(): Promise<AccountDeletionResult<AccountDeletionStatus>> {
    const client = getSupabaseClient();
    if (!client) return failure();
    const { data, error } = await client.functions.invoke<{
      status?: AccountDeletionState;
      requestId?: string | null;
      scheduledDeletionAt?: string | null;
    }>("account-deletion", { body: { action: "request" } });
    if (error || (data?.status !== "email_pending" && data?.status !== "pending_deletion")) return failure();
    return {
      ok: true,
      data: {
        ...EMPTY,
        requested: true,
        status: data.status,
        requestId: data.requestId ?? null,
        scheduledDeletionAt: data.scheduledDeletionAt ?? null,
      },
    };
  },

  async cancelDeletion(): Promise<AccountDeletionResult<AccountDeletionStatus>> {
    const client = getSupabaseClient();
    if (!client) return failure();
    const { data, error } = await client.functions.invoke<{ status?: string }>("account-deletion", {
      body: { action: "cancel" },
    });
    if (error || data?.status !== "canceled") return failure();
    return { ok: true, data: { ...EMPTY, status: "canceled" } };
  },
};
