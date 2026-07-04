import type { Channel } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const chatHeaderIcons = mvpUiIconMap.chatHeader;
const channelIcons = mvpUiIconMap.communitySidebar;

type ChatHeaderProps = {
  channel: Channel;
  membersVisible: boolean;
  onToggleMembers: () => void;
};

export function ChatHeader({ channel, membersVisible, onToggleMembers }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="chat-title">
        <AppIcon name={channel.type === "voice" ? channelIcons.voiceChannel : channelIcons.textChannel} size="lg" />
        <div>
          <strong>{channel.name}</strong>
          <span>{channel.topic ?? "Picom desktop channel"}</span>
        </div>
      </div>
      <div className="chat-actions">
        <button className="icon-button" aria-label="Pinned">
          <AppIcon name={chatHeaderIcons.pinned} />
        </button>
        <button className="icon-button" aria-label="Notifications">
          <AppIcon name={chatHeaderIcons.notifications} />
        </button>
        <button className="icon-button" aria-label="Inbox">
          <AppIcon name={chatHeaderIcons.inbox} />
        </button>
        <button
          className={`icon-button ${membersVisible ? "active" : ""}`}
          aria-label={membersVisible ? "Hide member sidebar" : "Show member sidebar"}
          aria-pressed={membersVisible}
          title={membersVisible ? "Hide member sidebar" : "Show member sidebar"}
          onClick={onToggleMembers}
        >
          <AppIcon name={chatHeaderIcons.members} />
        </button>
        <button className="icon-button" aria-label="Search">
          <AppIcon name={chatHeaderIcons.search} />
        </button>
        <button className="icon-button" aria-label="More">
          <AppIcon name={chatHeaderIcons.more} />
        </button>
      </div>
    </header>
  );
}
