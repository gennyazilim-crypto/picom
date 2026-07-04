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

export function getCommunityIconLabel(name: string, icon?: string) {
  return (icon?.trim() || getInitials(name, "P").slice(0, 1)).slice(0, 2).toUpperCase();
}