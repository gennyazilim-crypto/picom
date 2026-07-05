import { useState } from "react";
import type { Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import { getCommunityIconLabel } from "../utils/generatedIdentity";
import { AppIcon } from "./AppIcon";
import { CommunityMenu, CommunityRoleBadge } from "./CommunityMenu";
import { mvpUiIconMap } from "./iconRegistry";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type CommunityHeaderProps = {
  community: Community;
  access: CommunityAccess;
  onOpenAdminPanel: () => void;
  onOpenModeratorPanel: () => void;
  onOpenMemberPanel: () => void;
  onOpenVisitorPanel: () => void;
  onOpenJoinCommunity: () => void;
  onOpenLeaveCommunity: () => void;
  onPlaceholderAction: (message: string) => void;
};

export function CommunityHeader({ community, access, onOpenAdminPanel, onOpenModeratorPanel, onOpenMemberPanel, onOpenVisitorPanel, onOpenJoinCommunity, onOpenLeaveCommunity, onPlaceholderAction }: CommunityHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="community-header community-header-with-menu">
      <div className="community-mark" style={{ background: community.accentColor }}>
        {getCommunityIconLabel(community.name, community.icon)}
      </div>
      <div className="community-header-copy">
        <strong>{community.name}</strong>
        <span>{access.isVisitor ? "Public preview" : "Desktop community"}</span>
      </div>
      <CommunityRoleBadge access={access} />
      <button className="icon-button" aria-label="Community menu" title="Community menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
        <AppIcon name={sidebarIcons.expand} size="sm" />
      </button>
      {menuOpen ? (
        <CommunityMenu
          community={community}
          access={access}
          onClose={() => setMenuOpen(false)}
          callbacks={{
            onOpenAdminPanel,
            onOpenModeratorPanel,
            onOpenMemberPanel,
            onOpenVisitorPanel,
            onOpenJoinCommunity,
            onOpenLeaveCommunity,
            onPlaceholderAction,
          }}
        />
      ) : null}
    </header>
  );
}
