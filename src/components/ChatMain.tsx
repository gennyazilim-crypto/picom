import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { CreatePollDraft } from "../types/polls";
import { getComposerDisabledReason } from "../services/permissions/communityPermissions";
import { savedMessageService } from "../services/savedMessageService";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { ForumChannelView } from "./ForumChannelView";
import { canSendMessage } from "../services/permissions/communityPermissions";
import { announcementChannelService } from "../services/announcementChannelService";

type ToastTone = "info" | "error" | "success";
type ChatMainProps = {
  community: Community;
  access: CommunityAccess;
  channel: Channel;
  messages: Message[];
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
  onRetryMessage: (message: Message) => void;
  onRemoveFailedMessage: (message: Message) => void;
  blockedUserIds?: string[];
  onOpenJoinCommunity: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  onOpenInvite: () => void;
  onOpenTopic: () => void;
  onOpenPoll: () => void;
  onOpenSavedMessages?: () => void;
  onOpenMentionFeed?: () => void;
  onMessageListNearBottomChange?: (nearBottom: boolean) => void;
};

const channelMuteStorageKey = (channelId: string) => `picom.channelMute.${channelId}`;

function readChannelMuted(channelId: string) {
  try {
    return window.localStorage.getItem(channelMuteStorageKey(channelId)) === "1";
  } catch {
    return false;
  }
}

function writeChannelMuted(channelId: string, muted: boolean) {
  try {
    if (muted) window.localStorage.setItem(channelMuteStorageKey(channelId), "1");
    else window.localStorage.removeItem(channelMuteStorageKey(channelId));
  } catch {
    /* storage unavailable */
  }
}

export function ChatMain({
  community,
  access,
  channel,
  messages,
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
  onRetryMessage,
  onRemoveFailedMessage,
  blockedUserIds = [],
  onOpenJoinCommunity,
  pushToast,
  onOpenInvite,
  onOpenTopic,
  onOpenPoll,
  onOpenSavedMessages,
  onOpenMentionFeed,
  onMessageListNearBottomChange,
}: ChatMainProps) {
  const channelMessages = useMemo(() => messages.filter((message) => message.channelId === channel.id), [messages, channel.id]);
  const replyToMember = replyToMessage ? community.members.find((member) => member.userId === replyToMessage.authorId) : undefined;
  const currentMember = useMemo(() => community.members.find((member) => member.userId === currentUserId), [community.members, currentUserId]);
  const composerDisabledReason = useMemo(() => getComposerDisabledReason(access, channel), [access, channel]);
  const [announcementFollowing, setAnnouncementFollowing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsMuted, setNotificationsMuted] = useState(() => readChannelMuted(channel.id));
  const [savedInChannelCount, setSavedInChannelCount] = useState(0);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setNotificationsMuted(readChannelMuted(channel.id));
  }, [channel.id]);

  useEffect(() => {
    let active = true;
    const refreshSavedCount = () => {
      const count = savedMessageService.listSavedMessages().filter((item) => item.channelId === channel.id).length;
      if (active) setSavedInChannelCount(count);
    };
    refreshSavedCount();
    const unsubscribe = savedMessageService.subscribe(refreshSavedCount);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [channel.id]);

  useEffect(() => {
    let active = true;
    if (channel.type !== "announcement") { setAnnouncementFollowing(false); return () => { active = false; }; }
    void announcementChannelService.isFollowing(channel.id, currentUserId).then((following) => { if (active) setAnnouncementFollowing(following); });
    return () => { active = false; };
  }, [channel.id, channel.type, currentUserId]);

  return (
    <main className="chat-main">
      <ChatHeader
        channel={channel}
        membersVisible={membersVisible}
        memberCount={community.members.length}
        savedInChannelCount={savedInChannelCount}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        canEditTopic={access.permissions.includes("manageChannels")}
        canInvite={access.permissions.includes("createInvites")}
        notificationsMuted={notificationsMuted}
        onToggleMembers={onToggleMembers}
        onSearchOpen={() => {
          setSearchOpen((open) => {
            if (open) setSearchQuery("");
            return !open;
          });
        }}
        onSearchChange={setSearchQuery}
        onEditTopic={onOpenTopic}
        onOpenInvite={onOpenInvite}
        onOpenSavedMessages={onOpenSavedMessages}
        onOpenMentionFeed={onOpenMentionFeed}
        onToggleNotifications={() => {
          const next = !notificationsMuted;
          writeChannelMuted(channel.id, next);
          setNotificationsMuted(next);
          pushToast(next ? "Channel notifications muted locally." : "Channel notifications restored.", "success");
        }}
        announcementFollowing={announcementFollowing}
        announcementReadOnly={access.isVisitor}
        onToggleAnnouncementFollowing={channel.type === "announcement" && !access.isVisitor ? () => { void announcementChannelService.setFollowing({ channelId: channel.id, userId: currentUserId, following: !announcementFollowing, canFollow: !access.isVisitor }).then((result) => { if (result.ok) { setAnnouncementFollowing(result.data); pushToast(result.data ? "Following announcements." : "Announcement follow disabled.", "success"); } else pushToast(result.message, "error"); }); } : undefined}
      />

      {channel.type === "forum" ? (
        <ForumChannelView community={community} channel={channel} currentMember={currentMember} canCreate={canSendMessage(access, { ...channel, type: "text" })} onNotice={pushToast} />
      ) : (
        <>
          <MessageList
            key={channel.id}
            community={community}
            messages={channelMessages}
            searchQuery={searchQuery}
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
            onRetrySend={onRetryMessage}
            onRemoveFailed={onRemoveFailedMessage}
            pushToast={pushToast}
            blockedUserIds={blockedUserIds}
            announcement={channel.type === "announcement"}
            onNearBottomChange={onMessageListNearBottomChange}
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
