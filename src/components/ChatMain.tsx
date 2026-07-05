import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import type { RealtimeConnectionStatus } from "../hooks/useSupabaseMessageRealtime";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { VoiceRoomView } from "./VoiceRoomView";

type ToastTone = "info" | "error" | "success";
const initialVoiceSnapshot: VoiceServiceSnapshot = {
  status: "idle",
  roomName: null,
  muted: false,
  deafened: false,
  screenSharing: false,
  screenShares: [],
  participants: [],
  error: null,
};

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
  blockedUserIds?: string[];
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
  blockedUserIds = [],
  pushToast,
}: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);
  const replyToMember = replyToMessage ? community.members.find((member) => member.userId === replyToMessage.authorId) : undefined;
  const currentMember = useMemo(() => community.members.find((member) => member.userId === currentUserId), [community.members, currentUserId]);
  const currentRole = useMemo(() => community.roles.find((role) => role.id === currentMember?.roleId), [community.roles, currentMember?.roleId]);
  const composerDisabledReason = useMemo(() => {
    if (!currentMember) return "You need to be a community member to send messages in this channel.";
    if ((currentRole?.level ?? 0) < 10) return "You do not have permission to send messages in this channel.";
    return undefined;
  }, [currentMember, currentRole?.level]);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceServiceSnapshot>(initialVoiceSnapshot);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    void import("../services/voiceService").then(({ voiceService }) => {
      if (!active) return;
      cleanup = voiceService.subscribe(setVoiceSnapshot);
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const handleJoinVoice = () => {
    void import("../services/voiceService").then(({ voiceService }) => {
      void voiceService
        .join({
          communityId: community.id,
          channelId: channel.id,
          participantName: currentMember?.displayName ?? "Picom member",
          intent: "voice",
        })
        .then((result) => {
          if (!result.ok) pushToast(result.error.message, "error");
        });
    });
  };

  const handleLeaveVoice = () => {
    void import("../services/voiceService").then(({ voiceService }) => {
      void voiceService.leave();
    });
  };

  const handleToggleMute = () => {
    void import("../services/voiceService").then(({ voiceService }) => {
      void voiceService.setMuted(!voiceSnapshot.muted).then((result) => {
        if (!result.ok) pushToast(result.error.message, "error");
      })
    });
  };

  const handleToggleDeafen = () => {
    void import("../services/voiceService").then(({ voiceService }) => {
      const result = voiceService.setDeafened(!voiceSnapshot.deafened);
      if (!result.ok) pushToast(result.error.message, "error");
    });
  };

  const handleStartScreenShare = (sourceId: string) => {
    void import("../services/voiceService").then(({ voiceService }) => {
      void voiceService.startScreenShare(sourceId).then((result) => {
        if (!result.ok) {
          pushToast(result.error.message, "error");
          return;
        }

        pushToast("Screen sharing started.", "success");
      });
    });
  };

  const handleStopScreenShare = () => {
    void import("../services/voiceService").then(({ voiceService }) => {
      void voiceService.stopScreenShare().then((result) => {
        if (!result.ok) {
          pushToast(result.error.message, "error");
          return;
        }

        pushToast("Screen sharing stopped.", "success");
      });
    });
  };

  return (
    <main className="chat-main">
      <ChatHeader channel={channel} realtimeStatus={realtimeStatus} membersVisible={membersVisible} onToggleMembers={onToggleMembers} />

      {channel.type === "voice" ? (
        <VoiceRoomView
          community={community}
          channel={channel}
          snapshot={voiceSnapshot}
          onJoin={handleJoinVoice}
          onLeave={handleLeaveVoice}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onStartScreenShare={handleStartScreenShare}
          onStopScreenShare={handleStopScreenShare}
        />
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
            disabledReason={composerDisabledReason}
          />
        </>
      )}
    </main>
  );
}
