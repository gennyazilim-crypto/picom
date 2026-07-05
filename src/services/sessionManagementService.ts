import { authService, type AuthServiceSession } from "./authService";
import { dataSourceService } from "./dataSourceService";
import { platformService } from "./platformService";

const STORAGE_KEY = "picom.sessionManagement.v1";
const SCHEMA_VERSION = 1;

export type SessionDeviceSummary = Readonly<{
  id: string;
  provider: AuthServiceSession["provider"];
  userId: string | null;
  email: string | null;
  displayName: string | null;
  deviceLabel: string;
  platformLabel: string;
  runtimeLabel: string;
  createdAt: string | null;
  lastUsedAt: string;
  expiresAt: string | null;
  current: boolean;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked" | "placeholder";
}>;

export type ActiveSessionsSummary = Readonly<{
  sessions: SessionDeviceSummary[];
  message: string;
  requiresSignIn: boolean;
}>;

type StoredSessionManagementState = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  revokedSessionIds: string[];
  otherSessionsRevokedAt: string | null;
  lastReviewedAt: string | null;
}>;

export type SessionManagementResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string; requiresSignIn?: boolean }>;

function getDefaultState(): StoredSessionManagementState {
  return {
    schemaVersion: SCHEMA_VERSION,
    revokedSessionIds: [],
    otherSessionsRevokedAt: null,
    lastReviewedAt: null,
  };
}

function readState(): StoredSessionManagementState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();

    const parsed = JSON.parse(raw) as Partial<StoredSessionManagementState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return getDefaultState();

    return {
      schemaVersion: SCHEMA_VERSION,
      revokedSessionIds: Array.isArray(parsed.revokedSessionIds) ? parsed.revokedSessionIds.filter(Boolean) : [],
      otherSessionsRevokedAt: typeof parsed.otherSessionsRevokedAt === "string" ? parsed.otherSessionsRevokedAt : null,
      lastReviewedAt: typeof parsed.lastReviewedAt === "string" ? parsed.lastReviewedAt : null,
    };
  } catch {
    return getDefaultState();
  }
}

function writeState(next: StoredSessionManagementState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function toIso(seconds: number | null): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function isExpired(expiresAt: number | null): boolean {
  return Boolean(expiresAt && expiresAt * 1000 <= Date.now());
}

function getSessionId(session: AuthServiceSession | null): string {
  const provider = session?.provider ?? dataSourceService.getMode();
  const userId = session?.user?.id ?? "local-current-user";
  const expiresAt = session?.expiresAt ?? "non-expiring";
  return `current-${provider}-${userId}-${expiresAt}`;
}

function getFallbackSession(): AuthServiceSession {
  return {
    provider: "mock",
    expiresAt: null,
    user: {
      id: "mock-current-user",
      email: "mock@picom.local",
      displayName: "Picom Mock User",
      emailVerifiedAt: null,
    },
  };
}

function createSessionSummary(session: AuthServiceSession | null, state: StoredSessionManagementState): SessionDeviceSummary {
  const resolvedSession = session ?? getFallbackSession();
  const platformInfo = platformService.getInfo();
  const id = getSessionId(resolvedSession);
  const revokedAt = state.revokedSessionIds.includes(id) ? state.otherSessionsRevokedAt ?? new Date().toISOString() : null;
  const expired = isExpired(resolvedSession.expiresAt);

  return {
    id,
    provider: resolvedSession.provider,
    userId: resolvedSession.user?.id ?? null,
    email: resolvedSession.user?.email ?? null,
    displayName: resolvedSession.user?.displayName ?? null,
    deviceLabel: `${platformInfo.platformLabel} ${platformInfo.runtimeLabel}`,
    platformLabel: platformInfo.platformLabel,
    runtimeLabel: platformInfo.runtimeLabel,
    createdAt: null,
    lastUsedAt: new Date().toISOString(),
    expiresAt: toIso(resolvedSession.expiresAt),
    current: true,
    revokedAt,
    status: revokedAt ? "revoked" : expired ? "expired" : "active",
  };
}

export const sessionManagementService = {
  async getActiveSessions(): Promise<SessionManagementResult<ActiveSessionsSummary>> {
    const authSession = await authService.getCurrentSession();
    if (!authSession.ok) {
      const requiresSignIn = authSession.error.code === "AUTH_SESSION_EXPIRED";
      return {
        ok: false,
        message: requiresSignIn ? "Your session expired. Please sign in again." : authSession.error.message,
        requiresSignIn,
      };
    }

    const state = readState();
    const session = authSession.data ?? (dataSourceService.getStatus().isMock ? getFallbackSession() : null);
    const currentSession = createSessionSummary(session, state);

    writeState({
      ...state,
      lastReviewedAt: new Date().toISOString(),
    });

    if (currentSession.status === "expired") {
      return {
        ok: false,
        message: "Your current desktop session has expired. Please sign in again.",
        requiresSignIn: true,
      };
    }

    if (currentSession.status === "revoked") {
      return {
        ok: false,
        message: "Your current desktop session was revoked. Please sign in again.",
        requiresSignIn: true,
      };
    }

    return {
      ok: true,
      data: {
        sessions: [currentSession],
        message: "Active session metadata is displayed without exposing authentication tokens.",
        requiresSignIn: false,
      },
    };
  },

  async revokeSession(sessionId: string): Promise<SessionManagementResult<{ message: string }>> {
    const current = await this.getActiveSessions();
    if (current.ok && current.data.sessions.some((session) => session.id === sessionId && session.current)) {
      return {
        ok: false,
        message: "Use Log out to end the current desktop session safely.",
      };
    }

    const state = readState();
    writeState({
      ...state,
      revokedSessionIds: Array.from(new Set([...state.revokedSessionIds, sessionId])),
      otherSessionsRevokedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      data: {
        message: "Session revocation placeholder recorded locally. Future Supabase server checks should enforce this.",
      },
    };
  },

  async revokeOtherSessions(): Promise<SessionManagementResult<{ message: string }>> {
    const state = readState();
    writeState({
      ...state,
      otherSessionsRevokedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      data: {
        message: "Other-session revocation placeholder saved. Supabase Auth should enforce real revocation in a trusted backend flow.",
      },
    };
  },
};