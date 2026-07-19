import { useEffect, useMemo, useState } from "react";
import "./DiscoveryView.css";
import type { Community } from "../types/community";
import { communityDiscoveryService, type DiscoveryCategory, type DiscoveryCommunity } from "../services/communityDiscoveryService";
import { AppIcon } from "./AppIcon";
import { discoveryLogoUrl } from "../config/brandAssets";
import { brandConfig } from "../config/brandConfig";
import { getCommunityIconLabel, resolveCommunityMarkSrc } from "../utils/generatedIdentity";
import discoveryHeroUrl from "../../assets/brand/discovery-hero.avif";

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
  onJoin: (communityId: string) => void | Promise<void>;
  onReport: (community: DiscoveryCommunity) => void;
}>;

function formatCategory(category: DiscoveryCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatMemberCount(count: number) {
  return count === 1 ? "1 member" : `${count} members`;
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
  const markSrc = resolveCommunityMarkSrc(item);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [markSrc, item.id]);

  const showIconImage = Boolean(markSrc) && !iconFailed;
  const monogramLabel = getCommunityIconLabel(item.name, item.icon);

  const primaryLabel = joined
    ? "Open"
    : requested
      ? "Request pending"
      : item.joinPolicy === "request"
        ? "Request access"
        : "Join community";

  return (
    <article className={`discovery-card${joined ? " discovery-card--joined" : ""}`}>
      <div className="discovery-card-banner" style={{ background: `linear-gradient(135deg, ${item.accentColor}, color-mix(in srgb, ${item.accentColor} 42%, var(--picom-teal)))` }} />
      <div className="discovery-card-body">
        <div className="discovery-card-head">
          <span
            className={`discovery-card-icon${showIconImage ? " discovery-card-icon--avatar" : ""}`}
            style={showIconImage ? undefined : { background: item.accentColor }}
          >
            {showIconImage ? (
              <img
                key={markSrc}
                src={markSrc!}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
                onError={() => setIconFailed(true)}
              />
            ) : (
              monogramLabel
            )}
          </span>
          <div className="discovery-card-badges">
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
            {formatMemberCount(item.memberCount)}
          </span>
        </div>
        <div className="discovery-card-actions">
          <button type="button" className="discovery-card-primary" disabled={requested} onClick={() => (joined ? onView() : onJoin())}>
            {primaryLabel}
          </button>
          <button type="button" className="discovery-card-secondary" onClick={onReport}>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    void communityDiscoveryService.listPublicCommunities(communities).then((result) => {
      if (!current) return;
      if (result.ok) setItems(result.data);
      else {
        setItems([]);
        setLoadError(result.message);
      }
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [communities, reloadVersion]);

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
      await onJoin(item.id);
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
    setNotice(result.action === "already_member" ? `Opening ${item.name}.` : `Joined ${item.name}. Opening the community.`);
    await onJoin(item.id);
  };

  const hasFilters = Boolean(active || query.trim());

  return (
    <main className="discovery-view">
      <header className="discovery-hero">
        <div className="discovery-hero-scene" aria-hidden="true">
          <img className="discovery-hero-photo" src={discoveryHeroUrl} alt="" decoding="async" />
          <span className="discovery-hero-photo-shade" />
          <span className="discovery-hero-orb discovery-hero-orb--one" />
          <span className="discovery-hero-orb discovery-hero-orb--two" />
          <span className="discovery-hero-orb discovery-hero-orb--three" />
          <span className="discovery-hero-mesh" />
          <span className="discovery-hero-wave" />
          <span className="discovery-hero-spark discovery-hero-spark--a" />
          <span className="discovery-hero-spark discovery-hero-spark--b" />
          <span className="discovery-hero-spark discovery-hero-spark--c" />
        </div>
        <div className="discovery-hero-inner">
          <div className="discovery-hero-main">
            <span className="discovery-mark" aria-hidden="true">
              <img className="discovery-mark__logo" src={discoveryLogoUrl} alt="" width={52} height={52} decoding="async" />
            </span>
            <div className="discovery-hero-copy">
              <span className="discovery-eyebrow">
                <span className="discovery-eyebrow__brand">{brandConfig.name}</span>
                <span className="discovery-eyebrow__sep" aria-hidden="true" />
                Approved public spaces
              </span>
              <h1>
                Discover communities
                <span className="discovery-hero-accent">worth joining</span>
              </h1>
              <p>Browse reviewed public spaces — private communities stay private, always.</p>
            </div>
          </div>
          <div className="discovery-hero-stats" aria-label="Discovery summary">
            <span className="discovery-stat discovery-stat--listed">
              <strong>{items.length}</strong>
              <span>listed</span>
            </span>
            <span className="discovery-stat discovery-stat--categories">
              <strong>{filters.length}</strong>
              <span>categories</span>
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
        ) : loadError ? (
          <div className="discovery-empty" role="alert">
            <strong>Discovery could not be loaded</strong>
            <p>{loadError}</p>
            <button type="button" className="discovery-empty-reset" onClick={() => setReloadVersion((value) => value + 1)}>
              Try again
            </button>
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
