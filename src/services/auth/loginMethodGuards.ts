/**
 * Pure guards for provider unlink / last-login-method protection.
 * At least one usable sign-in method must remain after any unlink.
 */

export type LoginMethodSnapshot = Readonly<{
  hasPassword: boolean;
  linkedProviders: readonly string[];
}>;

export function countUsableLoginMethods(snapshot: LoginMethodSnapshot): number {
  const providers = new Set(
    snapshot.linkedProviders
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0 && p !== "email"),
  );
  return (snapshot.hasPassword ? 1 : 0) + providers.size;
}

export function canUnlinkProvider(
  snapshot: LoginMethodSnapshot,
  provider: string,
): { ok: true } | { ok: false; reason: "not_linked" | "last_method" } {
  const normalized = provider.trim().toLowerCase();
  const linked = new Set(
    snapshot.linkedProviders.map((p) => p.trim().toLowerCase()).filter(Boolean),
  );
  if (!linked.has(normalized)) return { ok: false, reason: "not_linked" };

  const remainingProviders = [...linked].filter((p) => p !== normalized);
  const remaining: LoginMethodSnapshot = {
    hasPassword: snapshot.hasPassword,
    linkedProviders: remainingProviders,
  };
  if (countUsableLoginMethods(remaining) < 1) {
    return { ok: false, reason: "last_method" };
  }
  return { ok: true };
}
