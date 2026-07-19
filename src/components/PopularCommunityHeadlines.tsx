import { useMemo } from "react";
import type { Community } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { getCommunityIconLabel } from "../utils/generatedIdentity";

export type PopularHeadline = Readonly<{
  id: string;
  title: string;
  excerpt: string;
  icon: string;
  accentColor: string;
  reactionCount: number;
  commentCount: number;
  createdAt: string;
  popularityScore: number;
  source: MentionItem;
}>;

function getReactionTotal(item: MentionItem): number {
  return item.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0;
}

function formatRelative(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "now";
  const deltaMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (deltaMinutes < 1) return "now";
  if (deltaMinutes < 60) return `${deltaMinutes}m`;
  const hours = Math.floor(deltaMinutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function rankPopularCommunityHeadlines(
  items: readonly MentionItem[],
  communities: readonly Community[],
  limit = 8,
): PopularHeadline[] {
  return items
    .filter((item) => item.source === "popular_feed" && (item.title || item.body.trim()))
    .map((item) => {
      const community = communities.find((candidate) => candidate.id === item.communityId);
      const title = item.title?.trim() || item.body.trim().split(/\n+/)[0]?.slice(0, 72) || "Untitled post";
      return {
        id: item.id,
        title,
        excerpt: item.body.trim().replace(/\s+/g, " ").slice(0, 110),
        icon: community?.icon ?? getCommunityIconLabel(title),
        accentColor: community?.accentColor ?? "var(--picom-teal)",
        reactionCount: getReactionTotal(item),
        commentCount: item.commentCount ?? 0,
        createdAt: item.createdAt,
        popularityScore: item.popularityScore ?? 0,
        source: item,
      };
    })
    .sort((left, right) =>
      right.reactionCount - left.reactionCount ||
      right.popularityScore - left.popularityScore ||
      right.commentCount - left.commentCount ||
      Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )
    .slice(0, limit);
}

type PopularCommunityHeadlinesProps = Readonly<{
  items: readonly MentionItem[];
  communities: readonly Community[];
  onOpenItem: (item: MentionItem) => void;
}>;

export function PopularCommunityHeadlines({
  items,
  communities,
  onOpenItem,
}: PopularCommunityHeadlinesProps) {
  const headlines = useMemo(
    () => rankPopularCommunityHeadlines(items, communities, 8),
    [items, communities],
  );

  return (
    <section className="mention-panel-card popular-headlines" aria-label="Populer Basliklar">
      <div className="popular-headlines__head">
        <p className="eyebrow">Populer Basliklar</p>
        <span>{headlines.length}</span>
      </div>
      {!headlines.length ? (
        <p className="popular-headlines__empty">Henuz yeterli begeni alan yazi yok.</p>
      ) : null}
      <ol className="popular-headlines__list">
        {headlines.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              className="popular-headlines__item is-post"
              onClick={() => onOpenItem(item.source)}
              title={item.title}
            >
              <span className="popular-headlines__rank" aria-hidden="true">{index + 1}</span>
              <span className="popular-headlines__icon" style={{ background: item.accentColor }} aria-hidden="true">
                {getCommunityIconLabel(item.title, item.icon)}
              </span>
              <span className="popular-headlines__copy">
                <strong>{item.title}</strong>
                <small>{item.reactionCount} begeni · {item.commentCount} yorum · {formatRelative(item.createdAt)}</small>
                <em>{item.excerpt}</em>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
