import { getSupabaseClient } from "../supabase/supabaseClient";
import { loggingService } from "../loggingService";
import type { OnboardingCompletion, OnboardingRecord } from "../../types/onboarding";

export type OnboardingErrorCode =
  | "ONBOARDING_SESSION_MISSING"
  | "ONBOARDING_CONFIG_MISSING"
  | "ONBOARDING_PROFILE_UPSERT_FAILED"
  | "ONBOARDING_PROFILE_RLS_DENIED"
  | "ONBOARDING_FOLLOWS_FAILED"
  | "ONBOARDING_TIMEOUT"
  | "ONBOARDING_NETWORK"
  | "ONBOARDING_USERNAME_TAKEN"
  | "ONBOARDING_VALIDATION"
  | "ONBOARDING_UNKNOWN";

type OnboardingServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{
      ok: false;
      error: string;
      code: OnboardingErrorCode;
      sessionMissing?: boolean;
    }>;

const ONBOARDING_TIMEOUT_MS = 20_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DRAFT_PREFIX = "picom.onboarding.draft.v1.";

type OnboardingDraft = Readonly<{
  stepIndex: number;
  profile: OnboardingCompletion["profile"];
  startChoice: OnboardingCompletion["startChoice"];
  inviteCode: string;
  followedUserIds: string[];
  theme: OnboardingCompletion["theme"];
  updatedAt: string;
}>;

type RpcPersistedRow = Readonly<{
  completed?: boolean;
  completed_at?: string;
  followed_user_ids?: string[] | null;
  theme_mode?: string;
  initial_feed?: string;
  start_choice?: string;
}>;

type SupabaseRpcError = Readonly<{
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}>;

async function withTimeout<T>(thenable: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(thenable),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ONBOARDING_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeFollowUserIds(ids: readonly string[] | null | undefined): string[] {
  const unique = new Set<string>();
  for (const id of ids ?? []) {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (UUID_RE.test(trimmed)) unique.add(trimmed.toLowerCase());
  }
  return [...unique];
}

function draftKey(userId: string): string {
  return `${DRAFT_PREFIX}${userId}`;
}

function userFacingMessage(code: OnboardingErrorCode): string {
  if (code === "ONBOARDING_SESSION_MISSING") {
    return "Your session expired. Sign in again to finish setup.";
  }
  if (code === "ONBOARDING_USERNAME_TAKEN") {
    return "That username is already taken. Choose another and try again.";
  }
  if (code === "ONBOARDING_VALIDATION") {
    return "Check your profile details and try again.";
  }
  return "Your setup could not be saved. Please try again.";
}

function mapRpcError(error: SupabaseRpcError | null | undefined): OnboardingErrorCode {
  const blob = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toUpperCase();
  if (blob.includes("AUTH_REQUIRED") || blob.includes("JWT") || blob.includes("NOT AUTHENTICATED")) {
    return "ONBOARDING_SESSION_MISSING";
  }
  if (blob.includes("42501") || blob.includes("RLS") || blob.includes("PERMISSION") || blob.includes("POLICY")) {
    return "ONBOARDING_PROFILE_RLS_DENIED";
  }
  if (blob.includes("ONBOARDING_USERNAME_TAKEN") || blob.includes("23505")) {
    return "ONBOARDING_USERNAME_TAKEN";
  }
  if (
    blob.includes("ONBOARDING_DISPLAY_NAME_INVALID")
    || blob.includes("ONBOARDING_USERNAME_INVALID")
    || blob.includes("ONBOARDING_STATUS_INVALID")
    || blob.includes("ONBOARDING_THEME_INVALID")
    || blob.includes("ONBOARDING_START_CHOICE_INVALID")
    || blob.includes("ONBOARDING_PROFILE_INVALID")
    || blob.includes("ONBOARDING_PROFILE_FIELD_INVALID")
    || blob.includes("22023")
  ) {
    return "ONBOARDING_VALIDATION";
  }
  if (blob.includes("FOLLOW") || blob.includes("ONBOARDING_FOLLOW")) {
    return "ONBOARDING_FOLLOWS_FAILED";
  }
  return "ONBOARDING_PROFILE_UPSERT_FAILED";
}

function parsePersistedRow(data: unknown): RpcPersistedRow | undefined {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? (first as RpcPersistedRow) : undefined;
  }
  if (data && typeof data === "object") {
    return data as RpcPersistedRow;
  }
  return undefined;
}

