import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { OnboardingCompletion, OnboardingRecord } from "../../types/onboarding";

const STORAGE_PREFIX = "picom:first-run-onboarding:v1";

type OnboardingServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: string }>;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function readLocalRecord(userId: string): OnboardingRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingRecord>;
    return {
      completed: parsed.completed === true,
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      followedUserIds: Array.isArray(parsed.followedUserIds)
        ? parsed.followedUserIds.filter((value): value is string => typeof value === "string")
        : [],
      profile:
        parsed.profile && typeof parsed.profile === "object"
          ? {
              displayName: typeof parsed.profile.displayName === "string" ? parsed.profile.displayName : "",
              username: typeof parsed.profile.username === "string" ? parsed.profile.username : "",
              statusText: typeof parsed.profile.statusText === "string" ? parsed.profile.statusText : "",
            }
          : null,
      provider: parsed.provider === "supabase" ? "supabase" : "mock",
    };
  } catch {
    return null;
  }
}

function writeLocalRecord(userId: string, record: OnboardingRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(record));
  } catch {
    // Onboarding persistence remains best effort in restricted storage environments.
  }
}

export const onboardingService = {
  async getState(userId: string): Promise<OnboardingServiceResult<OnboardingRecord>> {
    const source = dataSourceService.getStatus();

    if (source.isMock) {
      const localRecord = readLocalRecord(userId);
      return {
        ok: true,
        data: localRecord ?? { completed: false, completedAt: null, followedUserIds: [], profile: null, provider: "mock" },
      };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Picom could not check first-run setup. Check the Supabase configuration." };

    const [profileResult, followingResult] = await Promise.all([
      client.from("profiles").select("onboarding_completed,onboarding_completed_at,display_name,username,status_text").eq("id", userId).maybeSingle(),
      client.from("user_follows").select("followed_id").eq("follower_id", userId),
    ]);

    if (profileResult.error || !profileResult.data || followingResult.error) return { ok: false, error: "Picom could not load your onboarding status." };
    const data = profileResult.data;

    const record: OnboardingRecord = {
      completed: data.onboarding_completed,
      completedAt: data.onboarding_completed_at,
      followedUserIds: (followingResult.data ?? []).map((row) => row.followed_id),
      profile: {
        displayName: data.display_name,
        username: data.username,
        statusText: data.status_text,
      },
      provider: "supabase",
    };
    return { ok: true, data: record };
  },

  async complete(userId: string, input: OnboardingCompletion): Promise<OnboardingServiceResult<OnboardingRecord>> {
    const displayName = input.profile.displayName.trim();
    if (!displayName) return { ok: false, error: "Display name is required." };
    const username = input.profile.username.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 32);

    const completedAt = new Date().toISOString();
    const source = dataSourceService.getStatus();
    let record: OnboardingRecord = {
      completed: true,
      completedAt,
      followedUserIds: [...new Set(input.followedUserIds)],
      profile: { ...input.profile, displayName, username },
      provider: source.isSupabase ? "supabase" : "mock",
    };

    if (source.isSupabase) {
      const client = getSupabaseClient();
      if (!client) return { ok: false, error: "Picom could not save first-run setup. Check the Supabase configuration." };

      const { data, error } = await client.rpc("complete_current_user_onboarding", {
        target_profile: { displayName, username, statusText: input.profile.statusText.trim() },
        target_followed_user_ids: record.followedUserIds,
        target_theme: input.theme,
      });
      const persisted = Array.isArray(data) ? data[0] : undefined;
      if (error || !persisted?.completed) return { ok: false, error: "Picom could not save your onboarding choices." };
      record = {
        ...record,
        completedAt: persisted.completed_at,
        followedUserIds: persisted.followed_user_ids,
      };
    }

    if (source.isMock) writeLocalRecord(userId, record);
    return { ok: true, data: record };
  },

  resetForTesting(userId: string): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(userId));
  },
};
