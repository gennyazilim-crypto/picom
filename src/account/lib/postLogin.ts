import type { Session } from "@supabase/supabase-js";
import { ROUTES } from "../routes";
import { safeReturnTo } from "./returnTo";
import { getAccountSupabase } from "./supabase";

export type PostLoginDestination =
  | { path: string; reason: "mfa_required" | "profile_incomplete" | "deactivated" | "return_to" | "overview" };

/**
 * Soft email verification: never redirect to a verification wall.
 * Email ownership is encouraged via banners / Account Center, not login gates.
 */
export async function resolvePostLoginDestination(
  session: Session,
  returnToRaw: string | null,
): Promise<PostLoginDestination> {
  const supabase = getAccountSupabase();
  const user = session.user;

  try {
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal.error && aal.data.currentLevel === "aal1" && aal.data.nextLevel === "aal2") {
      return { path: ROUTES.mfaChallenge, reason: "mfa_required" };
    }
  } catch {
    // MFA API unavailable — continue.
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed_at,onboarding_completed,deactivated_at")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as {
    profile_completed_at?: string | null;
    onboarding_completed?: boolean | null;
    deactivated_at?: string | null;
  } | null;

  if (row?.deactivated_at) {
    return { path: ROUTES.deactivate, reason: "deactivated" };
  }

  const completed = Boolean(row?.profile_completed_at || row?.onboarding_completed);
  if (!completed) {
    return { path: ROUTES.profileSetup, reason: "profile_incomplete" };
  }

  const returnTo = safeReturnTo(returnToRaw, ROUTES.accountOverview);
  if (returnTo !== ROUTES.accountOverview) {
    return { path: returnTo, reason: "return_to" };
  }

  return { path: ROUTES.accountOverview, reason: "overview" };
}
