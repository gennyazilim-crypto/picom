import type { DirectMessagePrivacy } from "../../types/directMessageSafety";
import type { ProfilePrivacySettings, ProfileVisibility } from "../../types/profilePrivacy";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

/**
 * PRIVACY STEP AUTH STRATEGY: INTERACTIVE_ONLY_WHEN_AUTHENTICATED
 *
 * Device first-run stays pre-login. Account privacy is never stored as a
 * first-launch device preference. The Privacy step is interactive only after
 * an authenticated session is confirmed. Anonymous first-run shows a deferred
 * review notice and does not invent local policy.
 */
export const PRIVACY_STEP_AUTH_STRATEGY = "INTERACTIVE_ONLY_WHEN_AUTHENTICATED" as const;
export const PRESENCE_PRIVACY_STATUS = "EXISTING_REAL" as const;
export const DISCOVERABILITY_STATUS = "NOT_EXPOSED" as const;
export const LAST_SEEN_CONTROL_STATUS = "NOT_EXPOSED" as const;

export type FriendRequestPrivacy = "everyone" | "community_members" | "friends_of_friends" | "nobody";

export type AccountPrivacySnapshot = Readonly<{
  accountId: string;
  friendRequestPrivacy: FriendRequestPrivacy;
  directMessagePrivacy: DirectMessagePrivacy;
  profile: ProfilePrivacySettings;
}>;

export type AccountPrivacyLoadResult =
  | Readonly<{ status: "ready"; snapshot: AccountPrivacySnapshot }>
  | Readonly<{ status: "anonymous" | "unavailable" }>;

export type AccountPrivacyUpdateResult =
  | Readonly<{ ok: true; snapshot: AccountPrivacySnapshot }>
  | Readonly<{ ok: false; reason: "anonymous" | "unavailable" | "account_changed" | "rejected" }>;

export type FirstLaunchPrivacyReadyStatus =
  | Readonly<{ status: "ready"; snapshot: AccountPrivacySnapshot }>
  | Readonly<{ status: "anonymous" | "unavailable" | "loading" | "skipped" }>;

type UnknownResult = Readonly<{ data: unknown; error: unknown }>;
type AuthUser = Readonly<{ id: string }>;
type AccountPrivacyClient = Readonly<{
  auth: Readonly<{
    getUser: () => Promise<Readonly<{ data: Readonly<{ user: AuthUser | null }>; error: unknown }>>;
    onAuthStateChange: (listener: () => void) => Readonly<{ data: Readonly<{ subscription: Readonly<{ unsubscribe: () => void }> }> }>;
  }>;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<UnknownResult>;
  from: (table: "profiles") => Readonly<{
    select: (columns: string) => Readonly<{ eq: (column: string, value: string) => Readonly<{ maybeSingle: () => Promise<UnknownResult> }> }>;
    update: (values: Record<string, unknown>) => Readonly<{
      eq: (column: string, value: string) => Readonly<{
        select: (columns: string) => Readonly<{ maybeSingle: () => Promise<UnknownResult> }>;
      }>;
    }>;
  }>;
}>;

type AccountPrivacyDependencies = Readonly<{
  isSupabase: () => boolean;
  getClient: () => AccountPrivacyClient | null;
}>;

export const FRIEND_REQUEST_POLICIES = ["everyone", "community_members", "friends_of_friends", "nobody"] as const;
export const DIRECT_MESSAGE_POLICIES = ["everyone", "friends", "no_one"] as const;
export const PROFILE_VISIBILITIES = ["everyone", "shared_communities", "friends"] as const;

const FRIEND_REQUEST_POLICY_SET = new Set<FriendRequestPrivacy>(FRIEND_REQUEST_POLICIES);
const DIRECT_MESSAGE_POLICY_SET = new Set<DirectMessagePrivacy>(DIRECT_MESSAGE_POLICIES);
const PROFILE_VISIBILITY_SET = new Set<ProfileVisibility>(PROFILE_VISIBILITIES);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function profileFromRow(value: unknown): ProfilePrivacySettings | null {
  const row = asRecord(value);
  if (!row || !PROFILE_VISIBILITY_SET.has(row.profile_visibility as ProfileVisibility)) return null;
  const flags = ["show_online_status", "show_location", "show_timezone", "show_activity", "show_media", "show_communities", "show_friends", "show_follows", "show_audio"] as const;
  if (flags.some((key) => typeof row[key] !== "boolean")) return null;
  return {
    visibility: row.profile_visibility as ProfileVisibility,
    showOnlineStatus: row.show_online_status as boolean,
    showLocation: row.show_location as boolean,
    showTimezone: row.show_timezone as boolean,
    showActivity: row.show_activity as boolean,
    showMedia: row.show_media as boolean,
    showCommunities: row.show_communities as boolean,
    showFriends: row.show_friends as boolean,
    showFollows: row.show_follows as boolean,
    showAudio: row.show_audio as boolean,
  };
}

