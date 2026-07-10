import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { RealtimeConnectionStatus } from "../hooks/useSupabaseMessageRealtime";
import type { VoiceServiceSnapshot } from "../services/voiceService";
import type { CreatePollDraft } from "../types/polls";
import { getComposerDisabledReason } from "../services/permissions/communityPermissions";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { VoiceRoomView } from "./VoiceRoomView";
import { ForumChannelView } from "./ForumChannelView";
import { canSendMessage } from "../services/permissions/communityPermissions";
import { analyticsService } from "../services/analyticsService";

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
  access: CommunityAccess;
  channel: Channel;
  messages: Message[];
  realtimeStatus: RealtimeConnectionStatus;
  typingNames: string[];
  onTypingStart: () => void;
  onTypingStop: () => void;
  currentUserId: string;
  readReceiptsEnabled: boolean;
  highlightedMessageId?: string | null;
  replyToMessage?: Message | null;
  editingMessageId: string | null;
  onCancelReply: () => void;
  onSendMessage: (body: string, attachments?: Attachment[], replyToMessageId?: string | null, poll?: CreatePollDraft) => void | Promise<void>;
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
  onOpenJoinCommunity: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  onOpenInvite: () => void;
  onOpenTopic: () => void;
  onOpenPoll: () => void;
};

export function ChatMain({
  community,
  access,
  channel,
  messages,
  realtimeStatus,
  typingNames,
  onTypingStart,
  onTypingStop,
  currentUserId,
  readReceiptsEnabled,
  highlightedMessageId,
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
  onOpenJoinCommunity,
  pushToast,
  onOpenInvite,
  onOpenTopic,
  onOpenPoll,
}: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);
  const replyToMember = replyToMessage ? community.members.find((member) => member.userId === replyToMessage.authorId) : undefined;
  const currentMember = useMemo(() => community.members.find((member) => member.userId === currentUserId), [community.members, currentUserId]);
  const composerDisabledReason = useMemo(() => getComposerDisabledReason(access, channel), [access, channel]);
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
          if (!result.ok) pushToast(result.error.message, "error"); else analyticsService.trackEvent("voice_joined", { mode: "desktop" });
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
        analyticsService.trackEvent("screen_share_started", { mode: "desktop" });
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
      ) : channel.type === "forum" ? (
        <ForumChannelView community={community} channel={channel} currentMember={currentMember} canCreate={canSendMessage(access, { ...channel, type: "text" })} onNotice={pushToast} />
      ) : (
        <>
          <MessageList
            community={community}
            messages={channelMessages}
            currentUserId={currentUserId}
            readReceiptsEnabled={readReceiptsEnabled}
            highlightedMessageId={highlightedMessageId}
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
            pushToast={pushToast}
            blockedUserIds={blockedUserIds}
            announcement={channel.type === "announcement"}
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
            disabledActionLabel={access.isVisitor ? "Join Community" : undefined}
            onDisabledAction={access.isVisitor ? onOpenJoinCommunity : undefined}
            canInvite={access.permissions.includes("createInvites")}
            canEditTopic={access.permissions.includes("manageChannels")}
            canCreatePoll={access.permissions.includes("sendMessages")}
            onOpenInvite={onOpenInvite}
            onOpenTopic={onOpenTopic}
            onOpenPoll={onOpenPoll}
          />
        </>
      )}
    </main>
  );
}
