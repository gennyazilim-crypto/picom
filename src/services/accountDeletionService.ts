import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.accountDeletion.v3";

type Stored = {
  status: "none" | "requested" | "canceled" | "failed";
  requestId: string | null;
  deletionRequestedAt: string | null;
  anonymizeAfter: string | null;
  sessionsRevoked: boolean;
};

type EdgeDeletionResponse = {
  status: "requested" | "canceled";
  requestId?: string | null;
  requestedAt?: string | null;
  canceledAt?: string | null;
  anonymizeAfter?: string | null;
  sessionsRevokedAt?: string | null;
};

export type AccountDeletionStatus = Readonly<{
  requested: boolean;
  status: Stored["status"];
  requestId: string | null;
  deletionRequestedAt: string | null;
  anonymizeAfter: string | null;
  sessionsRevoked: boolean;
  safety: {
    destructiveActionPerformed: false;
    requiresBackendConfirmation: true;
    ownedCommunitiesRequireTransfer: true;
    gracePeriodDays: 14;
  };
  message: string;
}>;

export type AccountDeletionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const EMPTY: Stored = {
  status: "none",
  requestId: null,
  deletionRequestedAt: null,
  anonymizeAfter: null,
  sessionsRevoked: false,
};

function read(): Stored {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Stored>;
    return {
      status: value.status === "requested" || value.status === "canceled" || value.status === "failed" ? value.status : "none",
      requestId: typeof value.requestId === "string" ? value.requestId : null,
      deletionRequestedAt: typeof value.deletionRequestedAt === "string" ? value.deletionRequestedAt : null,
      anonymizeAfter: typeof value.anonymizeAfter === "string" ? value.anonymizeAfter : null,
      sessionsRevoked: value.sessionsRevoked === true,
    };
  } catch {
    return EMPTY;
  }
}

function write(value: Stored): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Restricted browser fallback. No credentials or sensitive content are stored.
  }
}

function toStatus(value: Stored): AccountDeletionStatus {
  const requested = value.status === "requested";
  const message = requested
    ? `Deletion requested. Your account is protected by a 14-day review period${value.sessionsRevoked ? " and all sessions were revoked" : ""}.`
    : value.status === "canceled"
      ? "The account deletion request was canceled."
      : value.status === "failed"
        ? "The account deletion request needs support review. No destructive action was performed."
        : "No account deletion request is active.";
  return {
    requested,
    status: value.status,
    requestId: value.requestId,
    deletionRequestedAt: value.deletionRequestedAt,
    anonymizeAfter: value.anonymizeAfter,
    sessionsRevoked: value.sessionsRevoked,
    safety: {
      destructiveActionPerformed: false,
      requiresBackendConfirmation: true,
      ownedCommunitiesRequireTransfer: true,
      gracePeriodDays: 14,
    },
    message,
  };
}

export const accountDeletionService = {
  getStatus(): AccountDeletionStatus {
    return toStatus(read());
  },

  async requestDeletion(input: {
    confirmationText: string;
    expectedUsername: string;
    ownedCommunityCount: number;
  }): Promise<AccountDeletionResult<AccountDeletionStatus>> {
    if (input.confirmationText.trim().toLowerCase() !== input.expectedUsername.trim().toLowerCase()) {
      return { ok: false, message: "Type your exact username before requesting account deletion." };
    }
    if (input.ownedCommunityCount > 0) {
      return { ok: false, message: `Transfer ownership of ${input.ownedCommunityCount} communit${input.ownedCommunityCount === 1 ? "y" : "ies"} before requesting deletion.` };
    }

    const requestedAt = new Date().toISOString();
    let next: Stored;
    if (dataSourceService.getStatus().isMock) {
      next = {
        status: "requested",
        requestId: `mock-deletion-${Date.now()}`,
        deletionRequestedAt: requestedAt,
        anonymizeAfter: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        sessionsRevoked: true,
      };
    } else {
      const client = getSupabaseClient();
      if (!client) return { ok: false, message: "Account deletion requests are unavailable." };
      const { data, error } = await client.functions.invoke<EdgeDeletionResponse>("account-deletion", {
        body: { action: "request", confirmationUsername: input.confirmationText.trim() },
      });
      if (error || data?.status !== "requested") {
        const failed = { ...EMPTY, status: "failed" as const };
        write(failed);
        return { ok: false, message: error?.message || "Picom could not complete the safe deletion request." };
      }
      next = {
        status: "requested",
        requestId: data.requestId ?? null,
        deletionRequestedAt: data.requestedAt ?? requestedAt,
        anonymizeAfter: data.anonymizeAfter ?? null,
        sessionsRevoked: Boolean(data.sessionsRevokedAt),
      };
    }

    write(next);
    return { ok: true, data: toStatus(next) };
  },

  async cancelDeletion(): Promise<AccountDeletionResult<AccountDeletionStatus>> {
    if (!dataSourceService.getStatus().isMock) {
      const client = getSupabaseClient();
      if (!client) return { ok: false, message: "Account deletion requests are unavailable." };
      const { data, error } = await client.functions.invoke<EdgeDeletionResponse>("account-deletion", {
        body: { action: "cancel" },
      });
      if (error || data?.status !== "canceled") return { ok: false, message: error?.message || "Picom could not cancel the deletion request." };
    }
    const next: Stored = { ...EMPTY, status: "canceled" };
    write(next);
    return { ok: true, data: toStatus(next) };
  },
};
