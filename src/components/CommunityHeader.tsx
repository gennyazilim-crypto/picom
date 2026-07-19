import type { Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import { getCommunityIconLabel, resolveCommunityMarkSrc } from "../utils/generatedIdentity";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { VerifiedBadge } from "./VerifiedBadge";
import { getCommunityVerificationSummary } from "../utils/verificationHelpers";
import { settingsNavigationPolicyService } from "../services/navigation/settingsNavigationPolicyService";
import { useEffect, useState } from "react";

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
    const destination = settingsNavigationPolicyService.resolveCommunityDestination(access);
    if (destination === "admin") {
      onOpenAdminPanel();
      return;
    }

    if (destination === "moderator") {
      onOpenModeratorPanel();
      return;
    }

    if (destination === "visitor") {
      onOpenVisitorPanel();
      return;
    }

    onOpenMemberPanel();
  };

  void onOpenJoinCommunity;
  void onOpenLeaveCommunity;
  void onPlaceholderAction;

  const logoSrc = resolveCommunityMarkSrc(community);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoRetry, setLogoRetry] = useState(0);

  useEffect(() => {
    setLogoFailed(false);
    setLogoRetry(0);
  }, [logoSrc, community.id]);

  const showLogo = Boolean(logoSrc) && !logoFailed;

  return (
    <header className="community-header community-header-with-menu">
      <div
        className={`community-mark${showLogo ? " community-mark--avatar" : ""}`}
        style={showLogo ? undefined : { background: community.accentColor }}
        aria-hidden="true"
      >
        {showLogo ? (
          <img
            key={`${logoSrc}:${logoRetry}`}
            src={logoSrc!}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => {
              // One automatic retry covers aborted/remounted loads before falling back to monogram.
              if (logoRetry < 1) {
                setLogoRetry(1);
                return;
              }
              setLogoFailed(true);
            }}
          />
        ) : (
          getCommunityIconLabel(community.name, community.icon)
        )}
      </div>
      <div className="community-header-copy">
        <strong className="community-name-with-verification"><span>{community.name}</span><VerifiedBadge verification={getCommunityVerificationSummary(community.id, [], community.verification)} /></strong>
        <span>{access.isVisitor ? "Public preview" : "Desktop community"}</span>
      </div>
      <button className="icon-button" aria-label="Open community settings" title="Open community settings" onClick={openManagementCenter}>
        <AppIcon name={sidebarIcons.settings} size="sm" />
      </button>
    </header>
  );
}
