import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { localizationService } from "../../services/localizationService";
import { translateLiveChat, type LiveChatI18nKey } from "../../services/localization/liveChatCatalog";
import { featureFlagService } from "../../services/featureFlagService";
import {
  liveChatService,
  type LiveChatMessage,
  type LiveChatViewerState,
} from "../../services/live/liveChatService";
import { authService } from "../../services/authService";
import "./LiveStreamChatPanel.css";

type Props = Readonly<{
  streamId: string;
  onNotice?: (message: string, kind?: "info" | "error" | "success") => void;
}>;

function t(key: LiveChatI18nKey, params?: Record<string, string | number>): string {
  return translateLiveChat(key, localizationService.getLanguage(), params);
}

function displayBody(message: LiveChatMessage): string {
  if (message.moderationState !== "visible") return t("liveChat.removed");
  return message.body;
}

export function LiveStreamChatPanel({ streamId, onNotice }: Props) {
  const enabled = featureFlagService.isEnabled("enableLiveChat");
  const moderationEnabled = featureFlagService.isEnabled("enableLiveModeration");
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [state, setState] = useState<LiveChatViewerState | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "offline">("connecting");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set<string>());

  const refreshState = async () => {
    const result = await liveChatService.getViewerState(streamId);
    if (!result.ok) {
      setConnection("offline");
      onNotice?.(result.error.message, "error");
      return;
    }
    setState(result.data);
    setConnection("connected");
  };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    knownIds.current = new Set();
    setConnection("connecting");
    void authService.getCurrentUser().then((user) => {
      if (active) setCurrentUserId(user.ok ? user.data?.id ?? null : null);
    });
    void liveChatService.listMessages(streamId, 50).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setConnection("offline");
        return;
      }
      for (const item of result.data) knownIds.current.add(item.id);
      setMessages(result.data);
    });
    void refreshState();
    const sub = liveChatService.subscribeMessages(streamId, (message, event) => {
      if (event === "UPDATE") {
        setMessages((current) => current.map((row) => (row.id === message.id ? message : row)));
        return;
      }
      if (knownIds.current.has(message.id)) return;
      knownIds.current.add(message.id);
      setMessages((current) => [...current, message].slice(-200));
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [enabled, streamId]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = globalThis.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => globalThis.clearTimeout(timer);
  }, [countdown]);

  const statusLabel = useMemo(() => {
    if (!state?.chatEnabled) return t("chatDisabled.title");
    if (state.isBanned) return t("banned.title");
    if (state.timeoutExpiresAt) return t("timedOut.title");
    if (connection === "connecting") return t("chatConnecting");
    if (connection === "reconnecting") return t("chatReconnecting");
    if (connection === "offline") return t("liveChat.offline");
    return t("liveChat.connected");
  }, [state, connection]);

  const inputDisabled =
    !enabled ||
    !state?.chatEnabled ||
    state.isBanned ||
    Boolean(state.timeoutExpiresAt) ||
    sending ||
    countdown > 0 ||
    connection === "offline";

  const send = async () => {
    const body = draft.trim();
    if (!body || inputDisabled) return;
    setSending(true);
    const result = await liveChatService.sendMessage({
      streamId,
      body,
      idempotencyKey: `lc-${streamId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
    setSending(false);
    if (!result.ok) {
      if (result.error.code === "SLOW_MODE" || result.error.code === "RATE_LIMITED") {
        setCountdown(result.error.retryAfterSeconds ?? state?.slowModeSeconds ?? 5);
      }
      onNotice?.(result.error.message, "error");
      return;
    }
    setDraft("");
    if (state?.slowModeSeconds && !state.canModerate) setCountdown(state.slowModeSeconds);
    if (!knownIds.current.has(result.data.id)) {
      knownIds.current.add(result.data.id);
      setMessages((current) => [...current, result.data].slice(-200));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  if (!enabled) return null;

  return (
    <section className="live-stream-chat" aria-label={t("liveChat.title")}>
      <header className="live-stream-chat__header">
        <strong>{t("liveChat.title")}</strong>
        <span role="status" aria-live="polite">
          {statusLabel}
        </span>
      </header>

      {state?.pinnedMessage ? (
        <div className="live-stream-chat__pin" role="note" aria-label={t("pin.banner")}>
          <strong>{t("pin.banner")}</strong>
          <p>{state.pinnedMessage.body}</p>
          {moderationEnabled && state.canModerate ? (
            <button type="button" onClick={() => void liveChatService.unpin(streamId).then(refreshState)}>
              {t("unpin.action")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="live-stream-chat__list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <p className="live-stream-chat__empty">{t("liveChat.empty")}</p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`live-stream-chat__item${message.senderUserId === currentUserId ? " is-own" : ""}`}
            >
              <div className="live-stream-chat__meta">
                <span>{message.senderUserId.slice(0, 8)}</span>
                {moderationEnabled && state?.canModerate && message.moderationState === "visible" ? (
                  <span className="live-stream-chat__actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (!globalThis.confirm(t("deleteMessage.confirm"))) return;
                        void liveChatService.removeMessage(message.id).then((result) => {
                          if (!result.ok) onNotice?.(result.error.message, "error");
                        });
                      }}
                    >
                      {t("deleteMessage.action")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void liveChatService.pinMessage(message.id).then(refreshState)}
                    >
                      {t("pin.action")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!globalThis.confirm(t("timeout.confirm"))) return;
                        void liveChatService.timeoutUser(streamId, message.senderUserId, 300).then((result) => {
                          if (!result.ok) onNotice?.(result.error.message, "error");
                        });
                      }}
                    >
                      {t("timeout.action")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!globalThis.confirm(t("ban.confirm"))) return;
                        void liveChatService.banUser(streamId, message.senderUserId).then((result) => {
                          if (!result.ok) onNotice?.(result.error.message, "error");
                        });
                      }}
                    >
                      {t("ban.action")}
                    </button>
                  </span>
                ) : null}
                {!state?.canModerate ? (
                  <button
                    type="button"
                    onClick={() =>
                      void liveChatService
                        .reportMessage({
                          streamId,
                          messageId: message.id,
                          targetUserId: message.senderUserId,
                          category: "spam",
                        })
                        .then((result) => onNotice?.(result.ok ? t("report.submit") : result.error.message, result.ok ? "success" : "error"))
                    }
                  >
                    {t("report.action")}
                  </button>
                ) : null}
              </div>
              <p>{displayBody(message)}</p>
            </article>
          ))
        )}
      </div>

      <form
        className="live-stream-chat__composer"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void send();
        }}
      >
        {state?.slowModeSeconds ? (
          <p className="live-stream-chat__slow" role="status">
            {countdown > 0 ? t("slowMode.wait", { seconds: countdown }) : t("slowMode.label", { seconds: state.slowModeSeconds })}
          </p>
        ) : null}
        <label className="sr-only" htmlFor={`live-stream-chat-${streamId}`}>
          {t("liveChat.composerPlaceholder")}
        </label>
        <textarea
          id={`live-stream-chat-${streamId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={state?.maxMessageLength ?? 500}
          disabled={inputDisabled}
          rows={2}
          placeholder={
            state?.isBanned
              ? t("banned.title")
              : state?.timeoutExpiresAt
                ? t("timedOut.title")
                : !state?.chatEnabled
                  ? t("chatDisabled.title")
                  : t("liveChat.composerPlaceholder")
          }
        />
        <button type="submit" disabled={inputDisabled || !draft.trim()} aria-label={t("liveChat.send")}>
          {t("liveChat.send")}
        </button>
      </form>
    </section>
  );
}
