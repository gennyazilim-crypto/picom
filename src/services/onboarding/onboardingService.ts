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
    const localRecord = readLocalRecord(userId);
    const source = dataSourceService.getStatus();

    if (source.isMock) {
      return {
        ok: true,
        data: localRecord ?? { completed: false, completedAt: null, followedUserIds: [], provider: "mock" },
      };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Picom could not check first-run setup. Check the Supabase configuration." };

    const { data, error } = await client
      .from("profiles")
      .select("onboarding_completed,onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      if (localRecord) return { ok: true, data: localRecord };
      return { ok: false, error: "Picom could not load your onboarding status." };
    }

    const record: OnboardingRecord = {
      completed: data.onboarding_completed,
      completedAt: data.onboarding_completed_at,
      followedUserIds: localRecord?.followedUserIds ?? [],
      provider: "supabase",
    };
    writeLocalRecord(userId, record);
    return { ok: true, data: record };
  },

  async complete(userId: string, input: OnboardingCompletion): Promise<OnboardingServiceResult<OnboardingRecord>> {
    const displayName = input.profile.displayName.trim();
    if (!displayName) return { ok: false, error: "Display name is required." };

    const completedAt = new Date().toISOString();
    const source = dataSourceService.getStatus();
    const record: OnboardingRecord = {
      completed: true,
      completedAt,
      followedUserIds: [...new Set(input.followedUserIds)],
      provider: source.isSupabase ? "supabase" : "mock",
    };

    if (source.isSupabase) {
      const client = getSupabaseClient();
      if (!client) return { ok: false, error: "Picom could not save first-run setup. Check the Supabase configuration." };

      const { error } = await client
        .from("profiles")
        .update({
          display_name: displayName,
          status_text: input.profile.statusText.trim(),
          onboarding_completed: true,
          onboarding_completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", userId);

      if (error) return { ok: false, error: "Picom could not save your onboarding choices." };
    }

    // user_follows is not in the current baseline schema; suggestions remain local until that table lands.
    writeLocalRecord(userId, record);
    return { ok: true, data: record };
  },

  resetForTesting(userId: string): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(userId));
  },
};
