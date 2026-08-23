import { useEffect, useMemo, useState } from "react";
import "./DiscoveryView.css";
import type { Community } from "../types/community";
import { communityDiscoveryService, type DiscoveryCategory, type DiscoveryCommunity } from "../services/communityDiscoveryService";
import { AppIcon } from "./AppIcon";
import { discoveryLogoUrl } from "../config/brandAssets";
import { brandConfig } from "../config/brandConfig";
import { getCommunityIconLabel, resolveCommunityMarkSrc } from "../utils/generatedIdentity";
import discoveryHeroUrl from "../../assets/brand/discovery-hero.avif";
import { useTranslation } from "../i18n";

const filters: readonly DiscoveryCategory[] = ["development", "design", "gaming", "music", "study", "work"];

type DiscoveryViewProps = Readonly<{
  communities: Community[];
  currentUserId: string;
  onView: (communityId: string) => void;
  onJoin: (communityId: string) => void | Promise<void>;
  onReport: (community: DiscoveryCommunity) => void;
}>;

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
  const { t } = useTranslation("community");
  const markSrc = resolveCommunityMarkSrc(item);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [markSrc, item.id]);

  const showIconImage = Boolean(markSrc) && !iconFailed;
  const monogramLabel = getCommunityIconLabel(item.name, item.icon);
  const primaryLabel = joined
    ? t("discovery.enter")
    : requested
      ? t("discovery.requestPending")
      : item.joinPolicy === "request"
        ? t("discovery.requestAccess")
        : t("discovery.join");

  return (
    <article className={`discovery-card${joined ? " discovery-card--joined" : ""}`}>
      <div className="discovery-card-art">
        {item.bannerUrl ? (
          <img className="discovery-card-art__image" src={item.bannerUrl} alt="" draggable={false} decoding="async" />
        ) : (
          <span
            className="discovery-card-art__gradient"
            style={{ background: `radial-gradient(circle at 18% 16%, color-mix(in srgb, #fff 34%, transparent), transparent 30%), linear-gradient(143deg, ${item.accentColor} 0%, color-mix(in srgb, ${item.accentColor} 44%, var(--picom-orange)) 48%, color-mix(in srgb, ${item.accentColor} 20%, #15154b) 100%)` }}
          />
        )}
        <span className="discovery-card-art__mesh" aria-hidden="true" />
        <div className="discovery-card-art__top">
          <span className="discovery-card-category">{t(`discovery.category.${item.category}`)}</span>
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
            ) : monogramLabel}
          </span>
        </div>
        <div className="discovery-card-art__copy">
          <p className="discovery-card-art__eyebrow">{item.joinPolicy === "request" ? t("discovery.requestOnly") : t("discovery.openToJoin")}</p>
          <h2>{item.name}</h2>
          <p className="discovery-card-art__description">{item.description}</p>
        </div>
        <button
          type="button"
          className="discovery-card-primary"
          disabled={requested}
          onClick={() => (joined ? onView() : onJoin())}
        >
          <span>{primaryLabel}</span>
          <AppIcon name="chevronRight" size="sm" aria-hidden="true" />
        </button>
      </div>
      <footer className="discovery-card-footer">
        <span className="discovery-card-meta">
          <AppIcon name="users" size="xs" />
          {t("discovery.memberCount", { count: item.memberCount })}
        </span>
        <button
          type="button"
          className="discovery-card-secondary"
          onClick={onReport}
          aria-label={t("discovery.report", { name: item.name })}
          title={t("discovery.report")}
        >
          <AppIcon name="more" size="sm" aria-hidden="true" />
          <span className="sr-only">{t("discovery.report")}</span>
        </button>
      </footer>
    </article>
  );
}

export function DiscoveryView({ communities, currentUserId, onView, onJoin, onReport }: DiscoveryViewProps) {
  const { t } = useTranslation("community");
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
    for (const filter of filters) counts.set(filter, 0);
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
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    if (result.action === "requested") {
      setRequestedIds((current) => new Set(current).add(item.id));
      setNotice(t("discovery.requestSent", { name: item.name }));
      return;
    }
    setJoinedIds((current) => new Set(current).add(item.id));
    setNotice(result.action === "already_member" ? t("discovery.opening", { name: item.name }) : t("discovery.joined", { name: item.name }));
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
                {t("discovery.approvedSpaces")}
              </span>
              <h1>
                {t("discovery.heading")}
                <span className="discovery-hero-accent">{t("discovery.headingAccent")}</span>
              </h1>
              <p>{t("discovery.heroDescription")}</p>
            </div>
          </div>
          <div className="discovery-hero-stats" aria-label={t("discovery.summary")}>
            <span className="discovery-stat discovery-stat--listed"><strong>{items.length}</strong><span>{t("discovery.listed")}</span></span>
            <span className="discovery-stat discovery-stat--categories"><strong>{filters.length}</strong><span>{t("discovery.categories")}</span></span>
          </div>
        </div>
      </header>

      <div className="discovery-body">
        <div className="discovery-controls">
          <label className="discovery-search">
            <AppIcon name="search" size="sm" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("discovery.searchPlaceholder")} aria-label={t("discovery.search")} />
            {query ? <button type="button" className="discovery-search-clear" aria-label={t("discovery.clearSearch")} onClick={() => setQuery("")}><AppIcon name="close" size="xs" /></button> : null}
          </label>
          <p className="discovery-results-meta" role="status">{loading ? t("discovery.loading") : t("discovery.results", { shown: cards.length, total: items.length, suffix: hasFilters ? ` ${t("discovery.shown")}` : "" })}</p>
        </div>

        <nav className="discovery-filters" aria-label={t("discovery.categories")}>
          <button type="button" className={!active ? "active" : ""} onClick={() => setActive(null)}>{t("discovery.all")}<span className="discovery-filter-count">{items.length}</span></button>
          {filters.map((filter) => (
            <button key={filter} type="button" className={active === filter ? "active" : ""} onClick={() => setActive(filter)}>
              {t(`discovery.category.${filter}`)}<span className="discovery-filter-count">{categoryCounts.get(filter) ?? 0}</span>
            </button>
          ))}
        </nav>

        {notice ? <div className="discovery-notice" role="status"><span>{notice}</span><button type="button" aria-label={t("discovery.dismiss")} onClick={() => setNotice(null)}><AppIcon name="close" size="xs" /></button></div> : null}

        <section className="discovery-grid" aria-live="polite">
          {loading ? (
            <div className="discovery-empty"><strong>{t("discovery.loadingTitle")}</strong><p>{t("discovery.loadingBody")}</p></div>
          ) : loadError ? (
            <div className="discovery-empty" role="alert"><strong>{t("discovery.loadFailed")}</strong><p>{loadError}</p><button type="button" className="discovery-empty-reset" onClick={() => setReloadVersion((value) => value + 1)}>{t("discovery.tryAgain")}</button></div>
          ) : cards.length ? cards.map((item) => {
            const joined = joinedIds.has(item.id) || item.isMember || communities.find((community) => community.id === item.id)?.members.some((member) => member.userId === currentUserId);
            return <DiscoveryCommunityCard key={item.id} item={item} joined={Boolean(joined)} requested={requestedIds.has(item.id)} onView={() => onView(item.id)} onJoin={() => void join(item)} onReport={() => onReport(item)} />;
          }) : (
            <div className="discovery-empty">
              <strong>{t("discovery.emptyTitle")}</strong><p>{t("discovery.emptyBody")}</p>
              {hasFilters ? <button type="button" className="discovery-empty-reset" onClick={() => { setActive(null); setQuery(""); }}>{t("discovery.clearFilters")}</button> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
