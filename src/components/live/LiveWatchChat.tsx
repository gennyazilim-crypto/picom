import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { messageService, type MessageSummary } from "../../services/messageService";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { AppIcon } from "../AppIcon";
import { useTranslation } from "../../i18n";
import type { TFunction } from "../../i18n";

export type LiveWatchChatProps = Readonly<{
  open: boolean;
  communityId: string;
  channelId: string;
  channelName: string;
  currentUserId: string;
  readOnly: boolean;
  onToggle: () => void;
  onNotice: (message: string, kind?: "info" | "error" | "success") => void;
}>;

type ChatConnection = "connecting" | "ready" | "denied" | "error";

type AuthorProfile = Readonly<{
  displayName: string;
  username: string;
}>;

function mapMessage(row: Record<string, unknown>): MessageSummary {
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    channelId: String(row.channel_id),
    authorId: String(row.author_id),
    body: String(row.body ?? ""),
    clientMessageId: row.client_message_id == null ? null : String(row.client_message_id),
    sequence: row.sequence == null ? null : Number(row.sequence),
    createdAt: String(row.created_at),
    editedAt: row.edited_at == null ? null : String(row.edited_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    replyToMessageId: row.reply_to_message_id == null ? null : String(row.reply_to_message_id),
    threadId: row.thread_id == null ? null : String(row.thread_id),
    webhookId: row.webhook_id ? String(row.webhook_id) : undefined,
    webhookName: row.webhook_name ? String(row.webhook_name) : undefined,
  };
}

function authorLabel(
  t: TFunction,
  message: MessageSummary,
  currentUserId: string,
  profiles: ReadonlyMap<string, AuthorProfile>,
): string {
  if (message.authorId === currentUserId) return t("chat.you");
  if (message.webhookName) return message.webhookName;
  const profile = profiles.get(message.authorId);
  if (profile?.displayName?.trim()) return profile.displayName.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  return t("chat.unknownUser");
}

async function loadAuthorProfiles(authorIds: readonly string[]): Promise<Map<string, AuthorProfile>> {
  const unique = [...new Set(authorIds.filter(Boolean))];
  const map = new Map<string, AuthorProfile>();
  if (!unique.length) return map;
  const client = getSupabaseClient();
  if (!client) return map;
  const { data, error } = await client.from("profiles").select("id,display_name,username").in("id", unique);
  if (error || !data) return map;
  for (const row of data as Array<{ id: string; display_name: string | null; username: string | null }>) {
    map.set(row.id, {
      displayName: row.display_name?.trim() || "",
      username: row.username?.trim() || "",
    });
  }
  return map;
}

