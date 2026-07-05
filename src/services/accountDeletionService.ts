const STORAGE_KEY = "picom.accountDeletionPlaceholder.v1";
const SCHEMA_VERSION = 1;

type StoredDeletionState = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  deletionRequestedAt: string | null;
  deletionMode: "none" | "soft_delete_placeholder" | "scheduled_delete_placeholder";
}>;

export type AccountDeletionStatus = Readonly<{
  requested: boolean;
  deletionRequestedAt: string | null;
  deletionMode: StoredDeletionState["deletionMode"];
  message: string;
}>;

export type AccountDeletionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function getDefaultState(): StoredDeletionState {
  return {
    schemaVersion: SCHEMA_VERSION,
    deletionRequestedAt: null,
    deletionMode: "none",
  };
}

function readState(): StoredDeletionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();

    const parsed = JSON.parse(raw) as Partial<StoredDeletionState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return getDefaultState();

    return {
      schemaVersion: SCHEMA_VERSION,
      deletionRequestedAt: typeof parsed.deletionRequestedAt === "string" ? parsed.deletionRequestedAt : null,
      deletionMode: parsed.deletionMode === "soft_delete_placeholder" || parsed.deletionMode === "scheduled_delete_placeholder" ? parsed.deletionMode : "none",
    };
  } catch {
    return getDefaultState();
  }
}

function writeState(next: StoredDeletionState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function toStatus(state: StoredDeletionState): AccountDeletionStatus {
  const requested = Boolean(state.deletionRequestedAt);

  return {
    requested,
    deletionRequestedAt: state.deletionRequestedAt,
    deletionMode: state.deletionMode,
    message: requested
      ? "Account deletion request placeholder is recorded locally. No data has been deleted."
      : "No account deletion request is active.",
  };
}

export const accountDeletionService = {
  getStatus(): AccountDeletionStatus {
    return toStatus(readState());
  },

  requestDeletionPlaceholder(confirmationText: string, expectedText: string): AccountDeletionResult<AccountDeletionStatus> {
    if (confirmationText.trim() !== expectedText.trim()) {
      return {
        ok: false,
        message: "Type the exact confirmation text before requesting account deletion.",
      };
    }

    const next: StoredDeletionState = {
      schemaVersion: SCHEMA_VERSION,
      deletionRequestedAt: new Date().toISOString(),
      deletionMode: "scheduled_delete_placeholder",
    };
    writeState(next);

    return {
      ok: true,
      data: toStatus(next),
    };
  },

  cancelDeletionPlaceholder(): AccountDeletionResult<AccountDeletionStatus> {
    const next = getDefaultState();
    writeState(next);

    return {
      ok: true,
      data: toStatus(next),
    };
  },
};