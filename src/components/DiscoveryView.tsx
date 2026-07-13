import { useEffect, useMemo, useState } from "react";
import "./DiscoveryView.css";
import type { Community } from "../types/community";
import { communityDiscoveryService, type DiscoveryCategory, type DiscoveryCommunity } from "../services/communityDiscoveryService";
import { AppIcon } from "./AppIcon";

const filters: ReadonlyArray<Readonly<{ id: DiscoveryCategory; label: string }>> = [
  { id: "development", label: "Development" },
  { id: "design", label: "Design" },
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "study", label: "Study" },
  { id: "work", label: "Work" },
];

type DiscoveryViewProps = Readonly<{
  communities: Community[];
  currentUserId: string;
  onView: (communityId: string) => void;
  onJoin: (communityId: string) => void;
  onReport: (community: DiscoveryCommunity) => void;
}>;

function formatCategory(category: DiscoveryCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function DiscoveryCommunityCard({
  item,
  joined,
  requested,
  onView,
  onJoin,
  onReport,
}: {
  item: DiscoveryCommunity;
  joined: boolean;
  requested: boolean;
  onView: () => void;
  onJoin: () => void;
  onReport: () => void;
}) {
  const primaryLabel = joined
    ? "View community"
    : requested
      ? "Request pending"
      : item.joinPolicy === "request"
        ? "Request access"
        : "Join community";

  return (
    <article className="discovery-card">
      <div className="discovery-card-banner" style={{ background: `linear-gradient(135deg, ${item.accentColor}, color-mix(in srgb, ${item.accentColor} 42%, var(--picom-teal)))` }} />
      <div className="discovery-card-body">
        <div className="discovery-card-head">
          <span className="discovery-card-icon" style={{ background: item.accentColor }}>
            {item.icon}
          </span>
          <div className="discovery-card-badges">
            <span className="discovery-badge discovery-badge--public">Public</span>
            <span className="discovery-badge">{formatCategory(item.category)}</span>
            <span className={`discovery-badge${item.joinPolicy === "request" ? " discovery-badge--request" : ""}`}>
              {item.joinPolicy === "request" ? "Request access" : "Open join"}
            </span>
          </div>
        </div>
        <h2>{item.name}</h2>
        <p>{item.description}</p>
        <div className="discovery-card-meta">
          <span>
            <AppIcon name="users" size="xs" />
            {item.memberCount} members
          </span>
        </div>
        <div className="discovery-card-actions">
          <button type="button" className="discovery-card-primary" disabled={requested} onClick={() => (joined ? onView() : onJoin())}>
            {primaryLabel}
          </button>
          <button type="button" className="discovery-card-secondary" onClick={onReport}>
            <AppIcon name="bell" size="sm" />
            Report
          </button>
        </div>
      </div>
    </article>
  );
}

export function DiscoveryView({ communities, currentUserId, onView, onJoin, onReport }: DiscoveryViewProps) {
  const [items, setItems] = useState<DiscoveryCommunity[]>([]);
  const [active, setActive] = useState<DiscoveryCategory | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let current = true;
    setLoading(true);
    void communityDiscoveryService.listPublicCommunities(communities).then((next) => {
      if (!current) return;
      setItems(next);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [communities]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<DiscoveryCategory, number>();
    for (const filter of filters) counts.set(filter.id, 0);
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, [items]);

  const cards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!active || item.category === active) &&
        (!normalized || item.name.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)),
    );
  }, [active, items, query]);

  const join = async (item: DiscoveryCommunity) => {
    const local = communities.find((community) => community.id === item.id);
    if (local) {
      onJoin(item.id);
      return;
    }
    const result = await communityDiscoveryService.joinOrRequestAccess(item.id);
    if (!result.ok) return setNotice(result.message);
    if (result.action === "requested") {
      setRequestedIds((current) => new Set(current).add(item.id));
      setNotice(`Access request sent to ${item.name}.`);
      return;
    }
    setJoinedIds((current) => new Set(current).add(item.id));
    setNotice(result.action === "already_member" ? `You are already a member of ${item.name}.` : `Joined ${item.name}. Refresh community data to open it.`);
  };

  const hasFilters = Boolean(active || query.trim());

  return (
    <main className="discovery-view">
      <header className="discovery-hero">
        <div className="discovery-hero-scene" aria-hidden="true">
          <span className="discovery-hero-orb discovery-hero-orb--one" />
          <span className="discovery-hero-orb discovery-hero-orb--two" />
          <span className="discovery-hero-orb discovery-hero-orb--three" />
          <span className="discovery-hero-mesh" />
          <span className="discovery-hero-grid" />
        </div>
        <div className="discovery-hero-inner">
          <div className="discovery-hero-main">
            <span className="discovery-mark" aria-hidden="true">
              <AppIcon name="search" size="lg" />
            </span>
            <div className="discovery-hero-copy">
              <span className="discovery-eyebrow">Approved public spaces</span>
              <h1>Discover communities</h1>
              <p>Only reviewed public profiles are listed. Private communities never appear.</p>
            </div>
          </div>
          <div className="discovery-hero-stats" aria-label="Discovery summary">
            <span className="discovery-stat">
              <strong>{items.length}</strong>
              listed
            </span>
            <span className="discovery-stat">
              <strong>{filters.length}</strong>
              categories
            </span>
          </div>
        </div>
      </header>

      <div className="discovery-body">
      <div className="discovery-controls">
        <label className="discovery-search">
          <AppIcon name="search" size="sm" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or description"
            aria-label="Search public communities"
          />
          {query ? (
            <button type="button" className="discovery-search-clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <AppIcon name="close" size="xs" />
            </button>
          ) : null}
        </label>
        <p className="discovery-results-meta" role="status">
          {loading ? "Loading listings…" : `${cards.length} of ${items.length} communities${hasFilters ? " shown" : ""}`}
        </p>
      </div>

      <nav className="discovery-filters" aria-label="Discovery categories">
        <button type="button" className={!active ? "active" : ""} onClick={() => setActive(null)}>
          All
          <span className="discovery-filter-count">{items.length}</span>
        </button>
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={active === filter.id ? "active" : ""}
            onClick={() => setActive(filter.id)}
          >
            {filter.label}
            <span className="discovery-filter-count">{categoryCounts.get(filter.id) ?? 0}</span>
          </button>
        ))}
      </nav>

      {notice ? (
        <div className="discovery-notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>
            <AppIcon name="close" size="xs" />
          </button>
        </div>
      ) : null}

      <section className="discovery-grid" aria-live="polite">
        {loading ? (
          <div className="discovery-empty">
            <strong>Loading approved listings</strong>
            <p>Private and unreviewed communities remain hidden.</p>
          </div>
        ) : cards.length ? (
          cards.map((item) => {
            const joined =
              joinedIds.has(item.id) ||
              communities.find((community) => community.id === item.id)?.members.some((member) => member.userId === currentUserId);
            const requested = requestedIds.has(item.id);
            return (
              <DiscoveryCommunityCard
                key={item.id}
                item={item}
                joined={Boolean(joined)}
                requested={requested}
                onView={() => onView(item.id)}
                onJoin={() => void join(item)}
                onReport={() => onReport(item)}
              />
            );
          })
        ) : (
          <div className="discovery-empty">
            <strong>No approved communities found</strong>
            <p>Try another search or category. Private and pending listings are intentionally excluded.</p>
            {hasFilters ? (
              <button
                type="button"
                className="discovery-empty-reset"
                onClick={() => {
                  setActive(null);
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        )}
      </section>
      </div>
    </main>
  );
}