export function LiveWatchChat({
  open,
  communityId,
  channelId,
  channelName,
  currentUserId,
  readOnly,
  onToggle,
  onNotice,
}: LiveWatchChatProps) {
  const { t } = useTranslation("live");
  const [messages, setMessages] = useState<readonly MessageSummary[]>([]);
  const [profiles, setProfiles] = useState<ReadonlyMap<string, AuthorProfile>>(new Map());
  const [connection, setConnection] = useState<ChatConnection>("connecting");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set<string>());
  const profileCache = useRef(new Map<string, AuthorProfile>());

  const mergeProfiles = async (items: readonly MessageSummary[]) => {
    const missing = items
      .map((item) => item.authorId)
      .filter((id) => id && id !== currentUserId && !profileCache.current.has(id));
    if (!missing.length) {
      setProfiles(new Map(profileCache.current));
      return;
    }
    const loaded = await loadAuthorProfiles(missing);
    for (const [id, profile] of loaded) profileCache.current.set(id, profile);
    setProfiles(new Map(profileCache.current));
  };

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;
    knownIds.current = new Set();
    profileCache.current = new Map();
    setConnection("connecting");
    setMessages([]);
    setProfiles(new Map());

    void messageService.listMessages({ communityId, channelId, limit: 40 }).then(async (result) => {
      if (!active) return;
      if (!result.ok) {
        setConnection(result.error.code === "AUTH_REQUIRED" || result.error.code === "MESSAGE_SEND_FORBIDDEN" ? "denied" : "error");
        return;
      }
      const items = [...result.data.items].reverse();
      for (const item of items) knownIds.current.add(item.id);
      setMessages(items);
      await mergeProfiles(items);
      if (active) setConnection("ready");
    });

    const client = getSupabaseClient();
    if (client) {
      channel = client
        .channel(`live-watch-chat:${channelId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
          (payload) => {
            const message = mapMessage(payload.new as Record<string, unknown>);
            if (message.communityId !== communityId || knownIds.current.has(message.id) || message.deletedAt) return;
            knownIds.current.add(message.id);
            setMessages((current) => {
              const next = [...current, message].slice(-200);
              void mergeProfiles(next);
              return next;
            });
          },
        )
        .subscribe();
    }

    return () => {
      active = false;
      if (client && channel) void client.removeChannel(channel);
    };
  }, [communityId, channelId, currentUserId]);

  useEffect(() => {
    const node = listRef.current;
    if (!node || !open) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  const emptyLabel = useMemo(() => {
    if (connection === "denied") return "You do not have permission to view this channel chat.";
    if (connection === "error") return "Chat could not be loaded.";
    if (connection === "connecting") return "Loading chat…";
    return "No messages yet. Say hello when you are ready.";
  }, [connection]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || readOnly || connection === "denied") return;
    setSending(true);
    const result = await messageService.sendMessage({ communityId, channelId, body });
    setSending(false);
    if (!result.ok) {
      onNotice(result.error.message, "error");
      return;
    }
    setDraft("");
    if (!knownIds.current.has(result.data.id)) {
      knownIds.current.add(result.data.id);
      setMessages((current) => [...current, result.data].slice(-200));
    }
  };

  return (
    <aside
      className={`live-watch-chat ${open ? "is-open" : "is-collapsed"}`}
      aria-label={t("chat.aria")}
      aria-hidden={!open}
    >
      <div className="live-watch-chat__header">
        <div>
          <strong>{t("chat.title")}</strong>
          <span>#{channelName || t("chat.channelFallback")}</span>
        </div>
        <button type="button" className="live-watch-controls__btn" aria-label={open ? t("chat.close") : t("chat.open")} aria-expanded={open} onClick={onToggle}>
          <AppIcon name="close" size="sm" />
        </button>
      </div>

      {open ? (
        <>
          <div className="live-watch-chat__status" role="status" aria-live="polite">
            {connection === "ready" ? "Connected" : connection === "connecting" ? "Connecting…" : connection === "denied" ? "Permission denied" : "Chat error"}
          </div>
          <div className="live-watch-chat__list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 ? (
              <p className="live-watch-chat__empty">{emptyLabel}</p>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`live-watch-chat__item ${message.authorId === currentUserId ? "is-own" : ""}`}>
                  <span className="live-watch-chat__author">{authorLabel(t, message, currentUserId, profiles)}</span>
                  <p>{message.deletedAt ? "Message removed" : message.body}</p>
                </article>
              ))
            )}
          </div>
          <form
            className="live-watch-chat__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="live-watch-chat-input">
              Chat message
            </label>
            <input
              id="live-watch-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={readOnly ? t("chat.readOnly") : connection === "denied" ? t("chat.unavailable") : t("chat.placeholder")}
              disabled={readOnly || connection === "denied" || sending}
              maxLength={2000}
            />
            <button type="submit" className="live-watch-btn live-watch-btn--primary" disabled={readOnly || connection === "denied" || sending || !draft.trim()} aria-label={t("chat.send")}>
              <AppIcon name="send" size="sm" />
            </button>
          </form>
        </>
      ) : null}
    </aside>
  );
}
