import type { Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import { getCommunityIconLabel } from "../utils/generatedIdentity";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { VerifiedBadge } from "./VerifiedBadge";
import { getCommunityVerificationSummary } from "../utils/verificationHelpers";

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
  const openManagementCenter = () => {
    if (access.isOwner || access.isAdmin) {
      onOpenAdminPanel();
      return;
    }

    if (access.isModerator) {
      onOpenModeratorPanel();
      return;
    }

    if (access.isVisitor) {
      onOpenVisitorPanel();
      return;
    }

    onOpenMemberPanel();
  };

  void onOpenJoinCommunity;
  void onOpenLeaveCommunity;
  void onPlaceholderAction;

  return (
    <header className="community-header community-header-with-menu">
      <div className="community-mark" style={{ background: community.accentColor }}>
        {getCommunityIconLabel(community.name, community.icon)}
      </div>
      <div className="community-header-copy">
        <strong className="community-name-with-verification"><span>{community.name}</span><VerifiedBadge verification={getCommunityVerificationSummary(community.id, [], community.verification)} /></strong>
        <span>{access.isVisitor ? "Public preview" : "Desktop community"}</span>
      </div>
      <button className="icon-button" aria-label="Open community management center" title="Open community management center" onClick={openManagementCenter}>
        <AppIcon name={sidebarIcons.expand} size="sm" />
      </button>
    </header>
  );
}
