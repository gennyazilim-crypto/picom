import { RETURN_TO_ALLOWLIST, ROUTES } from "../routes";

/**
 * Open-redirect protection: only relative paths that start with `/` and match
 * the Account Center route allowlist (exact match or nested under an allowlisted prefix).
 */
export function safeReturnTo(value: string | null | undefined, fallback: string = ROUTES.accountOverview): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("@")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;

  let pathname = trimmed;
  let search = "";
  let hash = "";
  const hashIndex = pathname.indexOf("#");
  if (hashIndex >= 0) {
    hash = pathname.slice(hashIndex);
    pathname = pathname.slice(0, hashIndex);
  }
  const searchIndex = pathname.indexOf("?");
  if (searchIndex >= 0) {
    search = pathname.slice(searchIndex);
    pathname = pathname.slice(0, searchIndex);
  }

  if (!pathname.startsWith("/") || pathname.includes("..")) return fallback;

  const allowed = RETURN_TO_ALLOWLIST.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!allowed) return fallback;

  return `${pathname}${search}${hash}`;
}
