import type { Community } from "../types/community";
import { getCommunityIconLabel } from "../utils/generatedIdentity";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type CommunityHeaderProps = {
  community: Community;
  onOpenMenu: () => void;
};

export function CommunityHeader({ community, onOpenMenu }: CommunityHeaderProps) {
  return (
    <header className="community-header">
      <div className="community-mark" style={{ background: community.accentColor }}>
        {getCommunityIconLabel(community.name, community.icon)}
      </div>
      <div>
        <strong>{community.name}</strong>
        <span>Desktop community</span>
      </div>
      <button className="icon-button" aria-label="Community menu" title="Community menu" onClick={onOpenMenu}>
        <AppIcon name={sidebarIcons.expand} size="sm" />
      </button>
    </header>
  );
}
