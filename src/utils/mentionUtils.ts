export const MAX_VISIBLE_MENTION_COUNT = 99;

export function normalizeMentionCount(count?: number | null): number {
  if (!count || Number.isNaN(count)) return 0;
  return Math.max(0, Math.floor(count));
}

export function formatMentionBadge(count?: number | null): string {
  const normalized = normalizeMentionCount(count);
  if (normalized <= 0) return "";
  return normalized > MAX_VISIBLE_MENTION_COUNT ? `${MAX_VISIBLE_MENTION_COUNT}+` : String(normalized);
}

export function formatMentionLabel(count?: number | null): string {
  const normalized = normalizeMentionCount(count);
  if (normalized <= 0) return "No mentions";
  return `${normalized} mention${normalized === 1 ? "" : "s"}`;
}

export function messageMentionsUser(body: string, username: string, displayName: string): boolean {
  const normalizedBody = body.toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedDisplayName = displayName.trim().toLowerCase();

  return Boolean(
    normalizedUsername && normalizedBody.includes(`@${normalizedUsername}`),
  ) || Boolean(
    normalizedDisplayName && normalizedBody.includes(`@${normalizedDisplayName}`),
  );
}
