import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Channel, Community, Member, Message } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import { getComposerDisabledReason } from "../../services/permissions/communityPermissions";
import { dateTimeService } from "../../services/dateTimeService";
import { clipboardService } from "../../services/clipboardService";
import { notificationPolicyStateService } from "../../services/notificationPolicyStateService";
import { dataSourceService } from "../../services/dataSourceService";
import { profileService } from "../../services/profileService";
import {
  filterAliveVoiceChatMessages,
  getNextVoiceChatExpiryDelayMs,
  listExpiredVoiceChatMessages,
  VOICE_ROOM_CHAT_TTL_MS,
} from "../../services/voice/voiceRoomChatTtl";
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
  /** Live voice identities → display names (fallback when roster lookup misses). */
  participantNamesByIdentity?: ReadonlyMap<string, string>;
  onSendMessage: (body: string) => void | Promise<void>;
  /** Called once per message when its 30-minute TTL elapses (rolling, in order). */
  onExpireMessage?: (message: Message) => void | Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

type ResolvedAuthor = Readonly<{
  member?: Member;
  label: string;
}>;

function buildMemberIndex(members: readonly Member[], currentUser: Member): Map<string, Member> {
  const map = new Map<string, Member>();
  for (const member of members) {
    map.set(member.userId, member);
    map.set(member.id, member);
  }
  map.set(currentUser.userId, currentUser);
  if (currentUser.id) map.set(currentUser.id, currentUser);
  return map;
}

function resolveMessageAuthor(
  message: Message,
  currentUser: Member,
  membersById: ReadonlyMap<string, Member>,
  participantNamesByIdentity: ReadonlyMap<string, string> | undefined,
  profileNames: ReadonlyMap<string, string>,
): ResolvedAuthor {
  if (message.authorId === currentUser.userId) {
    const label = currentUser.displayName?.trim() || currentUser.username?.trim() || "You";
    return { member: currentUser, label };
  }

  const fromRoster = membersById.get(message.authorId);
  if (fromRoster) {
    const label = fromRoster.displayName?.trim() || fromRoster.username?.trim();
    if (label) return { member: fromRoster, label };
  }

  const fromVoice = participantNamesByIdentity?.get(message.authorId)?.trim();
  if (fromVoice) return { member: fromRoster, label: fromVoice };

  const fromProfile = profileNames.get(message.authorId)?.trim();
  if (fromProfile) return { member: fromRoster, label: fromProfile };

  if (message.webhookName?.trim()) {
    return { label: message.webhookName.trim() };
  }

  return { member: fromRoster, label: "Unknown user" };
}

