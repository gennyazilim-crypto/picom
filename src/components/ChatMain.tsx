import { useMemo } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import type { RealtimeConnectionStatus } from "../hooks/useSupabaseMessageRealtime";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

type ToastTone = "info" | "error" | "success";
const composerIcons = mvpUiIconMap.messageComposer;

type ChatMainProps = {
  community: Community;
  channel: Channel;
  messages: Message[];
  realtimeStatus: RealtimeConnectionStatus;
  onSendMessage: (body: string, attachments?: Attachment[]) => void | Promise<void>;
  onToggleMembers: () => void;
  membersVisible: boolean;
  onMessageContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function ChatMain({ community, channel, messages, realtimeStatus, onSendMessage, onToggleMembers, membersVisible, onMessageContextMenu, onOpenProfile, onOpenImage, pushToast }: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);

  return (
    <main className="chat-main">
      <ChatHeader channel={channel} realtimeStatus={realtimeStatus} membersVisible={membersVisible} onToggleMembers={onToggleMembers} />

      {channel.type === "voice" ? (
        <div className="voice-placeholder">
          <span className="voice-orb">
            <AppIcon name="voice" size="xl" />
          </span>
          <h2>{channel.name}</h2>
          <p>Voice rooms are placeholders in the MVP. Text chat remains the first stable path.</p>
        </div>
      ) : (
        <>
          <MessageList community={community} messages={channelMessages} onContextMenu={onMessageContextMenu} onOpenProfile={onOpenProfile} onOpenImage={onOpenImage} />
          <MessageComposer communityId={community.id} channel={channel} onSendMessage={onSendMessage} pushToast={pushToast} />
        </>
      )}
    </main>
  );
}