function logOnboardingFailure(input: {
  code: OnboardingErrorCode;
  operation: string;
  userId: string | null;
  error?: SupabaseRpcError | null;
  payloadFields?: readonly string[];
}): void {
  loggingService.logError(
    "Onboarding persistence failed",
    {
      code: input.code,
      operation: input.operation,
      authenticatedUserId: input.userId,
      supabaseCode: input.error?.code ?? null,
      message: input.error?.message ?? null,
      details: input.error?.details ?? null,
      hint: input.error?.hint ?? null,
      payloadFields: input.payloadFields ?? [],
    },
    "onboardingService",
  );
}

export const onboardingDraftStore = {
  load(userId: string): OnboardingDraft | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(draftKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OnboardingDraft;
      if (!parsed || typeof parsed !== "object" || !parsed.profile) return null;
      return {
        ...parsed,
        followedUserIds: normalizeFollowUserIds(parsed.followedUserIds),
      };
    } catch {
      return null;
    }
  },
  save(userId: string, draft: Omit<OnboardingDraft, "updatedAt">): void {
    if (typeof localStorage === "undefined") return;
    try {
      const payload: OnboardingDraft = {
        ...draft,
        followedUserIds: normalizeFollowUserIds(draft.followedUserIds),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey(userId), JSON.stringify(payload));
    } catch {
      // Draft persistence is best-effort.
    }
  },
  clear(userId: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(draftKey(userId));
    } catch {
      // ignore
    }
  },
};

