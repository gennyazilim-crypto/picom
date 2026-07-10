export type SearchRankable = Readonly<{
  id: string;
  category: string;
  label: string;
  detail: string;
}>;

const categoryWeight: Readonly<Record<string, number>> = Object.freeze({
  People: 12,
  Channels: 11,
  Communities: 10,
  Messages: 8,
  Mentions: 7,
  Saved: 6,
  Media: 5,
});

export function normalizeSearchQuery(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function fieldScore(value: string, query: string, weight = 1): number {
  const normalized = normalizeSearchQuery(value);
  if (!normalized || !query) return 0;
  if (normalized === query) return 120 * weight;
  if (normalized.startsWith(query)) return 92 * weight;
  if (normalized.split(/[^\p{L}\p{N}]+/u).some((token) => token.startsWith(query))) return 72 * weight;
  if (normalized.includes(query)) return 52 * weight;
  const queryTokens = query.split(" ").filter(Boolean);
  if (queryTokens.length > 1 && queryTokens.every((token) => normalized.includes(token))) return 38 * weight;
  return 0;
}

export function scoreSearchResult(result: SearchRankable, queryInput: string): number {
  const query = normalizeSearchQuery(queryInput);
  if (!query) return categoryWeight[result.category] ?? 0;
  const label = fieldScore(result.label.replace(/^#/, ""), query);
  const detail = fieldScore(result.detail, query, 0.35);
  return label + detail + (label > 0 || detail > 0 ? categoryWeight[result.category] ?? 0 : 0);
}

export function rankSearchResults<T extends SearchRankable>(results: readonly T[], queryInput: string): T[] {
  const query = normalizeSearchQuery(queryInput);
  return results
    .map((result, index) => ({ result, index, score: scoreSearchResult(result, query) }))
    .filter(({ score }) => !query || score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index || left.result.id.localeCompare(right.result.id))
    .map(({ result }) => result);
}
