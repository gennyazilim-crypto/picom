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
  typingNames: string[];
  onTypingStart: () => void;
  onTypingStop: () => void;
  currentUserId: string;
  replyToMessage?: Message | null;
  editingMessageId: string | null;
  onCancelReply: () => void;
  onSendMessage: (body: string, attachments?: Attachment[], replyToMessageId?: string | null) => void | Promise<void>;
  onToggleMembers: () => void;
  membersVisible: boolean;
  onMessageContextMenu: (event: MouseEvent, message: Message) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenImage: (image: Attachment) => void;
  onReplyMessage: (message: Message) => void;
  onStartEditMessage: (message: Message) => void;
  onCancelEditMessage: () => void;
  onSaveEditMessage: (message: Message, body: string) => void;
  onDeleteMessage: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function ChatMain({
  community,
  channel,
  messages,
  realtimeStatus,
  typingNames,
  onTypingStart,
  onTypingStop,
  currentUserId,
  replyToMessage,
  editingMessageId,
  onCancelReply,
  onSendMessage,
  onToggleMembers,
  membersVisible,
  onMessageContextMenu,
  onOpenProfile,
  onOpenImage,
  onReplyMessage,
  onStartEditMessage,
  onCancelEditMessage,
  onSaveEditMessage,
  onDeleteMessage,
  onToggleReaction,
  pushToast,
}: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);
  const replyToMember = replyToMessage ? community.members.find((member) => member.userId === replyToMessage.authorId) : undefined;

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
          <MessageList
            community={community}
            messages={channelMessages}
            currentUserId={currentUserId}
            editingMessageId={editingMessageId}
            typingNames={typingNames}
            onContextMenu={onMessageContextMenu}
            onOpenProfile={onOpenProfile}
            onOpenImage={onOpenImage}
            onReply={onReplyMessage}
            onStartEdit={onStartEditMessage}
            onCancelEdit={onCancelEditMessage}
            onSaveEdit={onSaveEditMessage}
            onDelete={onDeleteMessage}
            onToggleReaction={onToggleReaction}
          />
          <MessageComposer
            communityId={community.id}
            channel={channel}
            replyToMessage={replyToMessage}
            replyToMember={replyToMember}
            onCancelReply={onCancelReply}
            onSendMessage={onSendMessage}
            onTypingStart={onTypingStart}
            onTypingStop={onTypingStop}
            pushToast={pushToast}
          />
        </>
      )}
    </main>
  );
}
