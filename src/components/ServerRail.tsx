import type { CSSProperties, MouseEvent } from "react";
import logoUrl from "../../assets/brand/picom-logo-concept.png";
import type { Community } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { getCommunityIconLabel } from "../utils/generatedIdentity";
import { getCommunityVerificationSummary, getVerificationType } from "../utils/verificationHelpers";

const railIcons = mvpUiIconMap.serverRail;

type ServerRailProps = {
  communities: Community[];
  activeCommunityId: string;
  homeActive?: boolean;
  directMessagesActive?: boolean;
  discoveryActive?: boolean;
  onSelectCommunity: (id: string) => void;
  onOpenHome: () => void;
  onOpenDirectMessages: () => void;
  onOpenDiscovery: () => void;
  onOpenSettings: () => void;
  onUtilityAction?: (label: string) => void;
  onContextMenu: (event: MouseEvent, community: Community) => void;
};

export function ServerRail({ communities, activeCommunityId, homeActive = false, directMessagesActive = false, discoveryActive = false, onSelectCommunity, onOpenHome, onOpenDirectMessages, onOpenDiscovery, onOpenSettings, onUtilityAction, onContextMenu }: ServerRailProps) {
  return (
    <nav className="server-rail" aria-label="Communities">
      <button className={`server-home ${homeActive ? "active" : ""}`} aria-label="Open mention feed" aria-current={homeActive ? "page" : undefined} onClick={onOpenHome}>
        <img src={logoUrl} alt="" />
        {homeActive ? <span className="active-rail" /> : null}
      </button>
      <button
        className={`server-button utility server-dm ${directMessagesActive ? "active" : ""}`}
        type="button"
        title="Direct messages"
        aria-label="Direct messages"
        aria-current={directMessagesActive ? "page" : undefined}
        onClick={onOpenDirectMessages}
      >
        <span className="active-rail" />
        <AppIcon name="inbox" size="lg" />
      </button>
      <span className="rail-separator" />
      <div className="server-stack">
        {communities.map((community) => (
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
        <button className={`server-button utility ${discoveryActive ? "active" : ""}`} aria-label="Discover communities" onClick={onOpenDiscovery}>
          <AppIcon name={railIcons.discover} size="lg" />
        </button>
      </div>
      <button className="server-button utility bottom" aria-label="Settings" onClick={onOpenSettings}>
        <AppIcon name={railIcons.settings} size="lg" />
      </button>
    </nav>
  );
}
