import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type DirectMessagePolicy = "everyone" | "community_members" | "friends_only" | "nobody";
export type FriendRequestPolicy = "everyone" | "community_members" | "friends_of_friends" | "nobody";

export type UserSafetySettings = Readonly<{
  schemaVersion: 1;
  whoCanDmMe: DirectMessagePolicy;
  whoCanSendFriendRequests: FriendRequestPolicy;
  showOnlineStatus: boolean;
  enableReadReceipts: boolean;
  safetyTipsVisible: boolean;
}>;

const STORAGE_KEY = "picom.userSafetyCenter.v1";
type UserSafetySettingsListener = (settings: UserSafetySettings) => void;
const listeners = new Set<UserSafetySettingsListener>();
const defaults: UserSafetySettings = {
  schemaVersion: 1,
  whoCanDmMe: "community_members",
  whoCanSendFriendRequests: "community_members",
  showOnlineStatus: true,
  enableReadReceipts: false,
  safetyTipsVisible: true,
};

function normalizeSettings(value: Partial<UserSafetySettings> | null | undefined): UserSafetySettings {
  const storedFriendPolicy = value?.whoCanSendFriendRequests as FriendRequestPolicy | "friends_of_friends_placeholder" | undefined;
  return {
    ...defaults,
    ...value,
    schemaVersion: 1,
    whoCanDmMe: value?.whoCanDmMe ?? defaults.whoCanDmMe,
    whoCanSendFriendRequests: storedFriendPolicy === "friends_of_friends_placeholder" ? "friends_of_friends" : storedFriendPolicy ?? defaults.whoCanSendFriendRequests,
    showOnlineStatus: typeof value?.showOnlineStatus === "boolean" ? value.showOnlineStatus : defaults.showOnlineStatus,
    enableReadReceipts: typeof value?.enableReadReceipts === "boolean" ? value.enableReadReceipts : defaults.enableReadReceipts,
    safetyTipsVisible: typeof value?.safetyTipsVisible === "boolean" ? value.safetyTipsVisible : defaults.safetyTipsVisible,
  };
}

async function persistFriendRequestPrivacy(policy: FriendRequestPolicy): Promise<void> {
  if (!dataSourceService.getStatus().isSupabase) return;
  const client = getSupabaseClient();
  if (!client) return;
  const { data } = await client.auth.getUser();
  if (!data.user) return;
  const { error } = await client.from("profiles").update({ friend_request_privacy: policy }).eq("id", data.user.id);
  if (error) loggingService.logWarn("Friend request privacy sync failed", { code: error.code }, "privacy");
}

function readSettings(): UserSafetySettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UserSafetySettings>;
    return normalizeSettings(parsed.schemaVersion === 1 ? parsed : null);
  } catch {
    return defaults;
  }
}

function writeSettings(next: UserSafetySettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }

  emit(next);
}

function emit(next: UserSafetySettings): void {
  for (const listener of listeners) {
    listener(next);
  }
}

export const userSafetyCenterService = {
  getSettings(): UserSafetySettings {
    return readSettings();
  },

  updateSettings(partial: Partial<UserSafetySettings>): UserSafetySettings {
    const next = normalizeSettings({ ...readSettings(), ...partial });
    writeSettings(next);
    if (partial.whoCanSendFriendRequests) void persistFriendRequestPrivacy(next.whoCanSendFriendRequests);
    return next;
  },

  async refreshRemotePrivacy(): Promise<UserSafetySettings> {
    if (!dataSourceService.getStatus().isSupabase) return readSettings();
    const client = getSupabaseClient();
    if (!client) return readSettings();
    const { data: authData } = await client.auth.getUser();
    if (!authData.user) return readSettings();
    const { data, error } = await client.from("profiles").select("friend_request_privacy").eq("id", authData.user.id).maybeSingle();
    if (error || !data) return readSettings();
    const next = normalizeSettings({ ...readSettings(), whoCanSendFriendRequests: data.friend_request_privacy });
    writeSettings(next);
    return next;
  },

  resetSettings(): UserSafetySettings {
    writeSettings(defaults);
    return defaults;
  },

  subscribe(listener: UserSafetySettingsListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getPrivacySummary(blockedCount: number): string {
    const settings = readSettings();
    const dmSummary = settings.whoCanDmMe === "nobody"
      ? "DMs disabled"
      : settings.whoCanDmMe.replace(/_/g, " ");
    const readReceipts = settings.enableReadReceipts ? "read receipts on" : "read receipts off";
    return `${blockedCount} blocked users, ${dmSummary}, ${readReceipts}.`;
  }
};
