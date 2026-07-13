import { useEffect, useMemo, useRef, useState } from "react";
import type { Channel, Community, Member, Message } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import { getComposerDisabledReason } from "../../services/permissions/communityPermissions";
import { dateTimeService } from "../../services/dateTimeService";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import "./VoiceRoomChatPanel.css";

type ToastTone = "info" | "error" | "success";

type VoiceRoomChatPanelProps = {
  community: Community;
  channel: Channel;
  access: CommunityAccess;
  messages: Message[];
  currentUser: Member;
  onSendMessage: (body: string) => void | Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function VoiceRoomChatPanel({
  community,
  channel,
  access,
  messages,
  currentUser,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  pushToast,
}: VoiceRoomChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const memberByUserId = useMemo(() => new Map(community.members.map((member) => [member.userId, member])), [community.members]);
  const visibleMessages = useMemo(
    () => messages.filter((message) => !message.deletedAt).sort((left, right) => {
      const leftOrder = left.localOrder ?? Date.parse(left.createdAt);
      const rightOrder = right.localOrder ?? Date.parse(right.createdAt);
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    }),
    [messages],
  );
  const composerDisabledReason = getComposerDisabledReason(access, channel);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleMessages.length, visibleMessages[visibleMessages.length - 1]?.id]);

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (composerDisabledReason) {
      pushToast(composerDisabledReason, "error");
      return;
    }

    setSending(true);
    try {
      await onSendMessage(body);
      setDraft("");
      onTypingStop?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="voice-room-chat-panel" aria-label="Voice room chat">
      <header className="voice-room-chat-panel__header">
        <strong>Chat</strong>
        <button type="button" aria-label="Chat options" className="voice-room-chat-panel__menu">
          <AppIcon name="more" size="sm" />
        </button>
      </header>

      <div className="voice-room-chat-panel__messages" ref={listRef}>
        {visibleMessages.length ? visibleMessages.map((message) => {
          const isOwn = message.authorId === currentUser.userId;
          const author = memberByUserId.get(message.authorId);
          return (
            <article
              key={message.id}
              className={`voice-room-chat-message${isOwn ? " is-own" : ""}`}
            >
              <MemberAvatar
                member={author}
                label={author?.displayName ?? "Member"}
                size={34}
              />
              <div className="voice-room-chat-message__content">
                <div className="voice-room-chat-message__meta">
                  <strong>{author?.displayName ?? "Member"}</strong>
                  <time dateTime={message.createdAt}>{dateTimeService.formatMessageTime(message.createdAt)}</time>
                </div>
                <p className="voice-room-chat-message__bubble">{message.body}</p>
              </div>
            </article>
          );
        }) : (
          <div className="voice-room-chat-panel__empty">
            <strong>No messages yet</strong>
            <span>Say hello to everyone in the voice room.</span>
          </div>
        )}
      </div>

      <form
        className="voice-room-chat-panel__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          value={draft}
          placeholder={composerDisabledReason ?? "Type a message here..."}
          aria-label="Voice room message"
          disabled={Boolean(composerDisabledReason) || sending}
          onChange={(event) => {
            setDraft(event.target.value);
            if (event.target.value.trim()) onTypingStart?.();
            else onTypingStop?.();
          }}
          onBlur={() => onTypingStop?.()}
        />
        <button
          type="submit"
          className="voice-room-chat-panel__send"
          aria-label="Send message"
          disabled={Boolean(composerDisabledReason) || sending || !draft.trim()}
        >
          <AppIcon name="send" size="sm" />
        </button>
      </form>
    </section>
  );
}
