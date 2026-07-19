export const identityPalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"] as const;

export function hashString(value: string) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getInitials(value: string, fallback = "P") {
  const source = value.trim() || fallback;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getIdentityColor(seed: string) {
  return identityPalette[hashString(seed) % identityPalette.length];
}

export function getIdentityGradient(seed: string) {
  const color = getIdentityColor(seed);
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))`;
}

/** True when the value is an image URL/data URI rather than a monogram label. */
export function isCommunityIconImage(icon?: string | null): boolean {
  const value = icon?.trim() ?? "";
  if (!value || value.length < 8) return false;
  if (/^data:image\//i.test(value)) return true;
  if (/^blob:/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getCommunityIconLabel(name: string, icon?: string) {
  // Never render a URL as monogram text (e.g. "HT" from https://...).
  if (isCommunityIconImage(icon)) return getInitials(name, "P").slice(0, 1);
  const trimmed = icon?.trim() ?? "";
  if (!trimmed || trimmed.length > 4) return getInitials(name, "P").slice(0, 1);
  return trimmed.slice(0, 2).toUpperCase();
}

/** Prefer a stored icon URL; otherwise fall back to a single-letter monogram. */
export function resolveCommunityIcon(name: string, iconUrl?: string | null): string {
  const value = iconUrl?.trim() ?? "";
  if (isCommunityIconImage(value)) return value;
  return getCommunityIconLabel(name);
}

/** Image src for community marks, or null when a monogram should be shown. */
export function resolveCommunityMarkSrc(community: Readonly<{ icon?: string | null; name?: string }>): string | null {
  const value = community.icon?.trim() ?? "";
  return isCommunityIconImage(value) ? value : null;
}
