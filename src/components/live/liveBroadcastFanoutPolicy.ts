/**
 * Pure preference evaluation for live-start fan-out (mirrors SQL rules).
 * Server remains source of truth; this is for unit coverage of documented policy.
 */
export type LiveStartPrefMode = "all_live" | "scheduled_only" | "important_only" | "off";

export type LiveStartFanoutCandidate = Readonly<{
  preferenceMode: LiveStartPrefMode | null;
  followsBroadcaster: boolean;
  blockedEitherWay: boolean;
  canViewSession: boolean;
  isCommunityMember: boolean;
  hasLinkedOrMatchingSchedule: boolean;
  connectionNotificationsEnabled: boolean;
  recipientBanned: boolean;
}>;

/** Documented default when no preference row exists. */
export const LIVE_START_PREF_DEFAULT: LiveStartPrefMode = "all_live";

export function normalizeLiveStartPreferenceMode(raw: string | null | undefined): LiveStartPrefMode {
  const mode = String(raw ?? "").trim().toLowerCase();
  if (mode === "all") return "all_live";
  if (mode === "community_member_only") return "important_only";
  if (mode === "all_live" || mode === "scheduled_only" || mode === "important_only" || mode === "off") {
    return mode;
  }
  return LIVE_START_PREF_DEFAULT;
}

export function resolveLiveStartPreferenceMode(mode: LiveStartPrefMode | null | undefined): LiveStartPrefMode {
  if (mode === "all_live" || mode === "scheduled_only" || mode === "important_only" || mode === "off") {
    return mode;
  }
  return LIVE_START_PREF_DEFAULT;
}

export function shouldDeliverLiveStartNotification(candidate: LiveStartFanoutCandidate): boolean {
  if (!candidate.followsBroadcaster) return false;
  if (candidate.blockedEitherWay) return false;
  if (candidate.recipientBanned) return false;
  if (!candidate.canViewSession) return false;
  if (!candidate.connectionNotificationsEnabled) return false;

  const mode = resolveLiveStartPreferenceMode(candidate.preferenceMode);
  if (mode === "off") return false;
  if (mode === "scheduled_only" && !candidate.hasLinkedOrMatchingSchedule) return false;
  if (mode === "important_only" && !candidate.isCommunityMember) return false;
  return true;
}

export function buildLiveStartIdempotencyKey(sessionId: string, recipientUserId: string): string {
  return `live-start:${sessionId}:${recipientUserId}:v1`;
}
