import { useEffect, useMemo, useState } from "react";
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
    return () => { current = false; };
  }, [communities]);

  const cards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => (!active || item.category === active) && (!normalized || item.name.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)));
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

  return <main className="discovery-view"><header><span className="discovery-mark"><AppIcon name="search" size="xl" /></span><div><span className="eyebrow">Approved public spaces</span><h1>Discover communities</h1><p>Only reviewed public profiles are listed. Private communities never appear.</p></div></header><nav aria-label="Discovery categories"><label className="member-search"><AppIcon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search public communities" aria-label="Search public communities" /></label><button className={!active ? "active" : ""} onClick={() => setActive(null)}>All</button>{filters.map((filter) => <button key={filter.id} className={active === filter.id ? "active" : ""} onClick={() => setActive(filter.id)}>{filter.label}</button>)}</nav>{notice ? <p className="bots-admin-notice" role="status">{notice}</p> : null}<section className="discovery-grid">{loading ? <div className="placeholder-panel"><strong>Loading approved listings</strong><p>Private and unreviewed communities remain hidden.</p></div> : cards.length ? cards.map((item) => { const joined = joinedIds.has(item.id) || communities.find((community) => community.id === item.id)?.members.some((member) => member.userId === currentUserId); const requested = requestedIds.has(item.id); return <article key={item.id}><span className="discovery-card-icon" style={{ background: item.accentColor }}>{item.icon}</span><div><span className="discovery-status">Public - {item.category} - {item.joinPolicy === "request" ? "Request access" : "Open join"}</span><h2>{item.name}</h2><p>{item.description}</p><small>{item.memberCount} members</small></div><div className="settings-actions-row" style={{ gridColumn: "1 / -1" }}><button onClick={() => joined ? onView(item.id) : void join(item)} disabled={requested}>{joined ? "View community" : requested ? "Request pending" : item.joinPolicy === "request" ? "Request access" : "Join community"}</button><button className="secondary-action" onClick={() => onReport(item)}><AppIcon name="bell" size="sm" />Report</button></div></article>; }) : <div className="placeholder-panel"><strong>No approved communities found</strong><p>Try another search or category. Private and pending listings are intentionally excluded.</p></div>}</section></main>;
}

