export const PICOM_API_VERSION = "1";
export const PICOM_API_REVISION = "2026-07-10";

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readPublicVersion(name: string, fallback: string): string {
  const value = Deno.env.get(name)?.trim();
  return value && semverPattern.test(value) ? value : fallback;
}

export function apiCompatibilityHeaders(): Record<string, string> {
  return {
    "X-Picom-API-Version": PICOM_API_VERSION,
    "X-Picom-API-Revision": PICOM_API_REVISION,
    "X-Picom-Min-Client-Version": readPublicVersion("PICOM_MINIMUM_SUPPORTED_VERSION", "0.1.0"),
    "X-Picom-Recommended-Client-Version": readPublicVersion("PICOM_RECOMMENDED_CLIENT_VERSION", "0.1.0"),
  };
}

export function requestedApiVersionIsUnsupported(request: Request): boolean {
  const requestedVersion = request.headers.get("X-Picom-API-Version")?.trim();
  return Boolean(requestedVersion && requestedVersion !== PICOM_API_VERSION);
}
