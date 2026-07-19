import type { CSSProperties, MouseEvent } from "react";
import type { Community } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { getCommunityIconLabel, resolveCommunityMarkSrc } from "../utils/generatedIdentity";
import { getCommunityVerificationSummary, getVerificationType } from "../utils/verificationHelpers";
import { isV1CommunityKindEnabled, isV1FeatureEnabled } from "../config/v1ReleaseScope";
import "./ServerRail.css";

const railIcons = mvpUiIconMap.serverRail;

type ServerRailProps = {
  communities: Community[];
  activeCommunityId: string;
  onSelectCommunity: (id: string) => void;
  onUtilityAction?: (label: string) => void;
  onContextMenu: (event: MouseEvent, community: Community) => void;
};

function CommunityRailMark({ community }: { community: Community }) {
  const logoSrc = resolveCommunityMarkSrc(community);
  if (logoSrc) {
    return <img className="server-button__avatar" src={logoSrc} alt="" draggable={false} />;
  }
  return <span className="server-button__monogram">{getCommunityIconLabel(community.name, community.icon)}</span>;
}

export function ServerRail({ communities, activeCommunityId, onSelectCommunity, onUtilityAction, onContextMenu }: ServerRailProps) {
  const visibleCommunities = communities.filter((community) => isV1CommunityKindEnabled(community.kind));
  return (
    <nav className="server-rail" aria-label="Community switcher">
      <div className="server-stack" style={{ flex: "1 1 auto" }}>
        {visibleCommunities.map((community) => {
          const logoSrc = resolveCommunityMarkSrc(community);
          return (
            <button
              key={community.id}
              className={`server-button ${community.id === activeCommunityId ? "active" : ""} ${logoSrc ? "server-button--avatar" : ""}`}
              style={{ "--server-accent": community.accentColor } as CSSProperties}
              title={`${community.name}${getVerificationType(getCommunityVerificationSummary(community.id, [], community.verification)) === "official_community" ? " / Official community" : ""}`}
              aria-label={`Open ${community.name}`}
              aria-current={community.id === activeCommunityId ? "page" : undefined}
              onClick={() => onSelectCommunity(community.id)}
              onContextMenu={(event) => onContextMenu(event, community)}
            >
              <span className="active-rail" />
              <CommunityRailMark community={community} />
              {community.id === "aurora" ? <i className="unread-dot" /> : null}
            </button>
          );
        })}
      </div>
      <div className="server-rail-footer">
        <button
          className="server-button utility server-button--add"
          title="Add community"
          aria-label="Add community"
          onClick={() => onUtilityAction?.("Add Community")}
        >
          <AppIcon name={railIcons.addCommunity} size="md" />
        </button>
        {isV1FeatureEnabled("discoveryMarketplace") ? (
          <button
            className="server-button utility server-button--discover"
            title="Discover communities"
            aria-label="Discover communities"
            onClick={() => onUtilityAction?.("open-discovery")}
          >
            <AppIcon name={railIcons.discover} size="md" />
          </button>
        ) : null}
      </div>
    </nav>
  );
}