export function VoiceRoomChatPanel({
  community,
  channel,
  access,
  messages,
  currentUser,
  participantNamesByIdentity,
  onSendMessage,
  onExpireMessage,
  onTypingStart,
  onTypingStop,
  pushToast,
}: VoiceRoomChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [channelMuted, setChannelMuted] = useState(() => notificationPolicyStateService.getSnapshot().mutedChannelIds.includes(channel.id));
  const [ttlTick, setTtlTick] = useState(0);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(() => new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const expiredIdsRef = useRef<Set<string>>(new Set());
  const profileLookupAttemptedRef = useRef<Set<string>>(new Set());
  const membersById = useMemo(() => buildMemberIndex(community.members, currentUser), [community.members, currentUser]);
  const visibleMessages = useMemo(
    () => filterAliveVoiceChatMessages(messages, Date.now()),
    // ttlTick forces a recompute when the next message hits its 30-minute mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional clock tick
    [messages, ttlTick],
  );
  const composerDisabledReason = getComposerDisabledReason(access, channel);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleMessages.length, visibleMessages[visibleMessages.length - 1]?.id]);

  useEffect(() => {
    return notificationPolicyStateService.subscribe((snapshot) => {
      setChannelMuted(snapshot.mutedChannelIds.includes(channel.id));
    });
  }, [channel.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Fill display names for authors missing from the local community roster.
  useEffect(() => {
    if (dataSourceService.getStatus().isMock) return;

    const missing = [...new Set(
      visibleMessages
        .map((message) => message.authorId)
        .filter((authorId) => {
          if (!authorId || authorId === currentUser.userId) return false;
          if (profileLookupAttemptedRef.current.has(authorId)) return false;
          if (membersById.has(authorId)) {
            const member = membersById.get(authorId);
            return !member?.displayName?.trim() && !member?.username?.trim();
          }
          if (participantNamesByIdentity?.has(authorId)) return false;
          return true;
        }),
    )];

    if (!missing.length) return;

    for (const authorId of missing) {
      profileLookupAttemptedRef.current.add(authorId);
    }

    let canceled = false;
    void Promise.all(
      missing.map(async (authorId) => {
        const result = await profileService.getProfileById(authorId);
        if (!result.ok || !result.data) return null;
        const label = result.data.displayName.trim() || result.data.username.trim();
        return label ? ([authorId, label] as const) : null;
      }),
    ).then((rows) => {
        if (canceled) return;
        setProfileNames((current) => {
          const next = new Map(current);
          for (const row of rows) {
            if (row) next.set(row[0], row[1]);
          }
          return next;
        });
      });

    return () => {
      canceled = true;
    };
  }, [currentUser.userId, membersById, participantNamesByIdentity, visibleMessages]);

  // Rolling 30-minute TTL: expire messages one-by-one in creation order as each timer elapses.
  useEffect(() => {
    const clock = Date.now();
    const expired = listExpiredVoiceChatMessages(messages, clock);
    for (const message of expired) {
      if (expiredIdsRef.current.has(message.id)) continue;
      expiredIdsRef.current.add(message.id);
      void onExpireMessage?.(message);
    }

    const delayMs = getNextVoiceChatExpiryDelayMs(messages, clock);
    if (delayMs === null) return;

    const timer = window.setTimeout(() => {
      setTtlTick((tick) => tick + 1);
    }, Math.min(delayMs + 16, VOICE_ROOM_CHAT_TTL_MS));

    return () => window.clearTimeout(timer);
  }, [messages, onExpireMessage, ttlTick]);

  useEffect(() => {
    const aliveIds = new Set(messages.filter((message) => !message.deletedAt).map((message) => message.id));
    for (const id of [...expiredIdsRef.current]) {
      if (!aliveIds.has(id)) expiredIdsRef.current.delete(id);
    }
  }, [messages]);

  const scrollToLatest = () => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    setMenuOpen(false);
  };

  const copyChannelId = () => {
    void clipboardService.copyText(channel.id).then(() => {
      pushToast("Channel ID copied.", "success");
      setMenuOpen(false);
    });
  };

  const toggleChannelMute = () => {
    notificationPolicyStateService.setChannelMuted(channel.id, !channelMuted);
    pushToast(
      channelMuted ? `#${channel.name} notifications unmuted.` : `#${channel.name} notifications muted.`,
      "success",
    );
    setMenuOpen(false);
  };

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

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuOpen((open) => !open);
  };

  return (
    <section className="voice-room-chat-panel" aria-label="Voice room chat">
      <header className="voice-room-chat-panel__header">
        <strong>Chat</strong>
        <div className="voice-room-chat-panel__menu-wrap" ref={menuRef}>
          <button
            type="button"
            aria-label="Chat options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="voice-room-chat-panel__menu"
            onClick={openMenu}
          >
            <AppIcon name="more" size="sm" />
          </button>
          {menuOpen ? (
            <div className="voice-room-chat-panel__menu-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={scrollToLatest}>
                Scroll to latest
              </button>
              <button type="button" role="menuitem" onClick={copyChannelId}>
                Copy channel ID
              </button>
              <button type="button" role="menuitem" onClick={toggleChannelMute}>
                {channelMuted ? "Unmute channel notifications" : "Mute channel notifications"}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="voice-room-chat-panel__messages" ref={listRef}>
        {visibleMessages.length ? visibleMessages.map((message) => {
          const isOwn = message.authorId === currentUser.userId;
          const author = resolveMessageAuthor(
            message,
            currentUser,
            membersById,
            participantNamesByIdentity,
            profileNames,
          );
          return (
            <article
              key={message.id}
              className={`voice-room-chat-message${isOwn ? " is-own" : ""}`}
            >
              <MemberAvatar
                member={author.member}
                label={author.label}
                size={34}
              />
              <div className="voice-room-chat-message__content">
                <div className="voice-room-chat-message__meta">
                  <strong>{author.label}</strong>
                  <time dateTime={message.createdAt}>{dateTimeService.formatMessageTime(message.createdAt)}</time>
                </div>
                <p className="voice-room-chat-message__bubble">{message.body}</p>
              </div>
            </article>
          );
        }) : (
          <div className="voice-room-chat-panel__empty">
            <strong>No messages yet</strong>
            <span>Say hello to everyone in the voice room. Messages auto-delete after 30 minutes.</span>
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
