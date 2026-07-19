import { useEffect, useMemo, useState } from "react";
import type { Community } from "../../types/community";
import { isV1CommunityKindEnabled } from "../../config/v1ReleaseScope";
import { getCommunityIconLabel, isCommunityIconImage, resolveCommunityMarkSrc } from "../../utils/generatedIdentity";
import { AppIcon } from "../AppIcon";
import { GlobalNavBadge } from "./GlobalNavBadge";

const recentCommunitiesStorageKey = "picom.global-nav.recent-communities";
const MAX_FREQUENT = 8;

function readRecentCommunityIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(recentCommunitiesStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rememberRecentCommunityId(communityId: string) {
  try {
    const next = [communityId, ...readRecentCommunityIds().filter((id) => id !== communityId)].slice(0, 24);
    window.localStorage.setItem(recentCommunitiesStorageKey, JSON.stringify(next));
  } catch {
    /* Best effort only. */
  }
}

function CommunityNavMark({ community }: { community: Community }) {
  if (isCommunityIconImage(community.icon)) {
    return <img className="global-communities-nav__avatar" src={community.icon} alt="" draggable={false} />;
  }
  return (
    <span className="global-communities-nav__monogram" style={{ background: community.accentColor }} aria-hidden="true">
      {getCommunityIconLabel(community.name, community.icon)}
    </span>
  );
}

export type GlobalCommunitiesNavProps = Readonly<{
  compact: boolean;
  active: boolean;
  disabled?: boolean;
  badge?: number | string | null;
  communities: readonly Community[];
  activeCommunityId: string | null;
  onOpenCommunities: () => void;
  onSelectCommunity: (communityId: string) => void;
}>;

export function GlobalCommunitiesNav({
  compact,
  active,
  disabled = false,
  badge = null,
  communities,
  activeCommunityId,
  onOpenCommunities,
  onSelectCommunity,
}: GlobalCommunitiesNavProps) {
  const [expanded, setExpanded] = useState(active);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentCommunityIds());

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  useEffect(() => {
    if (compact) setExpanded(false);
  }, [compact]);

  useEffect(() => {
    if (!activeCommunityId) return;
    rememberRecentCommunityId(activeCommunityId);
    setRecentIds(readRecentCommunityIds());
  }, [activeCommunityId]);

  const frequentCommunities = useMemo(() => {
    const visible = communities.filter((community) => isV1CommunityKindEnabled(community.kind));
    const byId = new Map(visible.map((community) => [community.id, community]));
    const ordered: Community[] = [];

    for (const id of recentIds) {
      const match = byId.get(id);
      if (match) {
        ordered.push(match);
        byId.delete(id);
      }
    }

    if (activeCommunityId && byId.has(activeCommunityId)) {
      ordered.unshift(byId.get(activeCommunityId)!);
      byId.delete(activeCommunityId);
    }

    for (const community of visible) {
      if (byId.has(community.id)) ordered.push(community);
    }

    return ordered.slice(0, MAX_FREQUENT);
  }, [activeCommunityId, communities, recentIds]);

  const parentActive = active || expanded;

  const selectCommunity = (communityId: string) => {
    rememberRecentCommunityId(communityId);
    setRecentIds(readRecentCommunityIds());
    onSelectCommunity(communityId);
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`global-nav-item${active ? " is-active" : ""}`}
        data-global-navigation-button="true"
        aria-label="Open communities"
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        title="Communities"
        onClick={onOpenCommunities}
      >
        <span className="global-nav-item__icon" aria-hidden="true">
          <AppIcon name="users" size="lg" />
        </span>
        <span className="global-nav-item__label">Communities</span>
        <GlobalNavBadge value={badge} destination="Communities" />
      </button>
    );
  }

  return (
    <div className={`global-settings-nav global-communities-nav${expanded ? " is-expanded" : ""}${parentActive ? " is-active" : ""}`}>
      <button
        type="button"
        className={`global-nav-item global-settings-nav__parent${parentActive ? " is-active" : ""}`}
        data-global-navigation-button="true"
        aria-label="Communities"
        aria-expanded={expanded}
        aria-controls="global-communities-submenu"
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          setExpanded((value) => {
            const next = !value;
            if (next) onOpenCommunities();
            return next;
          });
        }}
      >
        <span className="global-nav-item__icon" aria-hidden="true">
          <AppIcon name="users" size="lg" />
        </span>
        <span className="global-nav-item__label">Communities</span>
        <span className="global-communities-nav__trailing">
          <GlobalNavBadge value={badge} destination="Communities" />
          <span className={`global-settings-nav__chevron${expanded ? " is-open" : ""}`} aria-hidden="true">
            <AppIcon name="chevronDown" size="sm" />
          </span>
        </span>
      </button>

      {expanded ? (
        <div id="global-communities-submenu" className="global-settings-nav__children global-communities-nav__children" role="group" aria-label="Joined communities">
          {frequentCommunities.length ? (
            frequentCommunities.map((community) => {
              const childActive = active && community.id === activeCommunityId;
              return (
                <button
                  key={community.id}
                  type="button"
                  className={`global-settings-nav__child global-communities-nav__child${childActive ? " is-active" : ""}`}
                  data-global-navigation-button="true"
                  aria-label={`Open ${community.name}`}
                  aria-current={childActive ? "page" : undefined}
                  title={community.name}
                  onClick={() => selectCommunity(community.id)}
                >
                  <span className="global-communities-nav__mark" aria-hidden="true">
                    <CommunityNavMark community={community} />
                  </span>
                  <span className="global-settings-nav__child-label">{community.name}</span>
                </button>
              );
            })
          ) : (
            <p className="global-communities-nav__empty">Join a community to pin it here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
