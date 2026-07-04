import type { Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type UserMiniCardProps = {
  member: Member;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function UserMiniCard({ member, onOpenSettings, onLogout }: UserMiniCardProps) {
  return (
    <footer className="user-mini-card">
      <MemberAvatar member={member} size={38} />
      <button className="user-mini-main" onClick={onOpenSettings}>
        <strong>{member.displayName}</strong>
        <span>{member.statusText}</span>
      </button>
      <button className="mini-action" aria-label="Mute">
        <AppIcon name={sidebarIcons.mute} size="sm" />
      </button>
      <button className="mini-action" aria-label="Deafen">
        <AppIcon name={sidebarIcons.deafen} size="sm" />
      </button>
      <button className="mini-action" aria-label="Settings" onClick={onOpenSettings}>
        <AppIcon name={sidebarIcons.settings} size="sm" />
      </button>
    </footer>
  );
}
