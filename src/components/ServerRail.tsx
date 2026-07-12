import type { CSSProperties, MouseEvent } from "react";
import type { Community } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { getCommunityIconLabel } from "../utils/generatedIdentity";
import { getCommunityVerificationSummary, getVerificationType } from "../utils/verificationHelpers";
import { isV1CommunityKindEnabled, isV1FeatureEnabled } from "../config/v1ReleaseScope";

const railIcons = mvpUiIconMap.serverRail;

type ServerRailProps = {
  communities: Community[];
  activeCommunityId: string;
  onSelectCommunity: (id: string) => void;
  onOpenDiscovery: () => void;
  onUtilityAction?: (label: string) => void;
  onContextMenu: (event: MouseEvent, community: Community) => void;
};

export function ServerRail({ communities, activeCommunityId, onSelectCommunity, onOpenDiscovery, onUtilityAction, onContextMenu }: ServerRailProps) {
  const visibleCommunities = communities.filter((community) => isV1CommunityKindEnabled(community.kind));
  return (
    <nav className="server-rail" aria-label="Community switcher">
      <div className="server-stack" style={{ flex: "1 1 auto" }}>
        {visibleCommunities.map((community) => (
          <button
            key={community.id}
            className={`server-button ${community.id === activeCommunityId ? "active" : ""}`}
            style={{ "--server-accent": community.accentColor } as CSSProperties}
            title={`${community.name}${getVerificationType(getCommunityVerificationSummary(community.id, [], community.verification)) === "official_community" ? " / Official community" : ""}`}
            aria-label={`Open ${community.name}`}
            aria-current={community.id === activeCommunityId ? "page" : undefined}
            onClick={() => onSelectCommunity(community.id)}
            onContextMenu={(event) => onContextMenu(event, community)}
          >
            <span className="active-rail" />
            <span>{getCommunityIconLabel(community.name, community.icon)}</span>
            {community.id === "aurora" ? <i className="unread-dot" /> : null}
          </button>
        ))}
        <button className="server-button utility" aria-label="Add community" onClick={() => onUtilityAction?.("create-community")}>
          <AppIcon name={railIcons.addCommunity} size="lg" />
        </button>
        {isV1FeatureEnabled("discoveryMarketplace") ? <button className={`server-button utility `} aria-label="Discover communities" onClick={onOpenDiscovery}>
          <AppIcon name={railIcons.discover} size="lg" />
        </button> : null}
      </div>
    </nav>
  );
}
