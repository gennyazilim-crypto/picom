const STORAGE_KEY = "picom.twoFactorPlaceholder.v1";
const SCHEMA_VERSION = 1;

type StoredTwoFactorState = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  enabledPlaceholder: boolean;
  updatedAt: string | null;
}>;

export type TwoFactorStatus = Readonly<{
  enabled: boolean;
  provider: "supabase_placeholder";
  recoveryCodesAvailable: boolean;
  message: string;
  updatedAt: string | null;
}>;

export type TwoFactorResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

function getDefaultState(): StoredTwoFactorState {
  return {
    schemaVersion: SCHEMA_VERSION,
    enabledPlaceholder: false,
    updatedAt: null,
  };
}

function readState(): StoredTwoFactorState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();

    const parsed = JSON.parse(raw) as Partial<StoredTwoFactorState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return getDefaultState();

    return {
      schemaVersion: SCHEMA_VERSION,
      enabledPlaceholder: Boolean(parsed.enabledPlaceholder),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return getDefaultState();
  }
}

function writeState(next: StoredTwoFactorState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function toStatus(state: StoredTwoFactorState): TwoFactorStatus {
  return {
    enabled: state.enabledPlaceholder,
    provider: "supabase_placeholder",
    recoveryCodesAvailable: false,
    updatedAt: state.updatedAt,
    message: state.enabledPlaceholder
      ? "2FA placeholder is marked as prepared locally. Supabase MFA enforcement is not enabled yet."
      : "2FA architecture is prepared, but MFA is not enforced in this MVP placeholder.",
  };
}

export const twoFactorAuthService = {
  getStatus(): TwoFactorStatus {
    return toStatus(readState());
  },

  prepareSetupPlaceholder(): TwoFactorResult<TwoFactorStatus> {
    const next: StoredTwoFactorState = {
      schemaVersion: SCHEMA_VERSION,
      enabledPlaceholder: true,
      updatedAt: new Date().toISOString(),
    };
    writeState(next);

    return {
      ok: true,
      data: toStatus(next),
    };
  },

  disablePlaceholder(): TwoFactorResult<TwoFactorStatus> {
    const next: StoredTwoFactorState = {
      schemaVersion: SCHEMA_VERSION,
      enabledPlaceholder: false,
      updatedAt: new Date().toISOString(),
    };
    writeState(next);

    return {
      ok: true,
      data: toStatus(next),
    };
  },

  regenerateRecoveryCodesPlaceholder(): TwoFactorResult<{ message: string }> {
    return {
      ok: true,
      data: {
        message: "Recovery code regeneration is reserved for a trusted Supabase MFA flow. No raw recovery codes were generated or stored.",
      },
    };
  },
};