import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppIcon } from "../../components/AppIcon";
import { UserAvatar } from "../../components/UserAvatar";
import { directAttachmentUploadService } from "../../services/directMessages/directAttachmentUploadService";
import { notificationPolicyStateService } from "../../services/notificationPolicyStateService";
import { companionDataService } from "./companionDataService";
import { getCompanionPreferences } from "./companionPreferences";
import type { CompanionRoute } from "./companionTypes";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function CompanionNotification({ route }: { route: CompanionRoute }) {
  const conversationId = route.conversationId ?? "";
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [peerName, setPeerName] = useState("Picom");
  const [peerId, setPeerId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [preview, setPreview] = useState("");
  const [body, setBody] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const dismissTimer = useRef<number | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const recordingChunks = useRef<Blob[]>([]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => {
      void window.picomDesktop?.companion?.closeCurrent();
    }, 280);
  };

  useEffect(() => {
    let active = true;
    void companionDataService.getConversations().then((conversations) => {
      if (!active) return;
      const conversation = conversations.find((item) => text(record(item).id) === conversationId);
      const source = record(conversation);
      setPeerName(text(source.participantName, "Arkadaş"));
      setPeerId(text(source.participantUserId));
      setAvatarUrl(text(source.participantAvatarUrl) || undefined);
      setPreview(text(source.lastMessagePreview, "Yeni bir mesaj gönderdi"));
    }).catch(() => setPreview("Yeni bir mesaj var"));
    const expandTimer = window.setTimeout(() => setExpanded(true), 1000);
    dismissTimer.current = window.setTimeout(() => dismiss(), 8000);
    return () => {
      active = false;
      window.clearTimeout(expandTimer);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
        mediaRecorder.current.onstop = null;
        mediaRecorder.current.stop();
      }
      recordingStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [conversationId]);

  const keepOpen = () => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    setExpanded(true);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await companionDataService.sendMessage(conversationId, trimmed);
      void window.picomDesktop?.companion?.broadcast({ topic: "direct-messages" });
      dismiss();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Yanıt gönderilemedi.");
    }
  };

  const toggleVoiceReply = async () => {
    keepOpen();
    if (recording) {
      mediaRecorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Voice recording is not available on this device.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunks.current = [];
      recordingStream.current = stream;
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunks.current.push(event.data); };
      recorder.onstop = () => {
        const chunks = recordingChunks.current;
        recordingChunks.current = [];
        stream.getTracks().forEach((track) => track.stop());
        recordingStream.current = null;
        mediaRecorder.current = null;
        setRecording(false);
        if (!chunks.length) return;
        const file = new File(chunks, `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(file);
        void directAttachmentUploadService.upload({ conversationId, file, previewUrl }).then(async (result) => {
          URL.revokeObjectURL(previewUrl);
          if (!result.ok) throw new Error(result.error.message);
          await companionDataService.sendMessage(conversationId, "", [result.data]);
          void window.picomDesktop?.companion?.broadcast({ topic: "direct-messages" });
          dismiss();
        }).catch((reason) => {
          URL.revokeObjectURL(previewUrl);
          setError(reason instanceof Error ? reason.message : "Voice reply could not be sent.");
        });
      };
      recorder.start();
      setRecording(true);
    } catch (reason) {
      setRecording(false);
      setError(reason instanceof Error ? reason.message : "Voice recording could not start.");
    }
  };

  if (!expanded) {
    return (
      <button type="button" className={`companion-toast-pill${leaving ? " is-leaving" : ""}`} onMouseEnter={keepOpen} onFocus={keepOpen} onClick={keepOpen}>
        <span className="companion-toast-pill__avatar" aria-hidden="true">{peerId ? <UserAvatar userId={peerId} displayName={peerName} fallbackUrl={avatarUrl} size={32} /> : initials(peerName)}</span>
        <strong>{peerName}</strong>
        <span>mesaj gönderdi</span>
      </button>
    );
  }

  return (
    <article className={`companion-toast-card${leaving ? " is-leaving" : ""}`} onMouseEnter={keepOpen}>
      <header>
        <UserAvatar userId={peerId || "peer"} displayName={peerName} fallbackUrl={avatarUrl} size={36} />
        <div>
          <strong>{peerName}</strong>
          <span>şimdi</span>
          <p>{preview}</p>
        </div>
        <button type="button" aria-label="Kapat" onClick={dismiss}><AppIcon name="close" size={13} /></button>
      </header>
      {error ? <div className="companion-inline-error" role="alert">{error}</div> : null}
      <form onSubmit={send}>
        <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Hızlı yanıt…" aria-label="Hızlı yanıt" />
        <button type="button" className={recording ? "is-recording" : ""} aria-label={recording ? "Kaydı bitir ve gönder" : "Sesli yanıt"} aria-pressed={recording} onClick={() => void toggleVoiceReply()}><AppIcon name="microphone" size={13} /></button>
        <button type="submit" disabled={!body.trim() && !recording}>Gönder</button>
        <button type="button" className="companion-toast-open-chat" onClick={() => { void window.picomDesktop?.companion?.openWindow({ type: "chat", conversationId }); dismiss(); }}>Sohbeti aç</button>
      </form>
    </article>
  );
}

export function CompanionGaming() {
  const [onlineLabel, setOnlineLabel] = useState("Sesli oda");
  const [toast, setToast] = useState<{ name: string; body: string; userId: string; avatarUrl?: string; conversationId?: string } | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void companionDataService.subscribeHome((snapshot) => {
      const room = snapshot.voiceRooms[0];
      setOnlineLabel(room ? room.name : `${snapshot.people.filter((person) => person.status === "online").length} çevrimiçi`);
      const unread = snapshot.people.find((person) => (person.unreadCount ?? 0) > 0);
      if (unread) {
        setToast({
          name: unread.displayName,
          body: unread.lastMessagePreview || "Yeni mesaj",
          userId: unread.userId,
          avatarUrl: unread.avatarUrl,
          conversationId: unread.conversationId,
        });
      }
    }).then((next) => { cleanup = next; });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void window.picomDesktop?.companion?.setClickThrough?.(true);
    const remove = window.picomDesktop?.companion?.onSync((event) => {
      if (event.topic !== "quick-reply" || !toast?.conversationId) return;
      void window.picomDesktop?.companion?.setClickThrough?.(false);
      void window.picomDesktop?.companion?.openWindow({ type: "notification", conversationId: toast.conversationId });
    });
    return () => {
      remove?.();
      void window.picomDesktop?.companion?.setClickThrough?.(true);
    };
  }, [toast]);

  const interactiveProps = {
    onMouseEnter: () => void window.picomDesktop?.companion?.setClickThrough?.(false),
    onMouseLeave: () => void window.picomDesktop?.companion?.setClickThrough?.(true),
  };

  return (
    <main className="companion-gaming">
      <div className="companion-gaming__capsule" aria-live="polite" {...interactiveProps}>
        <span className="companion-gaming__dot" aria-hidden="true" />
        <strong>{onlineLabel}</strong>
        <AppIcon name="microphone" size={12} />
      </div>
      {toast ? (
        <div className="companion-gaming__toast" {...interactiveProps}>
          <UserAvatar userId={toast.userId} displayName={toast.name} fallbackUrl={toast.avatarUrl} size={28} />
          <div>
            <strong>{toast.name}</strong>
            <span>{toast.body}</span>
          </div>
        </div>
      ) : null}
      <span className="companion-gaming__hint" {...interactiveProps}>Ctrl+Shift+Y — yanıtla</span>
      <button type="button" className="companion-gaming__close" aria-label="Oyun modunu kapat" {...interactiveProps} onClick={() => void window.picomDesktop?.companion?.closeCurrent()}>
        <AppIcon name="close" size={12} />
      </button>
    </main>
  );
}

export function useSmartCollapse(enabled: boolean, conversationId: string): void {
  useEffect(() => {
    if (!enabled || !conversationId) return;
    let timer: number | null = null;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void getCompanionPreferences().then((prefs) => {
          if (!prefs.smartCollapse) return;
          void window.picomDesktop?.companion?.openWindow({ type: "bubble" });
          void window.picomDesktop?.companion?.closeCurrent();
        });
      }, 60_000);
    };
    const onActivity = () => arm();
    arm();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [conversationId, enabled]);
}

export function useUnreadNotifications(enabled: boolean): void {
  const seen = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let cleanup: (() => void) | undefined;
    void companionDataService.subscribeHome((snapshot) => {
      if (seen.current === 0) {
        seen.current = snapshot.totalUnread;
        return;
      }
      if (snapshot.totalUnread > seen.current) {
        const dnd = notificationPolicyStateService.getSnapshot().doNotDisturb;
        void getCompanionPreferences().then((prefs) => {
          if (dnd || !prefs.showNotifications) {
            seen.current = snapshot.totalUnread;
            return;
          }
          const person = snapshot.people.find((item) => (item.unreadCount ?? 0) > 0 && item.conversationId);
          if (person?.conversationId) {
            void window.picomDesktop?.companion?.openWindow({ type: "notification", conversationId: person.conversationId });
            void window.picomDesktop?.showNotification?.({
              title: person.displayName,
              body: person.lastMessagePreview || "Yeni mesaj",
              tag: `companion-dm-${person.conversationId}`,
            });
          }
          seen.current = snapshot.totalUnread;
        });
        return;
      }
      seen.current = snapshot.totalUnread;
    }).then((next) => { cleanup = next; });
    return () => cleanup?.();
  }, [enabled]);
}