export const onboardingService = {
  async getState(userId: string): Promise<OnboardingServiceResult<OnboardingRecord>> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        ok: false,
        error: "Picom could not check first-run setup. Check the Supabase configuration.",
        code: "ONBOARDING_CONFIG_MISSING",
      };
    }

    try {
      const [profileResult, followingResult] = await withTimeout(
        Promise.all([
          Promise.resolve(
            client
              .from("profiles")
              .select("onboarding_completed,onboarding_completed_at,display_name,username,status_text")
              .eq("id", userId)
              .maybeSingle(),
          ),
          Promise.resolve(client.from("user_follows").select("followed_id").eq("follower_id", userId)),
        ]) as Promise<[
          {
            data: {
              onboarding_completed: boolean;
              onboarding_completed_at: string | null;
              display_name: string;
              username: string;
              status_text: string;
            } | null;
            error: SupabaseRpcError | null;
          },
          { data: { followed_id: string }[] | null; error: SupabaseRpcError | null },
        ]>,
        ONBOARDING_TIMEOUT_MS,
      );

      if (profileResult.error) {
        const code = mapRpcError(profileResult.error);
        logOnboardingFailure({
          code,
          operation: "getState.profiles",
          userId,
          error: profileResult.error,
          payloadFields: ["userId"],
        });
        return { ok: false, error: "Picom could not load your onboarding status.", code };
      }

      // Missing profile is incomplete onboarding, not a hard failure — Finish upserts it.
      if (!profileResult.data) {
        return {
          ok: true,
          data: {
            completed: false,
            completedAt: null,
            followedUserIds: normalizeFollowUserIds((followingResult.data ?? []).map((row) => row.followed_id)),
            profile: null,
            provider: "supabase",
          },
        };
      }

      if (followingResult.error) {
        logOnboardingFailure({
          code: "ONBOARDING_FOLLOWS_FAILED",
          operation: "getState.user_follows",
          userId,
          error: followingResult.error,
          payloadFields: ["userId"],
        });
      }

      const data = profileResult.data;
      const record: OnboardingRecord = {
        completed: data.onboarding_completed,
        completedAt: data.onboarding_completed_at,
        followedUserIds: followingResult.error
          ? []
          : normalizeFollowUserIds((followingResult.data ?? []).map((row) => row.followed_id)),
        profile: {
          displayName: data.display_name,
          username: data.username,
          statusText: data.status_text,
        },
        provider: "supabase",
      };
      return { ok: true, data: record };
    } catch (error) {
      const code = error instanceof Error && error.message === "ONBOARDING_TIMEOUT"
        ? "ONBOARDING_TIMEOUT"
        : "ONBOARDING_NETWORK";
      logOnboardingFailure({ code, operation: "getState", userId, payloadFields: ["userId"] });
      return {
        ok: false,
        error: "Picom could not load your onboarding status. Check your connection and try again.",
        code,
      };
    }
  },

  async complete(userId: string, input: OnboardingCompletion): Promise<OnboardingServiceResult<OnboardingRecord>> {
    const displayName = input.profile.displayName.trim();
    if (!displayName) {
      return { ok: false, error: "Display name is required.", code: "ONBOARDING_VALIDATION" };
    }

    const username = input.profile.username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 32);

    const followedUserIds = normalizeFollowUserIds(input.followedUserIds);
    const completedAt = new Date().toISOString();
    let record: OnboardingRecord = {
      completed: true,
      completedAt,
      followedUserIds,
      profile: { ...input.profile, displayName, username },
      provider: "supabase",
    };

    const client = getSupabaseClient();
    if (!client) {
      return {
        ok: false,
        error: "Picom could not save first-run setup. Check the Supabase configuration.",
        code: "ONBOARDING_CONFIG_MISSING",
      };
    }

    const payloadFields = [
      "target_profile",
      "target_followed_user_ids",
      "target_theme",
      "target_start_choice",
      "target_invite_code",
    ] as const;

    try {
      const sessionResult = await withTimeout(
        Promise.resolve(client.auth.getSession()) as Promise<{
          data: { session: { user: { id: string }; expires_at?: number } | null };
          error: SupabaseRpcError | null;
        }>,
        ONBOARDING_TIMEOUT_MS,
      );

      let session = sessionResult.data.session;
      if (sessionResult.error || !session?.user?.id) {
        logOnboardingFailure({
          code: "ONBOARDING_SESSION_MISSING",
          operation: "complete.getSession",
          userId,
          error: sessionResult.error,
          payloadFields,
        });
        return {
          ok: false,
          error: userFacingMessage("ONBOARDING_SESSION_MISSING"),
          code: "ONBOARDING_SESSION_MISSING",
          sessionMissing: true,
        };
      }

      const expiresAtMs = typeof session.expires_at === "number" ? session.expires_at * 1000 : null;
      if (expiresAtMs !== null && expiresAtMs - Date.now() < 60_000) {
        const refreshed = await withTimeout(
          Promise.resolve(client.auth.refreshSession()) as Promise<{
            data: { session: { user: { id: string }; expires_at?: number } | null };
            error: SupabaseRpcError | null;
          }>,
          ONBOARDING_TIMEOUT_MS,
        );
        if (refreshed.error || !refreshed.data.session?.user?.id) {
          logOnboardingFailure({
            code: "ONBOARDING_SESSION_MISSING",
            operation: "complete.refreshSession",
            userId,
            error: refreshed.error,
            payloadFields,
          });
          return {
            ok: false,
            error: userFacingMessage("ONBOARDING_SESSION_MISSING"),
            code: "ONBOARDING_SESSION_MISSING",
            sessionMissing: true,
          };
        }
        session = refreshed.data.session;
      }

      const authenticatedUserId = session.user.id;
      if (authenticatedUserId !== userId) {
        logOnboardingFailure({
          code: "ONBOARDING_SESSION_MISSING",
          operation: "complete.userMismatch",
          userId: authenticatedUserId,
          payloadFields,
        });
        return {
          ok: false,
          error: userFacingMessage("ONBOARDING_SESSION_MISSING"),
          code: "ONBOARDING_SESSION_MISSING",
          sessionMissing: true,
        };
      }

      const { data, error } = await withTimeout(
        Promise.resolve(
          client.rpc("complete_current_user_onboarding", {
            target_profile: {
              displayName,
              username,
              statusText: input.profile.statusText.trim(),
            },
            target_followed_user_ids: followedUserIds,
            target_theme: input.theme,
            target_start_choice: input.startChoice,
            target_invite_code: input.inviteCode?.trim() || null,
          }),
        ) as Promise<{ data: unknown; error: SupabaseRpcError | null }>,
        ONBOARDING_TIMEOUT_MS,
      );

      const persisted = parsePersistedRow(data);
      if (error || !persisted?.completed) {
        const code = mapRpcError(error);
        logOnboardingFailure({
          code,
          operation: "complete.rpc",
          userId: authenticatedUserId,
          error,
          payloadFields,
        });
        return {
          ok: false,
          error: userFacingMessage(code),
          code,
          sessionMissing: code === "ONBOARDING_SESSION_MISSING",
        };
      }

      record = {
        ...record,
        completedAt: persisted.completed_at ?? completedAt,
        followedUserIds: normalizeFollowUserIds(persisted.followed_user_ids ?? followedUserIds),
      };
      return { ok: true, data: record };
    } catch (error) {
      const code = error instanceof Error && error.message === "ONBOARDING_TIMEOUT"
        ? "ONBOARDING_TIMEOUT"
        : "ONBOARDING_NETWORK";
      logOnboardingFailure({
        code,
        operation: "complete",
        userId,
        payloadFields,
      });
      return {
        ok: false,
        error: "Your setup could not be saved. Please try again.",
        code,
      };
    }
  },
};
