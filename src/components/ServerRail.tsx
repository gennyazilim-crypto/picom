import type { CSSProperties, MouseEvent } from "react";
import logoUrl from "../../assets/brand/picom-logo-concept.png";
import type { Community } from "../types/community";
import { AppIcon } from "./AppIcon";

type ServerRailProps = {
  communities: Community[];
  activeCommunityId: string;
  onSelectCommunity: (id: string) => void;
  onOpenSettings: () => void;
  onContextMenu: (event: MouseEvent, label: string) => void;
};

export function ServerRail({ communities, activeCommunityId, onSelectCommunity, onOpenSettings, onContextMenu }: ServerRailProps) {
  return (
    <nav className="server-rail" aria-label="Communities">
      <button className="server-home" aria-label="Home">
        <img src={logoUrl} alt="" />
      </button>
      <span className="rail-separator" />
      <div className="server-stack">
        {communities.map((community) => (
          <button
            key={community.id}
            className={`server-button ${community.id === activeCommunityId ? "active" : ""}`}
            style={{ "--server-accent": community.accentColor } as CSSProperties}
            title={community.name}
            aria-label={`Open ${community.name}`}
            aria-current={community.id === activeCommunityId ? "page" : undefined}
            onClick={() => onSelectCommunity(community.id)}
            onContextMenu={(event) => onContextMenu(event, community.name)}
          >
            <span className="active-rail" />
            <span>{community.icon}</span>
            {community.id === "aurora" ? <i className="unread-dot" /> : null}
          </button>
        ))}
        <button className="server-button utility" aria-label="Add community">
          <AppIcon name="plus" size="lg" />
        </button>
        <button className="server-button utility" aria-label="Discover communities placeholder">
          <AppIcon name="search" size="lg" />
        </button>
      </div>
      <button className="server-button utility bottom" aria-label="Settings" onClick={onOpenSettings}>
        <AppIcon name="settings" size="lg" />
      </button>
    </nav>
  );
}