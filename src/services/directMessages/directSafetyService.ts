import type { DirectMessagePrivacy, DirectMuteDuration } from "../../types/directMessageSafety";
import { dataSourceService } from "../dataSourceService";
import { loggingService } from "../loggingService";
import { getSupabaseClient } from "../supabase/supabaseClient";

const STORAGE_KEY = "picom.directMessagePrivacy.v1";
const allowedPrivacy = new Set<DirectMessagePrivacy>(["everyone", "friends", "no_one"]);

function readLocalPrivacy(): DirectMessagePrivacy {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) as DirectMessagePrivacy | null;
    return value && allowedPrivacy.has(value) ? value : "everyone";
  } catch {
    return "everyone";
  }
}

function writeLocalPrivacy(value: DirectMessagePrivacy): void {
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* Restricted runtime fallback. */ }
}

export function getDirectMutedUntil(duration: DirectMuteDuration, now = Date.now()): string {
  const durationMs: Record<DirectMuteDuration, number> = {
    one_hour: 60 * 60 * 1000,
    eight_hours: 8 * 60 * 60 * 1000,
    one_day: 24 * 60 * 60 * 1000,
    until_changed: 10 * 365 * 24 * 60 * 60 * 1000,
  };
  return new Date(now + durationMs[duration]).toISOString();
}

export const directSafetyService = {
  getLocalPrivacy(): DirectMessagePrivacy { return readLocalPrivacy(); },

  async getPrivacy(): Promise<DirectMessagePrivacy> {
    if (dataSourceService.getStatus().isMock) return readLocalPrivacy();
    const client = getSupabaseClient();
    if (!client) return readLocalPrivacy();
    const { data, error } = await client.rpc("get_direct_message_privacy");
    if (error || typeof data !== "string" || !allowedPrivacy.has(data as DirectMessagePrivacy)) {
      loggingService.logWarn("Direct-message privacy refresh failed", { code: error?.code }, "privacy");
      return readLocalPrivacy();
    }
    writeLocalPrivacy(data as DirectMessagePrivacy);
    return data as DirectMessagePrivacy;
  },

  async updatePrivacy(value: DirectMessagePrivacy): Promise<{ ok: boolean; value: DirectMessagePrivacy }> {
    if (!allowedPrivacy.has(value)) return { ok: false, value: readLocalPrivacy() };
    const previous = readLocalPrivacy();
    writeLocalPrivacy(value);
    if (dataSourceService.getStatus().isMock) return { ok: true, value };
    const client = getSupabaseClient();
    if (!client) { writeLocalPrivacy(previous); return { ok: false, value: previous }; }
    const { data, error } = await client.rpc("update_direct_message_privacy", { next_privacy: value });
    if (error || data !== true) {
      writeLocalPrivacy(previous);
      loggingService.logWarn("Direct-message privacy update failed", { code: error?.code }, "privacy");
      return { ok: false, value: previous };
    }
    return { ok: true, value };
  },
};
