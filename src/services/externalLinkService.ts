export type ExternalLinkResult =
  | { ok: true; native?: boolean; url: string }
  | { ok: false; native?: boolean; reason: string };

const allowedProtocols = new Set(["http:", "https:"]);
const maxExternalUrlLength = 2048;

export function normalizeUrl(url: string): string | null {
  const value = url.trim();
  if (!value || value.length > maxExternalUrlLength) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!allowedProtocols.has(parsed.protocol)) {
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

async function openViaBrowser(url: string): Promise<ExternalLinkResult> {
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }

    return { ok: true, url };
  } catch {
    return { ok: false, reason: "EXTERNAL_URL_OPEN_FAILED" };
  }
}

export const externalLinkService = {
  normalizeUrl,
  isSafeUrl,
  getDisplayDomain,
  confirmExternalUrlPlaceholder,

  async openExternalUrl(url: string): Promise<ExternalLinkResult> {
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) {
      return { ok: false, reason: "UNSAFE_EXTERNAL_URL" };
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
};
