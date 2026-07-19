import type { Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";

const sidebarIcons = mvpUiIconMap.communitySidebar;

type UserMiniCardProps = {
  member: Member;
  onOpenMicrophoneSettings?: () => void;
  onOpenHeadphoneSettings?: () => void;
};

export function UserMiniCard({ member, onOpenMicrophoneSettings, onOpenHeadphoneSettings }: UserMiniCardProps) {
  return (
    <footer className="user-mini-card" style={{ gridTemplateColumns: "38px minmax(0, 1fr) 28px 28px" }}>
      <MemberAvatar member={member} size={38} />
      <div className="user-mini-main" title={`${member.displayName} - ${member.statusText}`}>
        <strong title={member.displayName}>{member.displayName}</strong>
        <span title={member.statusText}>{member.statusText}</span>
      </div>
      <button
        type="button"
        className="mini-action"
        aria-label="Mikrofon ayarları"
        title="Mikrofon ayarları"
        onClick={onOpenMicrophoneSettings}
      >
        <AppIcon name={sidebarIcons.mute} size="sm" />
      </button>
      <button
        type="button"
        className="mini-action"
        aria-label="Kulaklık ayarları"
        title="Kulaklık ayarları"
        onClick={onOpenHeadphoneSettings}
      >
        <AppIcon name={sidebarIcons.deafen} size="sm" />
      </button>
    </footer>
  );
}
