import type { Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type UserMiniCardProps = {
  member: Member;
};

export function UserMiniCard({ member }: UserMiniCardProps) {
  return (
    <footer className="user-mini-card" style={{ gridTemplateColumns: "38px minmax(0, 1fr) 28px 28px" }}>
      <MemberAvatar member={member} size={38} />
      <div className="user-mini-main" title={`${member.displayName} - ${member.statusText}`}>
        <strong title={member.displayName}>{member.displayName}</strong>
        <span title={member.statusText}>{member.statusText}</span>
      </div>
      <button className="mini-action" aria-label="Mute">
        <AppIcon name={sidebarIcons.mute} size="sm" />
      </button>
      <button className="mini-action" aria-label="Deafen">
        <AppIcon name={sidebarIcons.deafen} size="sm" />
      </button>
    </footer>
  );
}