function currentUserId(client: AccountPrivacyClient): Promise<string | null> {
  return client.auth.getUser().then(({ data, error }) => error || !data.user?.id ? null : data.user.id).catch(() => null);
}

function profileUpdateArgs(profile: ProfilePrivacySettings): Record<string, unknown> {
  return {
    next_visibility: profile.visibility,
    next_show_online_status: profile.showOnlineStatus,
    next_show_location: profile.showLocation,
    next_show_timezone: profile.showTimezone,
    next_show_activity: profile.showActivity,
    next_show_media: profile.showMedia,
    next_show_communities: profile.showCommunities,
    next_show_friends: profile.showFriends,
    next_show_follows: profile.showFollows,
    next_show_audio: profile.showAudio,
  };
}

/**
 * Strict account-privacy adapter for first-run.
 *
 * This has no first-launch storage fallback: a shared device cache must never
 * stand in for an account policy. Ready values come from the authenticated
 * session only. Mutations target that session only.
 */
export function createAccountPrivacySetupService(dependencies: AccountPrivacyDependencies) {
  const getAuthenticatedClient = async (): Promise<Readonly<{ client: AccountPrivacyClient; accountId: string }> | null> => {
    if (!dependencies.isSupabase()) return null;
    const client = dependencies.getClient();
    if (!client) return null;
    const accountId = await currentUserId(client);
    return accountId ? { client, accountId } : null;
  };

  const hydrate = async (): Promise<AccountPrivacyLoadResult> => {
    if (!dependencies.isSupabase()) return { status: "unavailable" };
    const client = dependencies.getClient();
    if (!client) return { status: "unavailable" };
    const accountId = await currentUserId(client);
    if (!accountId) return { status: "anonymous" };

    try {
      const [profileResult, directResult, friendResult] = await Promise.all([
        client.rpc("get_own_profile_privacy_v3", {}),
        client.rpc("get_direct_message_privacy", {}),
        client.from("profiles").select("friend_request_privacy").eq("id", accountId).maybeSingle(),
      ]);
      const profileRows = Array.isArray(profileResult.data) ? profileResult.data : [];
      const profile = !profileResult.error ? profileFromRow(profileRows[0]) : null;
      const directMessagePrivacy = !directResult.error && DIRECT_MESSAGE_POLICY_SET.has(directResult.data as DirectMessagePrivacy)
        ? directResult.data as DirectMessagePrivacy
        : null;
      const friendRow = asRecord(friendResult.data);
      const friendRequestPrivacy = !friendResult.error && FRIEND_REQUEST_POLICY_SET.has(friendRow?.friend_request_privacy as FriendRequestPrivacy)
        ? friendRow?.friend_request_privacy as FriendRequestPrivacy
        : null;
      const verifiedAccountId = await currentUserId(client);
      if (!verifiedAccountId) return { status: "anonymous" };
      if (verifiedAccountId !== accountId) return { status: "anonymous" };
      if (!profile || !directMessagePrivacy || !friendRequestPrivacy) return { status: "unavailable" };
      const snapshot = { accountId, profile, directMessagePrivacy, friendRequestPrivacy };
      return { status: "ready", snapshot };
    } catch {
      return { status: "unavailable" };
    }
  };

  const mutate = async (
    expectedAccountId: string,
    apply: (client: AccountPrivacyClient, current: AccountPrivacySnapshot) => Promise<AccountPrivacySnapshot | null>,
  ): Promise<AccountPrivacyUpdateResult> => {
    const authenticated = await getAuthenticatedClient();
    if (!authenticated) return dependencies.isSupabase() ? { ok: false, reason: "anonymous" } : { ok: false, reason: "unavailable" };
    if (authenticated.accountId !== expectedAccountId) return { ok: false, reason: "account_changed" };
    const loaded = await hydrate();
    if (loaded.status !== "ready") return { ok: false, reason: loaded.status === "anonymous" ? "anonymous" : "unavailable" };
    if (loaded.snapshot.accountId !== expectedAccountId) return { ok: false, reason: "account_changed" };
    const snapshot = await apply(authenticated.client, loaded.snapshot).catch(() => null);
    if (!snapshot) return { ok: false, reason: "rejected" };
    const verifiedAccountId = await currentUserId(authenticated.client);
    if (!verifiedAccountId) return { ok: false, reason: "anonymous" };
    if (verifiedAccountId !== expectedAccountId) return { ok: false, reason: "account_changed" };
    return { ok: true, snapshot };
  };

  return {
    hydrate,
    subscribeToAccountChange(listener: () => void): () => void {
      if (!dependencies.isSupabase()) return () => undefined;
      const client = dependencies.getClient();
      if (!client) return () => undefined;
      const { data } = client.auth.onAuthStateChange(listener);
      return () => data.subscription.unsubscribe();
    },
    updateFriendRequestPrivacy(expectedAccountId: string, policy: FriendRequestPrivacy): Promise<AccountPrivacyUpdateResult> {
      if (!FRIEND_REQUEST_POLICY_SET.has(policy)) return Promise.resolve({ ok: false, reason: "rejected" });
      return mutate(expectedAccountId, async (client, current) => {
        const result = await client.from("profiles").update({ friend_request_privacy: policy }).eq("id", current.accountId).select("friend_request_privacy").maybeSingle();
        const row = asRecord(result.data);
        if (result.error || !FRIEND_REQUEST_POLICY_SET.has(row?.friend_request_privacy as FriendRequestPrivacy)) return null;
        return { ...current, friendRequestPrivacy: row?.friend_request_privacy as FriendRequestPrivacy };
      });
    },
    updateDirectMessagePrivacy(expectedAccountId: string, policy: DirectMessagePrivacy): Promise<AccountPrivacyUpdateResult> {
      if (!DIRECT_MESSAGE_POLICY_SET.has(policy)) return Promise.resolve({ ok: false, reason: "rejected" });
      return mutate(expectedAccountId, async (client, current) => {
        const result = await client.rpc("update_direct_message_privacy", { next_privacy: policy });
        return result.error || result.data !== true ? null : { ...current, directMessagePrivacy: policy };
      });
    },
    updateProfile(expectedAccountId: string, patch: Partial<ProfilePrivacySettings>): Promise<AccountPrivacyUpdateResult> {
      return mutate(expectedAccountId, async (client, current) => {
        const next = { ...current.profile, ...patch };
        if (!PROFILE_VISIBILITY_SET.has(next.visibility)) return null;
        const result = await client.rpc("update_profile_privacy_v3", profileUpdateArgs(next));
        return result.error || result.data !== true ? null : { ...current, profile: next };
      });
    },
  };
}

export const accountPrivacySetupService = createAccountPrivacySetupService({
  isSupabase: () => dataSourceService.getStatus().isSupabase,
  getClient: () => getSupabaseClient() as unknown as AccountPrivacyClient | null,
});

export function friendRequestPrivacyLabelKey(policy: FriendRequestPrivacy): string {
  return `privacy.friendRequests.${policy}`;
}

export function directMessagePrivacyLabelKey(policy: DirectMessagePrivacy): string {
  return `privacy.dm.${policy}`;
}

export function profileVisibilityLabelKey(visibility: ProfileVisibility): string {
  return visibility === "shared_communities" ? "privacy.profile.sharedCommunities" : `privacy.profile.${visibility}`;
}

/** Prevent a prior account's in-memory summary from rendering after auth changes. */
export function scopePrivacyReadyStatus(
  status: FirstLaunchPrivacyReadyStatus | null,
  accountId: string | null,
): FirstLaunchPrivacyReadyStatus | null {
  if (status?.status !== "ready") return status;
  if (status.snapshot.accountId === accountId) return status;
  return accountId ? { status: "loading" } : { status: "anonymous" };
}
