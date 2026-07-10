export type ExternalLinkFailureReason =
  | "UNSAFE_EXTERNAL_URL"
  | "INTERNAL_LINK_REQUIRES_DEEP_LINK_SERVICE"
  | "EXTERNAL_URL_CANCELLED"
  | "EXTERNAL_URL_OPEN_FAILED";

export type ExternalLinkResult =
  | { ok: true; native?: boolean; url: string }
  | { ok: false; native?: boolean; reason: ExternalLinkFailureReason | string };

const allowedProtocols = new Set(["http:", "https:"]);
const internalProtocols = new Set(["picom:", "myapp:"]);
const maxExternalUrlLength = 2048;

export function normalizeUrl(url: string): string | null {
  if (typeof url !== "string") {
    return null;
  }

  const value = url.trim();
  if (!value || value.length > maxExternalUrlLength) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!allowedProtocols.has(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function isSafeUrl(url: string): boolean {
  return normalizeUrl(url) !== null;
}

export function getDisplayDomain(url: string): string {
  const safeUrl = normalizeUrl(url);
  if (!safeUrl) {
    return "Blocked link";
  }

  return new URL(safeUrl).hostname.replace(/^www\./i, "");
}

export async function confirmExternalUrlPlaceholder(_url: string): Promise<boolean> {
  return true;
}

export function getUserFriendlyError(reason: string): string {
  if (reason === "INTERNAL_LINK_REQUIRES_DEEP_LINK_SERVICE") {
    return "This Picom link must be opened inside the app.";
  }

  if (reason === "EXTERNAL_URL_CANCELLED") {
    return "External link opening was canceled.";
  }

  if (reason === "EXTERNAL_URL_OPEN_FAILED") {
    return "Picom could not open that external link.";
  }

  return "Picom blocked an unsafe external link.";
}

function getBlockedReason(url: string): ExternalLinkFailureReason {
  try {
    const parsed = new URL(url.trim());
    if (internalProtocols.has(parsed.protocol)) {
      return "INTERNAL_LINK_REQUIRES_DEEP_LINK_SERVICE";
    }
  } catch {
    // Invalid URLs are treated as unsafe external URLs.
  }

  return "UNSAFE_EXTERNAL_URL";
}

async function openViaBrowser(url: string): Promise<ExternalLinkResult> {
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) return { ok: false, reason: "EXTERNAL_URL_OPEN_FAILED" };
    opened.opener = null;
    return { ok: true, url };
  } catch {
    return { ok: false, reason: "EXTERNAL_URL_OPEN_FAILED" };
  }
}

export async function openExternalUrl(url: string): Promise<ExternalLinkResult> {
  const safeUrl = normalizeUrl(url);
  if (!safeUrl) {
    return { ok: false, reason: getBlockedReason(url) };
  }

  const confirmed = await confirmExternalUrlPlaceholder(safeUrl);
  if (!confirmed) {
    return { ok: false, reason: "EXTERNAL_URL_CANCELLED" };
  }

  const nativeOpener = window.picomDesktop?.externalLinks?.openUrl;
  if (nativeOpener) {
    const result = await nativeOpener(safeUrl);
    if (result.ok) {
      return { ok: true, native: true, url: result.url };
    }

    return { ok: false, native: true, reason: result.error };
  }

  return openViaBrowser(safeUrl);
}

export const externalLinkService = {
  normalizeUrl,
  isSafeUrl,
  getDisplayDomain,
  confirmExternalUrlPlaceholder,
  getUserFriendlyError,
  openExternalUrl,
};
