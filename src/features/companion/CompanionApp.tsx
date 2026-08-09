import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AppIcon } from "../../components/AppIcon";
import { EmojiPicker } from "../../components/EmojiPicker";
import { UserAvatar } from "../../components/UserAvatar";
import { ProfileCover } from "../../components/ProfileCover";
import { ScreenSharePickerModal } from "../../components/voice/ScreenSharePickerModal";
import { brandLogoUrl } from "../../config/brandAssets";
import { useDirectTypingBroadcast } from "../../hooks/useDirectTypingBroadcast";
import { directAttachmentUploadService } from "../../services/directMessages/directAttachmentUploadService";
import { presencePreferenceService } from "../../services/presence/presencePreferenceService";
import { settingsService } from "../../services/settingsService";
import { trayService } from "../../services/trayService";
import type { VoiceServiceSnapshot } from "../../services/voiceService";
import { voiceDeviceService } from "../../services/voiceDeviceService";
import type { DmCall, DmCallType } from "../../types/dmCalls";
import type { DirectMessageAttachment } from "../../types/directMessages";
import type { PresencePreference } from "../../types/presence";
import { companionDataService, type Channel, type CommunityMessage, type DirectConversation, type DirectMessage } from "./companionDataService";
import { getCompanionPreferences, updateCompanionPreferences } from "./companionPreferences";
import {
  companionStatusLabel,
  parseCompanionRoute,
  type CompanionDockEdge,
  type CompanionCommunity,
  type CompanionHomeSnapshot,
  type CompanionPerson,
  type CompanionPreferences,
  type CompanionRoute,
  type CompanionVoiceRoom,
  type CompanionWindowType,
} from "./companionTypes";
import { CompanionGaming, CompanionNotification, useSmartCollapse, useUnreadNotifications } from "./companionExtraSurfaces";
import "./CompanionApp.css";

type UnknownRecord = Record<string, unknown>;
type PicomThemePreference = "light" | "dark" | "system";

const SYNC_CHANNEL = "picom-companion-v1";
const PICOM_SETTINGS_STORAGE_KEY = "picom-settings";

function isPicomThemePreference(value: unknown): value is PicomThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getPicomThemePreference(): PicomThemePreference {
  return settingsService.getSettings().appearanceSettings.themeMode;
}

function getPicomThemePreferenceFromStorage(rawValue: string | null): PicomThemePreference | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as { appearanceSettings?: { themeMode?: unknown } };
    const theme = parsed.appearanceSettings?.themeMode;
    return isPicomThemePreference(theme) ? theme : null;
  } catch {
    return null;
  }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateLabel(value: unknown): string {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function messageBody(message: unknown): string {
  const source = record(message);
  return source.deletedAt || source.deleted_at ? "" : text(source.body);
}

function messageIsDeleted(message: unknown): boolean {
  const source = record(message);
  return Boolean(source.deletedAt || source.deleted_at);
}

function messageCreatedAtMs(message: unknown): number {
  const source = record(message);
  const ms = Date.parse(text(source.createdAt ?? source.created_at));
  return Number.isFinite(ms) ? ms : 0;
}

const COMPANION_EDIT_WINDOW_MS = 5 * 60 * 1000;

function canEditCompanionMessage(message: unknown, currentUserId: string, now = Date.now()): boolean {
  if (!currentUserId || messageAuthorId(message) !== currentUserId || messageIsDeleted(message)) return false;
  const created = messageCreatedAtMs(message);
  return created > 0 && now - created <= COMPANION_EDIT_WINDOW_MS;
}

function ownMessageReceiptLabel(
  message: unknown,
  peerRead: Readonly<{ lastReadAt?: string; lastReadMessageId?: string }>,
): string {
  const status = text(record(message).sendStatus ?? (message as DirectMessage).sendStatus);
  if (status === "sending") return "Gönderiliyor";
  if (status === "failed") return "Gönderilemedi";
  const id = messageId(message);
  if (peerRead.lastReadMessageId && id && peerRead.lastReadMessageId === id) return "Görüldü";
  const createdMs = messageCreatedAtMs(message);
  const peerReadMs = Date.parse(text(peerRead.lastReadAt));
  if (createdMs > 0 && Number.isFinite(peerReadMs) && peerReadMs >= createdMs) return "Görüldü";
  return "Gönderildi";
}

function hiddenMessagesStorageKey(conversationId: string, userId: string): string {
  return `picom.companion.hidden-messages.v1.${conversationId}.${userId}`;
}

function loadHiddenMessageIds(conversationId: string, userId: string): Set<string> {
  if (!conversationId || !userId) return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(hiddenMessagesStorageKey(conversationId, userId)) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && Boolean(id)) : []);
  } catch {
    return new Set();
  }
}

function persistHiddenMessageIds(conversationId: string, userId: string, ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(hiddenMessagesStorageKey(conversationId, userId), JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

function messageAuthorId(message: unknown): string {
  const source = record(message);
  return text(source.authorId ?? source.author_id);
}

function messageId(message: unknown): string {
  return text(record(message).id);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function companionStatusFromPreference(preference: PresencePreference): CompanionPerson["status"] {
  if (preference === "dnd") return "busy";
  if (preference === "invisible") return "offline";
  return preference;
}

function openWindow(type: CompanionWindowType, details: Omit<CompanionRoute, "type"> = {}): void {
  const companion = window.picomDesktop?.companion;
  if (companion?.openWindow) {
    void companion.openWindow({ type, ...details });
    return;
  }

  // Keep the Companion usable in the Vite/browser preview when Electron IPC is
  // unavailable. Packaged builds still open the dedicated Companion window.
  const url = new URL(window.location.href);
  url.searchParams.set("picomWindow", "companion");
  url.searchParams.set("surface", type);
  for (const key of ["conversationId", "callId", "communityId", "channelId"] as const) {
    const value = details[key];
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function useCompanionSync(onSync: () => void): (topic: string) => void {
  const callback = useRef(onSync);
  callback.current = onSync;
  useEffect(() => {
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.onmessage = () => callback.current();
    const remove = window.picomDesktop?.companion?.onSync(() => callback.current());
    return () => {
      remove?.();
      channel.close();
    };
  }, []);
  return useCallback((topic: string) => {
    const revision = Date.now();
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.postMessage({ topic, revision });
    channel.close();
    void window.picomDesktop?.companion?.broadcast({ topic });
  }, []);
}

function CompanionFrame({
  title,
  subtitle,
  children,
  actions,
  variant = "default",
  brand = "copy",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "call" | "dock" | "bubble";
  brand?: "copy" | "wordmark";
}) {
  const shellClass = [
    "companion-shell",
    variant !== "default" ? `companion-shell--${variant}` : "",
    brand === "wordmark" ? "companion-shell--home" : "",
  ].filter(Boolean).join(" ");
  return (
    <main className={shellClass}>
      {variant === "bubble" ? children : (
        <>
          <header className={`companion-titlebar${brand === "wordmark" ? " companion-titlebar--home" : ""}`}>
            <div className="companion-titlebar__brand" aria-hidden="true"><img className="companion-titlebar__brand-image" src={brandLogoUrl} alt="" /></div>
            {brand === "wordmark" ? (
              <strong className="companion-wordmark">PICOM</strong>
            ) : (
              <div className="companion-titlebar__copy">
                <strong>{title}</strong>
                {subtitle ? <span>{subtitle}</span> : null}
              </div>
            )}
            <div className="companion-titlebar__actions">
              {actions}
              {brand === "wordmark" ? (
                <>
                  <button type="button" className="companion-return-main" aria-label="Ana moda don" onClick={() => void window.picomDesktop?.companion?.returnToMain()}>
                    <AppIcon name="maximize" size={13} />
                    <span>Ana mod</span>
                  </button>
                  <button type="button" className="companion-icon-button companion-icon-button--ghost" aria-label="Kucult" onClick={() => void window.picomDesktop?.windowControl?.("minimize")}>
                    <AppIcon name="chevronDown" size={14} />
                  </button>
                </>
              ) : variant !== "dock" ? (
                <button type="button" className="companion-icon-button" aria-label="Tam Picom'u aç" onClick={() => void window.picomDesktop?.companion?.returnToMain()}>
                  <AppIcon name="maximize" size={16} />
                </button>
              ) : null}
              <button type="button" className={`companion-icon-button${brand === "wordmark" ? " companion-icon-button--ghost" : ""}`} aria-label="Companion penceresini kapat" onClick={() => void window.picomDesktop?.companion?.closeCurrent()}>
                <AppIcon name="close" size={16} />
              </button>
            </div>
          </header>
          {children}
        </>
      )}
    </main>
  );
}

function LoadingState({ label = "Canlı Picom verileri yükleniyor…" }: { label?: string }) {
  return (
    <div className="companion-state" aria-busy="true" aria-label={label}>
      <div className="companion-skeleton" aria-hidden="true">
        <div className="companion-skeleton__row" /><div className="companion-skeleton__row" /><div className="companion-skeleton__row" />
      </div>
    </div>
  );
}

function isCompanionAuthRequiredError(message: string): boolean {
  return /AUTH_REQUIRED|AUTH_SESSION|session expired|sign in again|sign in to use|Email or password is incorrect|not authenticated|oturum|giriş yap/i.test(message);
}

function returnToMainMode(): void {
  void window.picomDesktop?.companion?.returnToMain();
}

function AuthRequiredState() {
  useEffect(() => {
    // Only auto-return when Electron companion IPC exists; browsers keep the CTA visible.
    if (!window.picomDesktop?.companion?.returnToMain) return;
    const timer = window.setTimeout(() => returnToMainMode(), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="companion-state companion-state--auth" role="status">
      <AppIcon name="lock" size={18} />
      <strong>Oturum gerekli</strong>
      <span>Companion’ı kullanmak için önce Ana modda giriş yapın. Zaten giriş yaptıysanız Ana moda dönüp tekrar Companion’ı açın.</span>
      <button type="button" className="companion-state__primary" onClick={returnToMainMode}>
        Ana moda dön
      </button>
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  if (isCompanionAuthRequiredError(message)) {
    return <AuthRequiredState />;
  }

  return (
    <div className="companion-state companion-state--error">
      <AppIcon name="close" size={18} />
      <strong>{message}</strong>
      <div className="companion-state__actions">
        <button type="button" onClick={retry}>Tekrar dene</button>
        <button type="button" className="companion-state__primary" onClick={returnToMainMode}>Ana moda dön</button>
      </div>
    </div>
  );
}

function FluentToggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`companion-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    />
  );
}

const VOICE_WAVE_BAR_COUNT = 9;

function voiceWaveScale(index: number, energy: number, t: number): number {
  const phase = index * 0.72;
  const a = Math.sin(t * (2.6 + index * 0.16) + phase);
  const b = Math.sin(t * (3.4 - index * 0.11) + phase * 1.35);
  return Math.max(0.12, Math.min(1, 0.12 + energy * (0.26 + 0.62 * Math.abs(a * b + a * 0.32))));
}

function CompanionVoiceWave({ active = true, intense = false }: { active?: boolean; intense?: boolean }) {
  const reduceMotion = useReducedMotion();
  const energy = intense ? 1 : 0.48;
  const idle = !active || Boolean(reduceMotion);

  return (
    <div className={`companion-call-wave${intense ? " is-hot" : ""}${active ? " is-active" : ""}`} aria-hidden="true">
      {Array.from({ length: VOICE_WAVE_BAR_COUNT }, (_, index) => {
        const resting = 0.18 + (index % 4) * 0.1;
        if (idle) {
          return (
            <motion.i
              key={index}
              initial={false}
              animate={{ scaleY: resting }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            />
          );
        }

        const keyframes = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => voiceWaveScale(index, energy, t * Math.PI * 2));
        return (
          <motion.i
            key={`${index}-${intense ? "hot" : "soft"}`}
            initial={{ scaleY: resting }}
            animate={{ scaleY: keyframes }}
            transition={{
              duration: 1.05 + (index % 3) * 0.14,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.06,
            }}
          />
        );
      })}
    </div>
  );
}

function CompanionCallControls(props: Readonly<{
  muted: boolean;
  deafened: boolean;
  connected: boolean;
  busy?: boolean;
  className?: string;
  leaveLabel?: string;
  extras?: ReactNode;
  onLeave: () => void;
  onError?: (message: string) => void;
}>) {
  const [outputVolume, setOutputVolume] = useState(() => companionDataService.getOutputVolume());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"mute" | "deafen" | null>(null);
  const [devices, setDevices] = useState(() => {
    try {
      return voiceDeviceService.getSnapshot();
    } catch {
      return null;
    }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const controlsEnabled = props.connected || props.busy;

  useEffect(() => {
    let active = true;
    try {
      const unsubscribe = voiceDeviceService.subscribe((snapshot) => {
        if (active) setDevices(snapshot);
      });
      void voiceDeviceService.refresh(false);
      return () => {
        active = false;
        unsubscribe();
      };
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onPointer = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && panelRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  const report = (reason: unknown, fallback: string) => {
    props.onError?.(reason instanceof Error ? reason.message : fallback);
  };

  const toggleMute = async () => {
    if (busyAction) return;
    setBusyAction("mute");
    try {
      await companionDataService.setMuted(!props.muted);
    } catch (reason) {
      report(reason, "Mikrofon durumu değiştirilemedi.");
    } finally {
      setBusyAction(null);
    }
  };

  const toggleDeafen = () => {
    if (busyAction) return;
    setBusyAction("deafen");
    try {
      companionDataService.setDeafened(!props.deafened);
    } catch (reason) {
      report(reason, "Kulaklık durumu değiştirilemedi.");
    } finally {
      setBusyAction(null);
    }
  };

  const changeVolume = (next: number) => {
    const value = companionDataService.setOutputVolume(next);
    setOutputVolume(value);
  };

  const volumePercent = Math.round(outputVolume * 100);

  return (
    <footer className={`companion-call-controls companion-call-controls--dock${props.className ? ` ${props.className}` : ""}`} ref={panelRef}>
      <div className="companion-call-controls__group" role="group" aria-label="Ses kontrolleri">
        <button
          type="button"
          className={props.muted ? "is-off" : ""}
          disabled={!controlsEnabled || busyAction === "mute"}
          onClick={() => void toggleMute()}
          aria-label={props.muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
          aria-pressed={props.muted}
          title={props.muted ? "Mikrofon kapalı" : "Mikrofon açık"}
        >
          <AppIcon name="microphone" size={16} />
        </button>
        <button
          type="button"
          className={props.deafened ? "is-off" : ""}
          disabled={!controlsEnabled || busyAction === "deafen"}
          onClick={toggleDeafen}
          aria-label={props.deafened ? "Sesi aç" : "Sesi kapat"}
          aria-pressed={props.deafened}
          title={props.deafened ? "Kulaklık kapalı" : "Kulaklık açık"}
        >
          <AppIcon name={props.deafened ? "volumeOff" : "headphones"} size={16} />
        </button>
      </div>

      <div className="companion-call-controls__volume" role="group" aria-label="Ses seviyesi">
        <button
          type="button"
          disabled={!controlsEnabled || outputVolume <= 0}
          onClick={() => changeVolume(Math.max(0, outputVolume - 0.1))}
          aria-label="Sesi kıs"
          title="Sesi kıs"
        >
          −
        </button>
        <label className="companion-call-controls__volume-meter">
          <span className="visually-hidden">Çıkış sesi</span>
          <AppIcon name={outputVolume <= 0.01 || props.deafened ? "volumeOff" : "volume"} size={13} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={outputVolume}
            disabled={!controlsEnabled}
            aria-valuetext={`%${volumePercent}`}
            onChange={(event) => changeVolume(Number(event.target.value))}
          />
          <em>{volumePercent}%</em>
        </label>
        <button
          type="button"
          disabled={!controlsEnabled || outputVolume >= 1}
          onClick={() => changeVolume(Math.min(1, outputVolume + 0.1))}
          aria-label="Sesi aç"
          title="Sesi aç"
        >
          +
        </button>
      </div>

      <div className="companion-call-controls__group">
        {props.extras}
        <button
          type="button"
          className={settingsOpen ? "is-active" : ""}
          aria-label="Ses ayarları"
          aria-expanded={settingsOpen}
          title="Ayarlar"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <AppIcon name="settings" size={16} />
        </button>
        <button type="button" className="is-danger" onClick={props.onLeave} aria-label={props.leaveLabel ?? "Sesli odadan ayrıl"} title="Ayrıl">
          <AppIcon name="close" size={16} />
        </button>
      </div>

      {settingsOpen ? (
        <div className="companion-voice-settings" role="dialog" aria-label="Ses ayarları">
          <strong>Ses ayarları</strong>
          <label>
            <span>Mikrofon</span>
            <select
              value={devices?.selectedInputId ?? "default"}
              disabled={!devices || devices.permission !== "granted" || devices.inputDevices.length === 0}
              onChange={(event) => void voiceDeviceService.selectInput(event.target.value)}
            >
              {(devices?.inputDevices.length ? devices.inputDevices : [{ deviceId: "default", label: "Sistem varsayılanı" }]).map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Hoparlör</span>
            <select
              value={devices?.selectedOutputId ?? "default"}
              disabled={!devices || devices.outputDevices.length === 0}
              onChange={(event) => voiceDeviceService.selectOutput(event.target.value)}
            >
              {(devices?.outputDevices.length ? devices.outputDevices : [{ deviceId: "default", label: "Sistem varsayılanı" }]).map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Çıkış sesi · %{volumePercent}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={outputVolume}
              onChange={(event) => changeVolume(Number(event.target.value))}
            />
          </label>
          {devices ? (
            <label>
              <span>Mikrofon hassasiyeti · %{Math.round(devices.inputSensitivity * 100)}</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={devices.inputSensitivity}
                onChange={(event) => voiceDeviceService.updateProcessingOptions({ inputSensitivity: Number(event.target.value) })}
              />
            </label>
          ) : null}
          <div className="companion-voice-settings__actions">
            <button type="button" onClick={() => void voiceDeviceService.refresh(true)}>Cihazları yenile</button>
            <button type="button" onClick={() => void voiceDeviceService.testOutput()} disabled={Boolean(devices?.outputTestActive)}>
              {devices?.outputTestActive ? "Test…" : "Hoparlör testi"}
            </button>
          </div>
        </div>
      ) : null}
    </footer>
  );
}

function CompanionVoiceStage(props: Readonly<{
  title: string;
  eyebrow?: string;
  status: "connecting" | "connected" | "waiting";
  statusLabel: string;
  participants: ReadonlyArray<{ identity: string; name: string; isLocal?: boolean; isSpeaking?: boolean; isMicrophoneEnabled?: boolean; avatarUrl?: string }>;
  waveActive?: boolean;
  waveIntense?: boolean;
  hero?: Readonly<{ userId?: string; displayName: string; avatarUrl?: string }>;
}>) {
  const speaking = props.participants.some((participant) => participant.isSpeaking);
  const roster = props.participants.slice(0, 8);
  const remoteHero = props.participants.find((participant) => !participant.isLocal);
  const hero = props.hero ?? (remoteHero
    ? { userId: remoteHero.identity, displayName: remoteHero.name || props.title, avatarUrl: remoteHero.avatarUrl }
    : undefined);
  const heroName = hero?.displayName || props.title;
  return (
    <div
      className={`companion-call-stage companion-call-stage--voice${
        props.status === "connected" ? " is-live" : props.status === "connecting" ? " is-connecting" : " is-waiting"
      }`}
    >
      <div className="companion-call-ambient" aria-hidden="true" />
      <div className="companion-call-hero">
        <div className={`companion-call-orbit${speaking ? " is-speaking" : ""}`} aria-hidden="true">
          <span className="companion-call-orbit__ring" />
          <span className="companion-call-orbit__ring" />
          <div className={`companion-call-avatar${props.status === "connected" ? " is-online" : ""}${speaking ? " is-speaking" : ""}`}>
            {hero?.userId || hero?.avatarUrl ? (
              <UserAvatar
                userId={hero.userId}
                displayName={heroName}
                fallbackUrl={hero.avatarUrl}
                size={84}
                priority="eager"
                className="companion-call-avatar__photo"
              />
            ) : (
              initials(heroName)
            )}
          </div>
        </div>
        <div className="companion-call-meta">
          {props.eyebrow ? <span className="companion-call-eyebrow"><AppIcon name="voice" size={11} />{props.eyebrow}</span> : null}
          <strong>{props.title}</strong>
          <span
            className={`companion-call-status${
              props.status === "connecting" ? " is-connecting" : props.status === "connected" ? " is-connected" : " is-waiting"
            }`}
          >
            <span className="companion-call-status__dot" aria-hidden="true" />
            {props.statusLabel}
          </span>
        </div>
        <CompanionVoiceWave active={Boolean(props.waveActive)} intense={Boolean(props.waveIntense)} />
      </div>
      {roster.length ? (
        <ul className="companion-call-roster" aria-label="Katılımcılar">
          {roster.map((participant) => (
            <li
              key={participant.identity}
              className={`companion-call-roster__item${participant.isSpeaking ? " is-speaking" : ""}${participant.isLocal ? " is-self" : ""}${participant.isMicrophoneEnabled === false ? " is-muted" : ""}`}
            >
              <span className="companion-call-roster__avatar" aria-hidden="true">
                <UserAvatar
                  userId={participant.identity}
                  displayName={participant.name}
                  fallbackUrl={participant.avatarUrl}
                  size={26}
                  className="companion-call-roster__photo"
                />
              </span>
              <span className="companion-call-roster__name">{participant.isLocal ? "Sen" : participant.name}</span>
              {participant.isMicrophoneEnabled === false ? <AppIcon name="microphone" size={10} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="companion-call-empty-hint">
          {props.status === "connecting" ? "Güvenli ses bağlantısı kuruluyor…" : props.status === "waiting" ? "Bağlantı bekleniyor…" : "Konuşmaya başla"}
        </p>
      )}
    </div>
  );
}

function PersonRow({
  person,
  onCall,
  focused = false,
  unreadTone = "accent",
  groupStyle = false,
}: {
  person: CompanionPerson;
  onCall: (type: DmCallType) => void;
  focused?: boolean;
  unreadTone?: "accent" | "muted";
  groupStyle?: boolean;
}) {
  const gaming = /oyun|playing|game/i.test(`${person.activityLabel ?? ""} ${person.status}`);
  const genericActivity = /^(online|offline|away|idle|busy|dnd|do not disturb|in game)$/i.test((person.activityLabel ?? "").trim());
  const activity = gaming
    ? "Oyunda"
    : !person.activityLabel || genericActivity
      ? companionStatusLabel(person.status === "busy" ? "busy" : person.status)
      : person.activityLabel;
  const isTyping = /yazıyor|typing/i.test(person.activityLabel ?? "");
  const statusTone = gaming ? "gaming" : person.status === "busy" ? "dnd" : person.status;
  const offline = person.status === "offline" && !gaming;
  const unread = person.unreadCount ?? 0;
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const subtitle = groupStyle && unread > 0
    ? `${unread} yeni mesaj`
    : isTyping
      ? null
      : activity;
  return (
    <article className={`companion-person-row${focused ? " is-focused" : ""}${offline ? " is-offline" : ""}`}>
      <button
        type="button"
        className="companion-person-main"
        disabled={!person.conversationId}
        draggable={Boolean(person.conversationId)}
        onDragStart={(event) => {
          dragOrigin.current = { x: event.clientX, y: event.clientY };
          event.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={(event) => {
          if (!person.conversationId || !dragOrigin.current) return;
          const distance = Math.hypot(event.clientX - dragOrigin.current.x, event.clientY - dragOrigin.current.y);
          if (distance > 48) openWindow("chat", { conversationId: person.conversationId });
          dragOrigin.current = null;
        }}
        onClick={() => person.conversationId && openWindow("chat", { conversationId: person.conversationId })}
      >
        {groupStyle ? (
          <span className="companion-group-avatar" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="3" />
              <circle cx="14" cy="8" r="2.4" />
              <path d="M2 17a5 5 0 0 1 10 0M11.5 16.5a4 4 0 0 1 6.5-2.5" />
            </svg>
          </span>
        ) : (
          <span className="companion-avatar-wrap">
            <UserAvatar userId={person.userId} displayName={person.displayName} fallbackUrl={person.avatarUrl} size={36} />
            {!offline ? <span className={`companion-presence companion-presence--${statusTone}`} aria-hidden="true" /> : null}
          </span>
        )}
        <span className="companion-person-copy">
          <strong>{person.displayName}</strong>
          <small className={`companion-status-text companion-status-text--${groupStyle && unread > 0 ? "online" : statusTone}${isTyping && !groupStyle ? " is-typing" : ""}`}>
            {isTyping && !groupStyle ? <>yazıyor<span className="companion-typing" aria-hidden="true"><i /><i /><i /></span></> : subtitle}
          </small>
        </span>
      </button>
      {unread > 0 ? (
        <span className={`companion-unread-pill${unreadTone === "muted" ? " companion-unread-pill--muted" : ""}`}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
      {person.conversationId && !groupStyle ? (
        <div className="companion-row-actions">
          <button type="button" aria-label={`${person.displayName} ile sohbet`} onClick={() => openWindow("chat", { conversationId: person.conversationId })}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M13 3H3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 3 12h2v2.5L8.5 12H13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 13 3z" />
            </svg>
          </button>
          <button type="button" aria-label={`${person.displayName} sesli arama`} onClick={() => onCall("voice")}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M3 2h3l1.5 3.5L6 7a9 9 0 0 0 3 3l1.5-1.5L14 10v3a1 1 0 0 1-1 1A11 11 0 0 1 2 3a1 1 0 0 1 1-1z" />
            </svg>
          </button>
        </div>
      ) : null}
    </article>
  );
}


type CompanionHomeSurface = "chats" | "calls" | "communities";
type CompanionHomeSection = "recent" | "online" | "offline" | "voice";

const companionPresenceChoices: readonly Readonly<{ value: PresencePreference; label: string }>[] = [
  { value: "online", label: "Cevrimici" },
  { value: "idle", label: "Bosta" },
  { value: "dnd", label: "Rahatsiz Etmeyin" },
  { value: "invisible", label: "Gorunmez" },
];

function formatCallDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

type CompanionCallOutcome = Readonly<{
  answered: boolean;
  failed: boolean;
  label: string;
  detail: string;
}>;

function companionCallOutcome(call: DmCall, currentUserId: string): CompanionCallOutcome {
  const outgoing = call.createdBy === currentUserId;
  const duration = call.durationSeconds > 0 ? formatCallDuration(call.durationSeconds) : "";
  // `duration_seconds` measures the lifetime of the call record, including
  // ringing. A completed record is only an answered call after a participant
  // actually joined or the backend recorded a connection.
  const wasConnected = Boolean(call.connectedAt) || call.participants.some((participant) =>
    Boolean(participant.joinedAt) || participant.finalStatus === "connected" || participant.finalStatus === "reconnecting",
  );
  const unanswered = (): CompanionCallOutcome => ({
    answered: false,
    failed: true,
    label: outgoing ? "Cevaplanmadı" : "Cevapsız",
    detail: outgoing ? "Karşı taraf bakmadı" : "Kaçırdın",
  });
  switch (call.status) {
    case "ringing":
      return { answered: false, failed: false, label: outgoing ? "Aranıyor" : "Gelen arama", detail: "Sesli" };
    case "active":
      return wasConnected
        ? { answered: true, failed: false, label: "Devam ediyor", detail: duration ? `${duration}` : "Bağlı" }
        : { answered: false, failed: false, label: "Bağlanıyor", detail: "Bağlantı kuruluyor" };
    case "missed":
      return { answered: false, failed: true, label: "Cevapsız", detail: outgoing ? "Karşı taraf bakmadı" : "Kaçırdın" };
    case "declined":
      return { answered: false, failed: true, label: outgoing ? "Reddedildi" : "Reddettin", detail: "Cevaplanmadı" };
    case "canceled":
      return { answered: false, failed: true, label: "İptal edildi", detail: outgoing ? "Sen iptal ettin" : "Karşı taraf iptal etti" };
    case "busy":
      return { answered: false, failed: true, label: "Meşgul", detail: "Cevaplanmadı" };
    case "failed":
      return { answered: false, failed: true, label: "Bağlanamadı", detail: "Arama başarısız" };
    case "completed":
    default:
      if (wasConnected) {
        return { answered: true, failed: false, label: "Cevaplandı", detail: `${duration} sürdü` };
      }
      return unanswered();
  }
}

function callPeer(call: DmCall, currentUserId: string): DmCall["participants"][number] | undefined {
  return call.participants.find((participant) => participant.userId !== currentUserId) ?? call.participants[0];
}

function CompanionHome() {
  const [snapshot, setSnapshot] = useState<CompanionHomeSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [presencePreference, setPresencePreference] = useState<PresencePreference>(() => presencePreferenceService.get());
  const [error, setError] = useState("");
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [surface, setSurface] = useState<CompanionHomeSurface>("chats");
  const [expandedSections, setExpandedSections] = useState<Record<CompanionHomeSection, boolean>>({ recent: true, online: true, offline: false, voice: true });
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState("");
  const [openingConversationUserId, setOpeningConversationUserId] = useState("");
  const [callHistory, setCallHistory] = useState<readonly DmCall[]>([]);
  const [callHistoryError, setCallHistoryError] = useState("");
  const [joiningVoiceRoomId, setJoiningVoiceRoomId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    cleanup.current?.();
    try {
      setError("");
      cleanup.current = await companionDataService.subscribeHome(setSnapshot);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Companion kisilerinizi yukleyemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setTimeout(() => setShowSkeleton(false), 1400);
    return () => {
      cleanup.current?.();
      window.clearTimeout(timer);
    };
  }, [load]);

  const broadcastSync = useCompanionSync(() => void load());
  useEffect(() => presencePreferenceService.subscribe(setPresencePreference), []);

  const joinVoiceRoom = useCallback(async (room: CompanionVoiceRoom) => {
    if (joiningVoiceRoomId) return;
    setJoiningVoiceRoomId(room.id);
    setError("");
    try {
      await companionDataService.joinCommunityVoiceRoom({
        communityId: room.communityId,
        communityName: room.communityName,
        channelId: room.id,
        channelName: room.name,
        participantName: snapshot?.currentUser?.displayName || "Picom",
      });
      openWindow("community", { communityId: room.communityId, channelId: room.id });
      broadcastSync("communities");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sesli odaya baglanilamadi.");
    } finally {
      setJoiningVoiceRoomId("");
    }
  }, [broadcastSync, joiningVoiceRoomId, snapshot?.currentUser?.displayName]);

  const people = useMemo(
    () => (snapshot?.people ?? []).filter((person) => `${person.displayName} ${person.username}`.toLowerCase().includes(query.toLowerCase())),
    [query, snapshot],
  );
  const recent = useMemo(() => people.filter((person) => Boolean(person.conversationId)).slice(0, 8), [people]);
  const online = useMemo(() => people.filter((person) => person.status !== "offline"), [people]);
  const offline = useMemo(() => people.filter((person) => person.status === "offline"), [people]);
  const flatPeople = useMemo(() => {
    const byUser = new Map<string, CompanionPerson>();
    [...recent, ...online, ...offline].forEach((person) => byUser.set(person.userId, person));
    return [...byUser.values()];
  }, [offline, online, recent]);
  const currentUserId = snapshot?.currentUser?.userId ?? "";
  const peopleByUserId = useMemo(() => new Map(people.map((person) => [person.userId, person])), [people]);
  const newChatCandidates = useMemo(
    () => people.filter((person) => person.userId !== currentUserId && `${person.displayName} ${person.username}`.toLowerCase().includes(newChatQuery.trim().toLowerCase())),
    [currentUserId, newChatQuery, people],
  );

  const loadCallHistory = useCallback(async () => {
    try {
      setCallHistoryError("");
      const calls = await companionDataService.getCallHistory();
      setCallHistory([...calls].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)));
    } catch (reason) {
      setCallHistoryError(reason instanceof Error ? reason.message : "Arama gecmisi yuklenemedi.");
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((index) => Math.min(index + 1, Math.max(flatPeople.length - 1, 0)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        const person = flatPeople[focusIndex];
        if (person?.conversationId) openWindow("chat", { conversationId: person.conversationId });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatPeople, focusIndex]);

  const beginCall = async (person: CompanionPerson, callType: DmCallType) => {
    if (!person.conversationId) return;
    try {
      const call = await companionDataService.startDirectCall(person.conversationId, person, callType);
      broadcastSync("calls");
      openWindow(callType, { conversationId: person.conversationId, callId: call.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Arama baslatilamadi.");
    }
  };

  const status = companionStatusFromPreference(presencePreference);
  const changePresence = (next: PresencePreference) => {
    presencePreferenceService.set(next);
    setPresencePreference(next);
    setIsStatusMenuOpen(false);
    void window.picomDesktop?.tray?.setStatus(next);
    broadcastSync("presence");
  };
  const toggleSection = (section: CompanionHomeSection) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };
  const openConversation = async (person: CompanionPerson) => {
    try {
      setOpeningConversationUserId(person.userId);
      const conversationId = person.conversationId ?? await companionDataService.createOrOpenConversation(person.userId);
      setIsNewChatOpen(false);
      setNewChatQuery("");
      broadcastSync("direct-conversation");
      openWindow("chat", { conversationId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sohbet baslatilamadi.");
    } finally {
      setOpeningConversationUserId("");
    }
  };
  const openCalls = () => {
    setSurface("calls");
    void loadCallHistory();
  };
  const openCommunities = () => {
    setSurface("communities");
  };
  const renderSection = (
    section: CompanionHomeSection,
    label: string,
    members: readonly CompanionPerson[],
    options?: { count?: number; hideCount?: boolean; unreadTone?: "accent" | "muted"; groupStyle?: boolean },
  ) => (
    members.length ? (
      <section className={`companion-section${expandedSections[section] ? "" : " is-collapsed"}`} key={label}>
        <button type="button" className="companion-section-title companion-section-title--toggle" aria-expanded={expandedSections[section]} onClick={() => toggleSection(section)}>
          <span>{label}</span>
          <span className="companion-section-title__meta">
            {options?.hideCount ? null : <b>{options?.count ?? members.length}</b>}
            <AppIcon name="chevronDown" size={13} />
          </span>
        </button>
        {expandedSections[section] ? members.map((person) => (
          <PersonRow
            key={person.userId}
            person={person}
            focused={flatPeople[focusIndex]?.userId === person.userId}
            unreadTone={options?.unreadTone ?? "accent"}
            groupStyle={options?.groupStyle}
            onCall={(type) => void beginCall(person, type)}
          />
        )) : null}
      </section>
    ) : null
  );

  return (
    <CompanionFrame title="Picom Companion" brand="wordmark">
      {!snapshot && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : (
        <div className="companion-home">
          {showSkeleton && !snapshot?.people.length ? <LoadingState /> : null}
          <section className="companion-self-hero">
            <div className="companion-self-hero__banner" aria-hidden={!snapshot?.currentUser?.userId}>
              <ProfileCover
                userId={snapshot?.currentUser?.userId}
                label="Profil kapak resmi"
                className="companion-self-hero__cover"
              />
            </div>
            <div className="companion-self-hero__body">
              <span className="companion-avatar-wrap companion-avatar-wrap--self">
                <UserAvatar userId={snapshot?.currentUser?.userId ?? "current-user"} displayName={snapshot?.currentUser?.displayName ?? "Picom kullanicisi"} size={56} />
                <span className={`companion-presence companion-presence--${status}`} aria-hidden="true" />
              </span>
              <div className="companion-self-hero__identity">
                <strong>{snapshot?.currentUser?.displayName ?? "Picom kullanicisi"}</strong>
                <span className={`companion-status-chip companion-status-chip--${status}`}>
                  <span className={`companion-status-dot companion-status-dot--${status}`} aria-hidden="true" />
                  {companionStatusLabel(status)}
                </span>
              </div>
              <button type="button" className="companion-icon-button companion-icon-button--ghost" aria-label="Durumu degistir" aria-expanded={isStatusMenuOpen} onClick={() => setIsStatusMenuOpen((current) => !current)}>...</button>
              {isStatusMenuOpen ? (
                <div className="companion-status-menu" role="menu" aria-label="Durum secenekleri">
                  {companionPresenceChoices.map((choice) => (
                    <button key={choice.value} type="button" role="menuitemradio" aria-checked={presencePreference === choice.value} onClick={() => changePresence(choice.value)}>
                      <span className={`companion-status-dot companion-status-dot--${companionStatusFromPreference(choice.value)}`} aria-hidden="true" />
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          <div className="companion-home-search-row">
            <label className="companion-search">
              <AppIcon name="search" size={13} />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ara veya kullanici adi gir..." aria-label="Arkadas ve sohbet ara" />
            </label>
            <button type="button" className="companion-icon-button companion-home-add" aria-label="Yeni sohbet" onClick={() => setIsNewChatOpen(true)}>+</button>
          </div>
          {surface === "chats" ? (
            <div className="companion-home-scroll">
              {renderSection("recent", "Son Konusmalar", recent, { hideCount: true, unreadTone: "accent" })}
              {renderSection("online", "Cevrimici", online)}
              {renderSection("offline", "Cevrimdisi", offline)}
              {(snapshot?.voiceRooms?.length ?? 0) > 0 ? (
                <section className={`companion-section${expandedSections.voice ? "" : " is-collapsed"}`}>
                  <button type="button" className="companion-section-title companion-section-title--toggle" aria-expanded={expandedSections.voice} onClick={() => toggleSection("voice")}>
                    <span>Sesli Odalar</span>
                    <span className="companion-section-title__meta"><b>{snapshot!.voiceRooms.length}</b><AppIcon name="chevronDown" size={13} /></span>
                  </button>
                  {expandedSections.voice ? snapshot!.voiceRooms.slice(0, 3).map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      className={`companion-voice-room${joiningVoiceRoomId === room.id ? " is-joining" : ""}`}
                      disabled={Boolean(joiningVoiceRoomId)}
                      aria-busy={joiningVoiceRoomId === room.id}
                      onClick={() => void joinVoiceRoom(room)}
                    >
                      <span className="companion-voice-room__media" aria-hidden="true">
                        <span className="companion-voice-room__live">
                          <span className="companion-voice-room__pulse" />
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M8 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14" />
                          </svg>
                        </span>
                        <span className="companion-voice-room__badge">{Math.max(0, room.participantCount)}</span>
                      </span>
                      <span className="companion-voice-room__copy">
                        <strong>{room.name}</strong>
                        <small>
                          <span className="companion-voice-room__dot" />
                          {room.communityName}
                          <span className="companion-voice-room__sep">·</span>
                          {room.participantCount} kisi
                        </small>
                      </span>
                      <span className="companion-voice-room__join">
                        {joiningVoiceRoomId === room.id ? "Baglaniyor…" : "Katıl"}
                      </span>
                    </button>
                  )) : null}
                </section>
              ) : null}
              {!people.length ? (
                <div className="companion-empty">
                  <strong>Henuz arkadasin yok</strong>
                  <span>Arkadaslik isteklerini ana Picom penceresinden yonetebilirsin.</span>
                  <button type="button" onClick={() => void window.picomDesktop?.companion?.returnToMain()}>Arkadaslari ac</button>
                </div>
              ) : null}
            </div>
          ) : surface === "calls" ? (
            <div className="companion-home-scroll companion-calls-surface">
              <header className="companion-calls-header">
                <div className="companion-calls-header__copy">
                  <strong>Aramalar</strong>
                  <span>
                    {callHistory.length
                      ? `${callHistory.length} kayit`
                      : "Sesli ve goruntulu arama gecmisi"}
                  </span>
                </div>
                <button
                  type="button"
                  className="companion-calls-refresh"
                  aria-label="Arama gecmisini yenile"
                  onClick={() => void loadCallHistory()}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.6" />
                    <path d="M13.5 2.5V6H10" />
                  </svg>
                  Yenile
                </button>
              </header>
              {callHistoryError ? <ErrorState message={callHistoryError} retry={() => void loadCallHistory()} /> : null}
              {!callHistoryError && callHistory.length === 0 ? (
                <div className="companion-empty companion-empty--calls">
                  <span className="companion-empty--calls__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 2h3l1.5 3.5L6 7a9 9 0 0 0 3 3l1.5-1.5L14 10v3a1 1 0 0 1-1 1A11 11 0 0 1 2 3a1 1 0 0 1 1-1z" />
                    </svg>
                  </span>
                  <strong>Arama gecmisi bos</strong>
                  <span>Yaptigin, gelen ve cevapsiz aramalar burada gorunur.</span>
                </div>
              ) : null}
              <div className="companion-call-history" role="list">
                {callHistory.map((call) => {
                  const peer = callPeer(call, currentUserId);
                  const knownPeer = peer ? peopleByUserId.get(peer.userId) : undefined;
                  const displayName = knownPeer?.displayName ?? peer?.displayName ?? "Picom kullanicisi";
                  const isVideo = call.callType === "video";
                  const outgoing = call.createdBy === currentUserId;
                  const outcome = companionCallOutcome(call, currentUserId);
                  const isLive = call.status === "active" || call.status === "ringing";
                  return (
                    <article
                      key={call.id}
                      role="listitem"
                      className={`companion-call-row${outcome.failed ? " is-missed" : ""}${outcome.answered ? " is-answered" : ""}${isLive ? " is-live" : ""}`}
                    >
                      <div className="companion-call-row__avatar">
                        <UserAvatar
                          userId={peer?.userId ?? "unknown"}
                          displayName={displayName}
                          fallbackUrl={knownPeer?.avatarUrl ?? peer?.avatarUrl}
                          size={40}
                        />
                        <span
                          className={`companion-call-row__badge companion-call-row__badge--${isVideo ? "video" : "voice"}${outcome.failed ? " is-missed" : ""}`}
                          aria-hidden="true"
                        >
                          <AppIcon name={isVideo ? "camera" : "phone"} size={10} />
                        </span>
                      </div>
                      <div className="companion-call-row__main">
                        <div className="companion-call-row__line">
                          <strong className={outcome.failed ? "is-missed" : undefined}>{displayName}</strong>
                          <time dateTime={call.updatedAt}>{dateLabel(call.updatedAt)}</time>
                        </div>
                        <small className="companion-call-row__meta">
                          <span
                            className={`companion-call-row__dir${outgoing ? " is-out" : " is-in"}${outcome.failed ? " is-missed" : ""}${outcome.answered ? " is-ok" : ""}`}
                            aria-hidden="true"
                          >
                            {outgoing ? (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 9L9 3M4.5 3H9v4.5" /></svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M9 3L3 9M7.5 9H3V4.5" /></svg>
                            )}
                          </span>
                          <span>{isVideo ? "Görüntülü" : "Sesli"}</span>
                          <span className="companion-call-row__sep" aria-hidden="true">·</span>
                          <span className={`companion-call-row__outcome${outcome.failed ? " is-missed" : ""}${outcome.answered ? " is-ok" : ""}`}>
                            {outcome.label}
                          </span>
                          {outcome.detail ? (
                            <>
                              <span className="companion-call-row__sep" aria-hidden="true">·</span>
                              <span>{outcome.detail}</span>
                            </>
                          ) : null}
                        </small>
                      </div>
                      <div className="companion-call-row__actions">
                        {knownPeer?.conversationId ? (
                          <button
                            type="button"
                            className="companion-call-row__action companion-call-row__action--primary"
                            aria-label={`${displayName} ile yeniden ara`}
                            onClick={() => void beginCall(knownPeer, call.callType)}
                          >
                            <AppIcon name={isVideo ? "camera" : "phone"} size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="companion-call-row__action"
                          aria-label={`${displayName} sohbetini ac`}
                          onClick={() => openWindow("chat", { conversationId: call.conversationId })}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M13 3H3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 3 12h2v2.5L8.5 12H13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 13 3z" />
                          </svg>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="companion-home-scroll companion-communities-surface">
              <header className="companion-communities-header">
                <div className="companion-communities-header__copy">
                  <strong>Topluluklar</strong>
                  <span>
                    {snapshot?.communities.length
                      ? `${snapshot.communities.length} topluluk`
                      : "Katildigin topluluklari ac"}
                  </span>
                </div>
              </header>
              {snapshot?.communities.length ? (
                <div className="companion-communities-list" role="list">
                  {snapshot.communities.map((community) => {
                    const activeVoice = snapshot.voiceRooms.filter((room) => room.communityId === community.id);
                    const liveParticipants = activeVoice.reduce((sum, room) => sum + room.participantCount, 0);
                    const meta = community.description?.trim()
                      || (activeVoice.length
                        ? `${activeVoice.length} ses odasi${liveParticipants ? ` · ${liveParticipants} aktif` : ""}`
                        : "Topluluk alanini ac");
                    return (
                      <button
                        key={community.id}
                        type="button"
                        role="listitem"
                        className={`companion-community-row${liveParticipants > 0 ? " is-live" : ""}`}
                        onClick={() => openWindow("community", { communityId: community.id })}
                      >
                        <span className={`companion-community-avatar${community.iconUrl ? " has-image" : ""}`} aria-hidden="true">
                          {community.iconUrl ? <img src={community.iconUrl} alt="" /> : community.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="companion-community-row__copy">
                          <strong>{community.name}</strong>
                          <small>{meta}</small>
                        </span>
                        <span className="companion-community-row__trail">
                          {liveParticipants > 0 ? (
                            <span className="companion-community-row__live" aria-label="Aktif ses">
                              <span className="companion-community-row__live-dot" aria-hidden="true" />
                              Canli
                            </span>
                          ) : null}
                          <span className="companion-community-row__chevron" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                              <path d="M6 3.5 10.5 8 6 12.5" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="companion-empty companion-empty--communities">
                  <span className="companion-empty--communities__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="7" cy="7" r="3" />
                      <circle cx="14" cy="8" r="2.4" />
                      <path d="M2 17a5 5 0 0 1 10 0M11.5 16.5a4 4 0 0 1 6.5-2.5" />
                    </svg>
                  </span>
                  <strong>Henuz katildigin topluluk yok</strong>
                  <span>Topluluklara ana Picom penceresinden katilabilirsin.</span>
                </div>
              )}
            </div>
          )}
          <footer className="companion-home-footer companion-home-footer--v4">
            <nav className="companion-home-nav" aria-label="Companion gezinme">
              <button type="button" className={surface === "chats" ? "is-active" : ""} aria-current={surface === "chats" ? "page" : undefined} onClick={() => setSurface("chats")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M13 3H3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 3 12h2v2.5L8.5 12H13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 13 3z" /></svg>
                <span>Sohbet</span>
              </button>
              <button type="button" className={surface === "calls" ? "is-active" : ""} aria-current={surface === "calls" ? "page" : undefined} onClick={openCalls}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 2h3l1.5 3.5L6 7a9 9 0 0 0 3 3l1.5-1.5L14 10v3a1 1 0 0 1-1 1A11 11 0 0 1 2 3a1 1 0 0 1 1-1z" /></svg>
                <span>Aramalar</span>
              </button>
              <button type="button" className={surface === "communities" ? "is-active" : ""} aria-current={surface === "communities" ? "page" : undefined} onClick={openCommunities}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="8" r="2.4" /><path d="M2 17a5 5 0 0 1 10 0M11.5 16.5a4 4 0 0 1 6.5-2.5" /></svg>
                <span>Topluluklar</span>
              </button>
              <button type="button" onClick={() => openWindow("settings")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" /></svg>
                <span>Ayarlar</span>
              </button>
            </nav>
            <button type="button" className="companion-new-chat" onClick={() => setIsNewChatOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
              Yeni Sohbet
            </button>
          </footer>
          {isNewChatOpen ? (
            <div className="companion-home-dialog-backdrop" role="presentation" onMouseDown={() => setIsNewChatOpen(false)}>
              <section className="companion-new-chat-dialog" role="dialog" aria-modal="true" aria-label="Yeni sohbet" onMouseDown={(event) => event.stopPropagation()}>
                <div className="companion-new-chat-dialog__header">
                  <div><strong>Yeni sohbet</strong><span>Arkadaslarindan birini sec</span></div>
                  <button type="button" className="companion-icon-button" aria-label="Yeni sohbet penceresini kapat" onClick={() => setIsNewChatOpen(false)}><AppIcon name="close" size={15} /></button>
                </div>
                <label className="companion-search companion-new-chat-dialog__search"><AppIcon name="search" size={13} /><input autoFocus value={newChatQuery} onChange={(event) => setNewChatQuery(event.target.value)} placeholder="Arkadas ara" aria-label="Arkadas ara" /></label>
                <div className="companion-new-chat-dialog__list">
                  {newChatCandidates.map((person) => (
                    <button key={person.userId} type="button" disabled={openingConversationUserId === person.userId} onClick={() => void openConversation(person)}>
                      <UserAvatar userId={person.userId} displayName={person.displayName} fallbackUrl={person.avatarUrl} size={38} />
                      <span><strong>{person.displayName}</strong><small>{companionStatusLabel(person.status)}</small></span>
                      <span aria-hidden="true">&gt;</span>
                    </button>
                  ))}
                  {!newChatCandidates.length ? <div className="companion-new-chat-dialog__empty">Eslesen arkadas bulunamadi.</div> : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </CompanionFrame>
  );
}
function peerFromConversation(conversation: DirectConversation | undefined): UnknownRecord {
  const source = record(conversation);
  if (typeof source.participantUserId === "string") {
    return {
      id: source.participantUserId,
      userId: source.participantUserId,
      displayName: source.participantName,
      username: source.participantUsername,
      avatarUrl: source.participantAvatarUrl,
      status: source.participantStatus,
    };
  }
  return record(source.otherParticipant ?? source.recipient ?? source.peer ?? source.participant);
}

function CompanionChat({ route }: { route: CompanionRoute }) {
  const conversationId = route.conversationId ?? "";
  const [conversation, setConversation] = useState<DirectConversation>();
  const [messages, setMessages] = useState<readonly DirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<readonly DirectMessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Picom user");
  const [error, setError] = useState("");
  const [pinned, setPinned] = useState(false);
  const [smartCollapse, setSmartCollapse] = useState(false);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editBody, setEditBody] = useState("");
  const [reactionTargetId, setReactionTargetId] = useState("");
  const [menuMessageId, setMenuMessageId] = useState("");
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [peerRead, setPeerRead] = useState<Readonly<{ lastReadAt?: string; lastReadMessageId?: string }>>({});
  const listEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const sync = useCompanionSync(() => void companionDataService.getMessages(conversationId).then(setMessages));
  useSmartCollapse(smartCollapse, conversationId);
  const typing = useDirectTypingBroadcast({
    enabled: Boolean(conversationId && currentUserId),
    conversationId,
    currentUserId,
    displayName: currentUserName,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    void companionDataService.subscribeMessages(conversationId, (nextMessages) => {
      if (active) setMessages(nextMessages);
    }).then((nextCleanup) => {
      if (!active) {
        nextCleanup();
        return;
      }
      cleanup = nextCleanup;
    }).catch(() => undefined);
    void companionDataService.getCurrentUserIdentity().then((currentUser) => {
      if (!active) return;
      const userId = currentUser?.userId ?? "";
      setCurrentUserId(userId);
      setCurrentUserName(currentUser?.displayName ?? currentUser?.username ?? "Picom user");
      setHiddenIds(loadHiddenMessageIds(conversationId, userId));
    }).catch(() => undefined);
    void Promise.all([companionDataService.getConversations(), window.picomDesktop?.companion?.getContext(), getCompanionPreferences()]).then(([conversations, , prefs]) => {
      if (!active) return;
      setConversation(conversations.find((item) => text(record(item).id) === conversationId));
      setPinned(Boolean(prefs?.alwaysOnTop));
      setSmartCollapse(Boolean(prefs?.smartCollapse));
      const savedDraft = companionDataService.getDraft(conversationId);
      setBody(typeof savedDraft === "string" ? savedDraft : text(record(savedDraft).text));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Sohbet yüklenemedi."));
    const removeSync = window.picomDesktop?.companion?.onSync((event) => {
      if (event.topic !== "preferences") return;
      void getCompanionPreferences().then((prefs) => {
        setPinned(Boolean(prefs.alwaysOnTop));
        setSmartCollapse(Boolean(prefs.smartCollapse));
      });
    });
    return () => {
      active = false;
      cleanup?.();
      removeSync?.();
    };
  }, [conversationId]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, replyTo, editingId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
    }
    recordingStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editingId) {
        setEditingId("");
        setEditBody("");
        return;
      }
      if (replyTo) {
        setReplyTo(null);
        return;
      }
      if (reactionTargetId || menuMessageId) {
        setReactionTargetId("");
        setMenuMessageId("");
        return;
      }
      openWindow("bubble");
      void window.picomDesktop?.companion?.closeCurrent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, menuMessageId, reactionTargetId, replyTo]);

  const peer = peerFromConversation(conversation);
  const peerId = text(peer.id ?? peer.userId ?? peer.user_id);
  const peerName = text(peer.displayName ?? peer.display_name ?? peer.username, "Direkt mesaj");
  const peerStatusRaw = text(peer.status ?? peer.presence);
  const peerStatus = peerStatusRaw === "online" || peerStatusRaw === "idle" || peerStatusRaw === "busy" || peerStatusRaw === "offline"
    ? peerStatusRaw
    : peerStatusRaw === "dnd"
      ? "busy"
      : "offline";

  useEffect(() => {
    if (!conversationId || !peerId) {
      setPeerRead({});
      return;
    }
    let active = true;
    const refreshPeerRead = () => {
      void companionDataService.getPeerReadState(conversationId, peerId).then((next) => {
        if (active) setPeerRead(next);
      }).catch(() => {
        if (active) setPeerRead({});
      });
    };
    refreshPeerRead();
    return () => {
      active = false;
    };
  }, [conversationId, peerId, messages]);

  const uploadFiles = async (files: readonly File[]) => {
    const availableSlots = Math.max(0, 4 - pendingAttachments.length);
    if (!availableSlots || !files.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files.slice(0, availableSlots)) {
        const previewUrl = URL.createObjectURL(file);
        try {
          const result = await directAttachmentUploadService.upload({ conversationId, file, previewUrl });
          if (!result.ok) throw new Error(result.error.message);
          setPendingAttachments((current) => [...current, result.data]);
        } finally {
          URL.revokeObjectURL(previewUrl);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Attachment could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    void uploadFiles(files);
  };

  const removePendingAttachment = async (attachment: DirectMessageAttachment) => {
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
    await directAttachmentUploadService.removePending(attachment);
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Voice recording is not available on this device.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferredType });
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
        void uploadFiles([file]);
      };
      recorder.start();
      setRecording(true);
    } catch (reason) {
      setRecording(false);
      setError(reason instanceof Error ? reason.message : "Voice recording could not start.");
    }
  };

  const toggleReaction = async (targetMessageId: string, emoji: string, reacted: boolean) => {
    try {
      if (reacted) await companionDataService.removeReaction(targetMessageId, emoji);
      else await companionDataService.addReaction(targetMessageId, emoji);
      setMessages(await companionDataService.getMessages(conversationId));
      setReactionTargetId("");
      setMenuMessageId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reaction could not be updated.");
    }
  };

  const beginReply = (message: DirectMessage) => {
    if (messageIsDeleted(message)) return;
    setReplyTo(message);
    setEditingId("");
    setEditBody("");
    setMenuMessageId("");
    setReactionTargetId("");
    window.requestAnimationFrame(() => composerInput.current?.focus());
  };

  const beginEdit = (message: DirectMessage) => {
    if (!canEditCompanionMessage(message, currentUserId, nowTick)) {
      setError("Mesaj yalnızca gönderildikten sonraki 5 dakika içinde düzenlenebilir.");
      return;
    }
    setEditingId(messageId(message));
    setEditBody(messageBody(message));
    setReplyTo(null);
    setMenuMessageId("");
    setReactionTargetId("");
  };

  const saveEdit = async () => {
    const trimmed = editBody.trim();
    if (!editingId || !trimmed) return;
    try {
      await companionDataService.editMessage(editingId, trimmed);
      setEditingId("");
      setEditBody("");
      setMessages(await companionDataService.getMessages(conversationId));
      sync("direct-messages");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mesaj düzenlenemedi.");
    }
  };

  const deleteForEveryone = async (targetMessageId: string) => {
    try {
      await companionDataService.deleteMessage(targetMessageId);
      setMenuMessageId("");
      setMessages(await companionDataService.getMessages(conversationId));
      sync("direct-messages");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mesaj silinemedi.");
    }
  };

  const deleteForMe = (targetMessageId: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.add(targetMessageId);
      persistHiddenMessageIds(conversationId, currentUserId, next);
      return next;
    });
    setMenuMessageId("");
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    const queuedAttachments = pendingAttachments;
    const replyId = replyTo ? messageId(replyTo) : undefined;
    if ((!trimmed && !queuedAttachments.length) || uploading || recording) return;
    try {
      setBody("");
      setPendingAttachments([]);
      setReplyTo(null);
      typing.sendTypingStop();
      companionDataService.clearDraft(conversationId);
      await companionDataService.sendMessage(conversationId, trimmed, queuedAttachments, replyId || undefined);
      setMessages(await companionDataService.getMessages(conversationId));
      sync("direct-messages");
    } catch (reason) {
      setBody(trimmed);
      setPendingAttachments(queuedAttachments);
      if (replyId) {
        const still = messages.find((item) => messageId(item) === replyId);
        if (still) setReplyTo(still);
      }
      companionDataService.saveDraft(conversationId, trimmed);
      setError(reason instanceof Error ? reason.message : "Mesaj gönderilemedi.");
    }
  };

  const call = async (type: DmCallType) => {
    if (!peerId) return;
    const person: CompanionPerson = {
      userId: peerId,
      displayName: peerName,
      username: text(peer.username, `@${peerId.slice(0, 8)}`),
      avatarUrl: text(peer.avatarUrl ?? peer.avatar_url) || undefined,
      status: peerStatus === "online" || peerStatus === "idle" || peerStatus === "busy" ? peerStatus : "offline",
      favorite: false,
      conversationId,
    };
    try {
      const next = await companionDataService.startDirectCall(conversationId, person, type);
      openWindow(type, { conversationId, callId: next.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Arama başlatılamadı.");
    }
  };

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    await window.picomDesktop?.companion?.setAlwaysOnTop(next);
  };

  const collapseToBubble = () => {
    openWindow("bubble");
    void window.picomDesktop?.companion?.closeCurrent();
  };

  const peerStatusLabel = companionStatusLabel(peerStatus);
  const peerAvatar = text(peer.avatarUrl ?? peer.avatar_url) || undefined;

  return (
    <main className="companion-shell companion-shell--chat">
      <header className="companion-chat-header">
        <span className="companion-avatar-wrap companion-chat-header__avatar">
          <UserAvatar userId={peerId || "peer"} displayName={peerName} fallbackUrl={peerAvatar} size={33} />
          <span className={`companion-presence companion-presence--${peerStatus}`} aria-hidden="true" />
        </span>
        <div className="companion-chat-header__copy">
          <strong>{peerName}</strong>
          <span className={`companion-status-text companion-status-text--${peerStatus}`}>{peerStatusLabel}</span>
        </div>
        <div className="companion-chat-header__actions">
          <button type="button" className="companion-icon-button" aria-label={`${peerName} sesli arama`} onClick={() => void call("voice")}><AppIcon name="phone" size={14} /></button>
          <button type="button" className="companion-icon-button" aria-label={`${peerName} görüntülü arama`} onClick={() => void call("video")}><AppIcon name="camera" size={14} /></button>
          <button type="button" className={`companion-icon-button${pinned ? " is-active" : ""}`} aria-label="Üstte tut" aria-pressed={pinned} onClick={() => void togglePin()}><AppIcon name="pin" size={13} /></button>
          <button type="button" className="companion-icon-button" aria-label="Baloncuğa daralt" title="Baloncuğa daralt" onClick={collapseToBubble}>—</button>
        </div>
      </header>
      {error ? (
        <div className="companion-inline-error" role="alert">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Hatayı kapat"><AppIcon name="close" size={13} /></button>
        </div>
      ) : null}
      <section className="companion-chat-list" aria-live="polite">
        {messages.map((message) => {
          const id = messageId(message);
          if (!id || hiddenIds.has(id)) return null;
          const deleted = messageIsDeleted(message);
          const content = messageBody(message);
          const source = record(message);
          const attachments = Array.isArray(source.attachments) ? source.attachments : [];
          const reactions = Array.isArray(source.reactions) ? source.reactions : (message.reactions ?? []);
          const replyPreview = source.replyPreview && typeof source.replyPreview === "object"
            ? record(source.replyPreview)
            : message.replyPreview
              ? record(message.replyPreview)
              : null;
          if (!content && !attachments.length && !deleted) return null;
          const own = messageAuthorId(message) === currentUserId;
          const editable = canEditCompanionMessage(message, currentUserId, nowTick);
          const isEditing = editingId === id;
          const menuOpen = menuMessageId === id;
          const reactionOpen = reactionTargetId === id;
          const edited = Boolean(source.editedAt || source.edited_at || message.editedAt);
          return (
            <article
              className={`companion-message${own ? " is-own" : ""}${deleted ? " is-deleted" : ""}${menuOpen || reactionOpen ? " is-actions-open" : ""}`}
              key={id}
            >
              {!own ? <UserAvatar userId={peerId || messageAuthorId(message)} displayName={peerName} fallbackUrl={peerAvatar} size={28} /> : null}
              <div className="companion-message__stack">
                <div className="companion-message__bubble">
                  {replyPreview ? (
                    <div className="companion-message__quote">
                      <strong>{text(replyPreview.authorName ?? replyPreview.author_name, "Mesaj")}</strong>
                      <span>{text(replyPreview.body, "Alıntılanan mesaj")}</span>
                    </div>
                  ) : null}
                  {isEditing ? (
                    <div className="companion-message__edit">
                      <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        rows={2}
                        aria-label="Mesajı düzenle"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void saveEdit();
                          }
                        }}
                      />
                      <div className="companion-message__edit-actions">
                        <button type="button" onClick={() => { setEditingId(""); setEditBody(""); }}>Vazgeç</button>
                        <button type="button" className="is-primary" disabled={!editBody.trim()} onClick={() => void saveEdit()}>Kaydet</button>
                      </div>
                    </div>
                  ) : deleted ? (
                    <p className="companion-message__deleted">Bu mesaj silindi</p>
                  ) : (
                    <>
                      {content ? <p>{content}</p> : null}
                      {attachments.length ? (
                        <div className="companion-message-attachments">
                          {attachments.map((attachment) => {
                            const file = record(attachment);
                            const url = text(file.url);
                            const name = text(file.name, "ek");
                            const kind = text(file.type, "file");
                            const mimeType = text(file.mimeType ?? file.mime_type);
                            return kind === "image" && url ? (
                              <a key={text(file.id, url)} href={url} target="_blank" rel="noreferrer" className="companion-message-image">
                                <img src={url} alt={name} />
                                <span>{name}</span>
                              </a>
                            ) : (kind === "video" || mimeType.startsWith("video/")) && url ? (
                              <video key={text(file.id, url)} src={url} controls preload="metadata" className="companion-message-media" />
                            ) : mimeType.startsWith("audio/") && url ? (
                              <div key={text(file.id, url)} className="companion-message-voice">
                                <span className="companion-message-voice__play" aria-hidden="true">▶</span>
                                <audio src={url} controls preload="metadata" />
                              </div>
                            ) : (
                              <a key={text(file.id, name)} href={url || undefined} className="companion-message-file" target="_blank" rel="noreferrer">
                                <AppIcon name="paperclip" size={13} />{name}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  )}
                  {!deleted ? (
                    <div className="companion-message__actions">
                      <button type="button" aria-label="Yanıtla" onClick={() => beginReply(message)}><AppIcon name="reply" size={14} /></button>
                      <button type="button" aria-label="Beğen / tepki" aria-expanded={reactionOpen} onClick={() => { setReactionTargetId(reactionOpen ? "" : id); setMenuMessageId(""); }}>
                        <AppIcon name="smile" size={14} />
                      </button>
                      {own && editable ? (
                        <button type="button" aria-label="Düzenle" onClick={() => beginEdit(message)}><AppIcon name="edit" size={14} /></button>
                      ) : null}
                      <button
                        type="button"
                        className={`companion-message__action-more${menuOpen ? " is-open" : ""}`}
                        aria-label="Diğer"
                        aria-expanded={menuOpen}
                        onClick={() => { setMenuMessageId(menuOpen ? "" : id); setReactionTargetId(""); }}
                      >
                        <AppIcon name="more" size={16} />
                      </button>
                    </div>
                  ) : null}
                  {reactionOpen ? (
                    <EmojiPicker
                      className="companion-message__react-picker"
                      label="Tepki seç"
                      mode="reaction"
                      onClose={() => setReactionTargetId("")}
                      onSelect={(emoji) => {
                        const existing = reactions.find((reaction) => text(record(reaction).emoji) === emoji);
                        const reacted = Boolean(existing && (record(existing).reactedByCurrentUser ?? record(existing).reacted_by_current_user));
                        void toggleReaction(id, emoji, reacted);
                      }}
                    />
                  ) : null}
                  {menuOpen ? (
                    <div className="companion-message__menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => beginReply(message)}>Alıntıla / yanıtla</button>
                      {own && editable ? <button type="button" role="menuitem" onClick={() => beginEdit(message)}>Düzenle (5 dk)</button> : null}
                      <button type="button" role="menuitem" onClick={() => deleteForMe(id)}>Benden sil</button>
                      {own && !deleted ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            if (window.confirm("Bu mesaj herkesten silinsin mi?")) void deleteForEveryone(id);
                            else setMenuMessageId("");
                          }}
                        >
                          Herkesten sil
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {!deleted && reactions.length ? (
                  <div className="companion-message-reactions">
                    {reactions.map((reaction) => {
                      const item = record(reaction);
                      const emoji = text(item.emoji);
                      const reacted = Boolean(item.reactedByCurrentUser ?? item.reacted_by_current_user ?? item.currentUserReacted);
                      return (
                        <button
                          type="button"
                          className={reacted ? "is-active" : ""}
                          key={`${emoji}-${text(item.count)}`}
                          aria-pressed={reacted}
                          aria-label={`${emoji} tepkisi`}
                          onClick={() => void toggleReaction(id, emoji, reacted)}
                        >
                          {emoji} {text(item.count, "1")}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <time>
                  {dateLabel(source.createdAt ?? source.created_at)}
                  {edited ? " · Düzenlendi" : ""}
                  {own && !deleted ? ` · ${ownMessageReceiptLabel(message, peerRead)}` : ""}
                </time>
              </div>
            </article>
          );
        })}
        {!messages.some((message) => {
          const id = messageId(message);
          if (!id || hiddenIds.has(id)) return false;
          if (messageIsDeleted(message)) return true;
          const attachments = record(message).attachments;
          return Boolean(messageBody(message) || (Array.isArray(attachments) && attachments.length));
        }) ? (
          <div className="companion-empty">
            <AppIcon name="inbox" size={22} />
            <strong>Henüz mesaj yok</strong>
            <span>Bu özel sohbeti başlat.</span>
          </div>
        ) : null}
        {typing.typingNames.length ? (
          <div className="companion-message companion-message--typing" role="status">
            <UserAvatar userId={peerId || "peer"} displayName={peerName} fallbackUrl={peerAvatar} size={28} />
            <div className="companion-typing-bubble" aria-label="yazıyor">
              <span className="companion-typing" aria-hidden="true"><i /><i /><i /></span>
            </div>
          </div>
        ) : null}
        <div ref={listEnd} />
      </section>
      {pendingAttachments.length || recording || uploading ? (
        <div className="companion-pending-attachments" aria-live="polite">
          {pendingAttachments.map((attachment) => (
            <span key={attachment.id}>
              <AppIcon name={attachment.mimeType?.startsWith("audio/") ? "microphone" : "paperclip"} size={12} />
              {attachment.name}
              <button type="button" aria-label={`${attachment.name} kaldır`} onClick={() => void removePendingAttachment(attachment)}><AppIcon name="close" size={11} /></button>
            </span>
          ))}
          {uploading ? <em>Yükleniyor…</em> : null}
          {recording ? <em className="is-recording">Kaydediliyor…</em> : null}
        </div>
      ) : null}
      {replyTo ? (
        <div className="companion-reply-bar">
          <div>
            <strong>Yanıtlanıyor</strong>
            <span>{messageBody(replyTo) || "Medya mesajı"}</span>
          </div>
          <button type="button" aria-label="Yanıtı iptal et" onClick={() => setReplyTo(null)}><AppIcon name="close" size={13} /></button>
        </div>
      ) : null}
      <form className="companion-composer companion-composer--chat" onSubmit={send}>
        <input ref={fileInput} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/webm,audio/ogg,audio/mpeg,audio/mp4" onChange={selectFiles} />
        <div className="companion-composer__pill">
          <button
            type="button"
            className="companion-composer__emoji"
            aria-label="Emoji ekle"
            aria-expanded={emojiPickerOpen}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setEmojiPickerOpen((current) => !current)}
          >
            🙂
          </button>
          <button type="button" className="companion-composer__tool" aria-label="Dosya ekle" disabled={uploading || pendingAttachments.length >= 4} onClick={() => fileInput.current?.click()}><AppIcon name="paperclip" size={13} /></button>
          <textarea
            ref={composerInput}
            value={body}
            onChange={(event) => {
              const value = event.target.value;
              setBody(value);
              companionDataService.saveDraft(conversationId, value);
              if (value.trim()) typing.sendTypingStart();
              else typing.sendTypingStop();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={replyTo ? "Yanıtını yaz…" : "Mesaj yaz…"}
            aria-label={`${peerName} kişisine mesaj`}
            rows={1}
          />
          <button type="button" className={`companion-composer__tool${recording ? " is-active" : ""}`} aria-label={recording ? "Kaydı bitir" : "Sesli mesaj kaydet"} aria-pressed={recording} disabled={uploading} onClick={() => void toggleRecording()}><AppIcon name="microphone" size={13} /></button>
        </div>
        <button type="submit" className="companion-composer__send" disabled={uploading || recording || (!body.trim() && !pendingAttachments.length)} aria-label="Mesaj gönder"><AppIcon name="send" size={15} /></button>
        {emojiPickerOpen ? (
          <EmojiPicker
            className="companion-composer-emoji-picker"
            label="Mesaja emoji ekle"
            mode="composer"
            onClose={() => setEmojiPickerOpen(false)}
            onSelect={(emoji) => {
              const nextBody = `${body}${emoji}`;
              setBody(nextBody);
              companionDataService.saveDraft(conversationId, nextBody);
              typing.sendTypingStart();
              setEmojiPickerOpen(false);
              window.requestAnimationFrame(() => composerInput.current?.focus());
            }}
          />
        ) : null}
      </form>
    </main>
  );
}

function CompanionCommunity({ route }: { route: CompanionRoute }) {
  const communityId = route.communityId ?? "";
  const [name, setName] = useState("Topluluk");
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [channelId, setChannelId] = useState(route.channelId ?? "");
  const [messages, setMessages] = useState<readonly CommunityMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceServiceSnapshot | null>(null);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [participantName, setParticipantName] = useState("Picom");
  const sync = useCompanionSync(() => channelId && void companionDataService.getCommunityMessages(communityId, channelId).then(setMessages));

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === channelId) ?? null,
    [channelId, channels],
  );
  const isVoiceChannel = selectedChannel?.type === "voice";

  useEffect(() => {
    void companionDataService.getCommunity(communityId).then((snapshot) => {
      setName(text(record(snapshot.community).name, "Topluluk"));
      setChannels(snapshot.channels);
      const selected = route.channelId
        ? snapshot.channels.find((channel) => channel.id === route.channelId)
        : snapshot.activeChannel;
      setChannelId(selected?.id ?? "");
      setMessages(selected?.id === snapshot.activeChannel?.id ? snapshot.messages : []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Topluluk içeriği yüklenemedi."));
    void companionDataService.loadHome().then((home) => {
      setParticipantName(home.currentUser?.displayName ?? home.currentUser?.username ?? "Picom");
    }).catch(() => undefined);
  }, [communityId, route.channelId]);

  useEffect(() => companionDataService.subscribeVoice(setVoiceSnapshot), []);

  useEffect(() => {
    if (!isVoiceChannel || !selectedChannel) return;
    const alreadyConnected = (voiceSnapshot?.status === "connected" || voiceSnapshot?.status === "reconnecting")
      && voiceSnapshot.roomContext?.communityId === communityId
      && voiceSnapshot.roomContext?.channelId === selectedChannel.id;
    if (alreadyConnected) {
      setVoiceConnecting(false);
      return;
    }

    let cancelled = false;
    setVoiceConnecting(true);
    void companionDataService.joinCommunityVoiceRoom({
      communityId,
      communityName: name,
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      participantName,
    }).then((snapshot) => {
      if (!cancelled) setVoiceSnapshot(snapshot);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Sesli odaya bağlanılamadı.");
    }).finally(() => {
      if (!cancelled) setVoiceConnecting(false);
    });

    return () => {
      cancelled = true;
    };
  // Join once per community/channel pair; snapshot updates come from subscribeVoice.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable join trigger
  }, [communityId, isVoiceChannel, name, selectedChannel?.id, selectedChannel?.name]);


  const selectChannel = async (nextId: string) => {
    setChannelId(nextId);
    const next = channels.find((channel) => channel.id === nextId);
    if (next?.type === "voice") {
      setMessages([]);
      return;
    }
    setMessages(await companionDataService.getCommunityMessages(communityId, nextId));
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !channelId || isVoiceChannel) return;
    try {
      setBody("");
      await companionDataService.sendCommunityMessage(communityId, channelId, trimmed);
      setMessages(await companionDataService.getCommunityMessages(communityId, channelId));
      sync("communities");
    } catch (reason) {
      setBody(trimmed);
      setError(reason instanceof Error ? reason.message : "Mesaj gönderilemedi.");
    }
  };

  const leaveVoice = async () => {
    await companionDataService.leaveVoiceRoom();
    void window.picomDesktop?.companion?.closeCurrent();
  };

  const voiceConnected = voiceSnapshot?.status === "connected"
    && voiceSnapshot.roomContext?.communityId === communityId
    && voiceSnapshot.roomContext?.channelId === channelId;
  const voiceParticipants = voiceSnapshot?.participants ?? [];
  const voiceStatus = voiceConnecting ? "connecting" : voiceConnected ? "connected" : "waiting";
  const voiceStatusLabel = voiceConnecting
    ? "Bağlanılıyor"
    : voiceConnected
      ? `${Math.max(1, voiceParticipants.length)} bağlı`
      : "Bağlı değil";

  return (
    <CompanionFrame title={name} subtitle={isVoiceChannel ? (voiceConnected ? "Sesli oda bağlı" : voiceConnecting ? "Sesli odaya bağlanılıyor" : "Sesli oda") : "Kompakt topluluk alanı"}>
      {error ? <ErrorState message={error} retry={() => window.location.reload()} /> : (
        <div className="companion-community-layout">
          <nav className="companion-channel-list" aria-label="Topluluk kanalları">
            {channels.map((channel) => (
              <button type="button" className={channel.id === channelId ? "is-active" : ""} key={channel.id} onClick={() => void selectChannel(channel.id)}>
                <AppIcon name={channel.type === "voice" ? "microphone" : "hash"} size={14} />{channel.name}
              </button>
            ))}
          </nav>
          {isVoiceChannel ? (
            <section className="companion-community-chat companion-community-voice">
              <CompanionVoiceStage
                title={selectedChannel?.name || "Sesli oda"}
                eyebrow="Sesli kanal"
                status={voiceStatus}
                statusLabel={voiceStatusLabel}
                participants={voiceParticipants}
                waveActive={voiceConnected || voiceConnecting}
                waveIntense={voiceConnected && voiceParticipants.some((participant) => participant.isSpeaking) && !(voiceSnapshot?.muted ?? false)}
              />
              <CompanionCallControls
                muted={Boolean(voiceSnapshot?.muted)}
                deafened={Boolean(voiceSnapshot?.deafened)}
                connected={voiceConnected}
                busy={voiceConnecting}
                onLeave={() => void leaveVoice()}
                onError={setError}
              />
            </section>
          ) : (
            <section className="companion-community-chat">
              <div className="companion-chat-list">
                {messages.map((message) => {
                  const source = record(message);
                  const content = messageBody(message);
                  return content ? (
                    <article className="companion-community-message" key={messageId(message)}>
                      <UserAvatar userId={messageAuthorId(message)} displayName={text(record(source.author).displayName ?? record(source.author).username, "Üye")} fallbackUrl={text(record(source.author).avatarUrl ?? record(source.author).avatar_url) || undefined} size={24} />
                      <div>
                        <strong>{text(record(source.author).displayName ?? record(source.author).username, "Üye")}</strong>
                        <p>{content}</p>
                      </div>
                    </article>
                  ) : null;
                })}
              </div>
              <form className="companion-composer" onSubmit={send}>
                <button type="button" className="companion-composer__tool" tabIndex={-1} aria-hidden="true"><AppIcon name="paperclip" size={14} /></button>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Kanala mesaj yaz" aria-label="Kanala mesaj" rows={1} />
                <button type="button" className="companion-composer__tool" tabIndex={-1} aria-hidden="true"><AppIcon name="microphone" size={14} /></button>
                <button type="submit" className="companion-composer__send" disabled={!body.trim() || !channelId}><AppIcon name="send" size={15} /></button>
              </form>
            </section>
          )}
        </div>
      )}
    </CompanionFrame>
  );
}

function CompanionCall({ route }: { route: CompanionRoute }) {
  const [snapshot, setSnapshot] = useState<VoiceServiceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [screenPickerOpen, setScreenPickerOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [peer, setPeer] = useState<CompanionPerson | null>(null);
  const idleTimer = useRef<number | null>(null);
  const callType: DmCallType = route.type === "video" ? "video" : "voice";
  const conversationId = route.conversationId ?? "";

  useEffect(() => {
    const cleanup = companionDataService.subscribeVoice(setSnapshot);
    void companionDataService.connectDirectCall(conversationId, route.callId ?? "", callType)
      .then(setSnapshot)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Arama bağlanamadı."))
      .finally(() => setConnecting(false));
    return cleanup;
  }, [callType, route.callId, conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setPeer(null);
      return;
    }
    let cancelled = false;
    void companionDataService.getConversations().then((conversations) => {
      if (cancelled) return;
      const conversation = conversations.find((item) => text(record(item).id) === conversationId);
      const source = peerFromConversation(conversation);
      const userId = text(source.userId ?? source.id);
      if (!userId) {
        setPeer(null);
        return;
      }
      setPeer({
        userId,
        displayName: text(source.displayName ?? source.username, "Kullanıcı"),
        username: text(source.username, `@${userId.slice(0, 8)}`),
        status: "offline",
        favorite: false,
        avatarUrl: text(source.avatarUrl ?? source.avatar_url) || undefined,
        conversationId,
      });
    }).catch(() => {
      if (!cancelled) setPeer(null);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const remove = window.picomDesktop?.companion?.onSync((event) => {
      if (event.topic !== "mute-toggle") return;
      void companionDataService.setMuted(!(snapshot?.muted ?? false));
    });
    return () => remove?.();
  }, [snapshot?.muted]);

  useEffect(() => {
    if (callType !== "video") return;
    const arm = () => {
      setControlsVisible(true);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setControlsVisible(false), 2000);
    };
    arm();
    window.addEventListener("pointermove", arm);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", arm);
    };
  }, [callType]);

  const leave = async () => {
    if (route.callId) await companionDataService.leaveCall(route.callId);
    void window.picomDesktop?.companion?.broadcast({ topic: "calls" });
    void window.picomDesktop?.companion?.closeCurrent();
  };

  const enterPip = () => {
    void window.picomDesktop?.companion?.setWindowBounds?.({ width: 220, height: 160, alwaysOnTop: true });
  };

  const connected = snapshot?.status === "connected";
  const participants = snapshot?.participants ?? [];
  const remoteParticipants = participants.filter((participant) => !participant.isLocal);
  const peerJoined = remoteParticipants.length > 0;
  const localVideo = snapshot?.cameraTracks?.find((track) => track.isLocal);
  const remoteVideos = snapshot?.cameraTracks?.filter((track) => !track.isLocal) ?? [];
  const primaryName = peer?.displayName
    || remoteParticipants[0]?.name
    || participants[0]?.name
    || (callType === "video" ? "Görüntülü arama" : "Sesli arama");
  const heroUserId = peer?.userId || remoteParticipants[0]?.identity;
  const heroAvatarUrl = peer?.avatarUrl;
  const callStatus = connecting
    ? "connecting"
    : connected && peerJoined
      ? "connected"
      : "waiting";
  const callStatusLabel = callStatus === "connecting"
    ? "Bağlanılıyor"
    : callStatus === "connected"
      ? "Bağlandı"
      : "Bekleniyor";

  const selectScreenSource = async (sourceId: string, preset: "presentation" | "balanced" | "performance", sourceLabel?: string) => {
    setScreenPickerOpen(false);
    try {
      await companionDataService.startScreenShare(sourceId, preset, sourceLabel);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Screen sharing could not start.");
    }
  };

  return (
    <CompanionFrame
      title={callType === "video" ? "Görüntülü arama" : "Sesli arama"}
      subtitle={
        callStatus === "connected"
          ? `${Math.max(1, remoteParticipants.length)} bağlı`
          : callStatus === "connecting"
            ? "Güvenli bağlantı kuruluyor"
            : connected
              ? "Karşı taraf bekleniyor"
              : "Bağlı değil"
      }
      variant="call"
      actions={callType === "video" ? (
        <button type="button" className="companion-icon-button" aria-label="PiP moda geç" onClick={enterPip}>PiP</button>
      ) : undefined}
    >
      {error ? <ErrorState message={error} retry={() => window.location.reload()} /> : callType === "voice" ? (
        <CompanionVoiceStage
          title={remoteParticipants.map((participant) => participant.name).filter(Boolean).join(" · ") || primaryName}
          eyebrow="Sesli arama"
          status={callStatus}
          statusLabel={
            callStatus === "connected"
              ? `${Math.max(1, remoteParticipants.length)} bağlı`
              : callStatusLabel
          }
          participants={participants.map((participant) => (
            participant.isLocal || !peer || participant.identity !== peer.userId
              ? participant
              : { ...participant, avatarUrl: peer.avatarUrl }
          ))}
          hero={{
            userId: heroUserId,
            displayName: primaryName,
            avatarUrl: heroAvatarUrl,
          }}
          waveActive={connected || connecting}
          waveIntense={peerJoined && participants.some((participant) => participant.isSpeaking) && !(snapshot?.muted ?? false)}
        />
      ) : (
        <section className="companion-call-stage is-video">
          {remoteVideos.map((track) => (
            <video
              key={track.id}
              ref={(element) => {
                if (element && element.srcObject !== track.stream) {
                  element.srcObject = track.stream;
                  void element.play().catch(() => undefined);
                }
              }}
              autoPlay
              playsInline
              muted={false}
              aria-label={`${track.participantName} videosu`}
            />
          ))}
          {!remoteVideos.length ? (
            <div className="companion-call-avatar is-speaking" aria-hidden="true">
              {heroUserId || heroAvatarUrl ? (
                <UserAvatar
                  userId={heroUserId}
                  displayName={primaryName}
                  fallbackUrl={heroAvatarUrl}
                  size={84}
                  priority="eager"
                  className="companion-call-avatar__photo"
                />
              ) : (
                initials(primaryName)
              )}
            </div>
          ) : null}
          {localVideo ? (
            <div className="companion-video-pip">
              <video
                ref={(element) => {
                  if (element && element.srcObject !== localVideo.stream) {
                    element.srcObject = localVideo.stream;
                    void element.play().catch(() => undefined);
                  }
                }}
                autoPlay
                playsInline
                muted
                aria-label="Senin kameran"
              />
              <span>Sen</span>
            </div>
          ) : null}
        </section>
      )}
      <CompanionCallControls
        className={`${callType === "video" ? " is-overlay" : ""}${callType === "video" && !controlsVisible ? " is-hidden" : ""}`}
        muted={Boolean(snapshot?.muted)}
        deafened={Boolean(snapshot?.deafened)}
        connected={connected}
        busy={connecting}
        leaveLabel="Aramayı bitir"
        onLeave={() => void leave()}
        onError={setError}
        extras={(
          <>
            {callType === "video" ? (
              <button
                type="button"
                className={snapshot?.cameraEnabled ? "" : "is-off"}
                onClick={() => void companionDataService.setCamera(!snapshot?.cameraEnabled).catch((reason) => setError(reason instanceof Error ? reason.message : "Kamera değiştirilemedi."))}
                aria-label={snapshot?.cameraEnabled ? "Kamerayı kapat" : "Kamerayı aç"}
              >
                <AppIcon name="camera" size={16} />
              </button>
            ) : null}
            <button
              type="button"
              className={snapshot?.screenSharing ? "is-active" : ""}
              aria-label={snapshot?.screenSharing ? "Ekran paylaşımını durdur" : "Ekran paylaş"}
              aria-pressed={Boolean(snapshot?.screenSharing)}
              disabled={!connected}
              onClick={() => snapshot?.screenSharing ? void companionDataService.stopScreenShare() : setScreenPickerOpen(true)}
            >
              <AppIcon name="image" size={16} />
            </button>
          </>
        )}
      />
      {screenPickerOpen ? <ScreenSharePickerModal connected={connected} onStart={(sourceId, preset, sourceLabel) => void selectScreenSource(sourceId, preset, sourceLabel)} onClose={() => setScreenPickerOpen(false)} /> : null}
    </CompanionFrame>
  );
}

function CompanionSettings() {
  const [preferences, setPreferences] = useState<CompanionPreferences>();
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    void getCompanionPreferences().then(setPreferences);
  }, []);

  const update = async (patch: Partial<Omit<CompanionPreferences, "version">>) => {
    if (!preferences) return;
    const previous = preferences;
    const optimistic = Object.freeze({ ...preferences, ...patch }) as CompanionPreferences;
    setPreferences(optimistic);
    if (typeof patch.compactDensity === "boolean") {
      document.documentElement.dataset.companionDensity = patch.compactDensity ? "compact" : "comfortable";
    }
    try {
      setSaveError("");
      const next = await updateCompanionPreferences(patch);
      if (typeof patch.closeToTray === "boolean") {
        await trayService.setCloseToTrayEnabled(patch.closeToTray);
      }
      setPreferences(next);
    } catch (reason) {
      setPreferences(previous);
      if (typeof previous.compactDensity === "boolean") {
        document.documentElement.dataset.companionDensity = previous.compactDensity ? "compact" : "comfortable";
      }
      setSaveError(reason instanceof Error ? reason.message : "Ayar kaydedilemedi.");
    }
  };

  if (!preferences) return <CompanionFrame title="Companion ayarları"><LoadingState /></CompanionFrame>;

  const edges: readonly CompanionDockEdge[] = ["left", "right", "top", "bottom"];
  const edgeLabels: Record<CompanionDockEdge, string> = { left: "Sol", right: "Sağ", top: "Üst", bottom: "Alt" };

  return (
    <CompanionFrame title="Companion Ayarları" subtitle="Pencere davranışı ve görünüm">
      <div className="companion-settings-scroll">
        <div className="companion-settings-group">
          <div className="companion-settings-group__label">Başlangıç</div>
          <section className="companion-settings-panel">
            <div className="companion-settings-panel__intro">
              <strong>Picom açıldığında</strong>
              <span>Seçilen mod doğrudan açılır. Companion seçildiğinde ana pencere gizli kalır.</span>
            </div>
            <div className="companion-segmented companion-segmented--lg" role="group" aria-label="Picom başlangıç modu">
              <button type="button" className={preferences.startupMode === "main" ? "is-active" : ""} onClick={() => void update({ startupMode: "main" })}>Ana mod</button>
              <button type="button" className={preferences.startupMode === "companion" ? "is-active" : ""} onClick={() => void update({ startupMode: "companion" })}>Companion</button>
            </div>
          </section>
        </div>

        <div className="companion-settings-group">
          <div className="companion-settings-group__label">Davranış</div>
          <section className="companion-settings-panel companion-settings-panel--list">
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy"><strong>Her zaman üstte</strong></div>
              <FluentToggle checked={preferences.alwaysOnTop} label="Her zaman üstte" onChange={(alwaysOnTop) => void update({ alwaysOnTop })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy">
                <strong>Akıllı daraltma</strong>
                <span>Baloncuklara geçiş</span>
              </div>
              <FluentToggle checked={preferences.smartCollapse} label="Akıllı daraltma" onChange={(smartCollapse) => void update({ smartCollapse })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy"><strong>Dock otomatik gizlensin</strong></div>
              <FluentToggle checked={preferences.dockAutoHide} label="Dock otomatik gizle" onChange={(dockAutoHide) => void update({ dockAutoHide })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy">
                <strong>Oyun modunu otomatik algıla</strong>
                <span>Tam ekranda ses kapsülü</span>
              </div>
              <FluentToggle checked={preferences.gamingAutoDetect} label="Oyun modunu otomatik algıla" onChange={(gamingAutoDetect) => void update({ gamingAutoDetect })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy"><strong>Bildirimler</strong></div>
              <FluentToggle checked={preferences.showNotifications} label="Bildirimler" onChange={(showNotifications) => void update({ showNotifications })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy"><strong>Kapatınca tepsiye küçült</strong></div>
              <FluentToggle checked={preferences.closeToTray} label="Kapatınca tepsiye küçült" onChange={(closeToTray) => void update({ closeToTray })} />
            </div>
            <div className="companion-settings-row">
              <div className="companion-settings-row__copy">
                <strong>Kompakt yoğunluk</strong>
                <span>Daha sık satırlar</span>
              </div>
              <FluentToggle checked={preferences.compactDensity} label="Kompakt yoğunluk" onChange={(compactDensity) => void update({ compactDensity })} />
            </div>
          </section>
        </div>

        <div className="companion-settings-group">
          <div className="companion-settings-group__label">Görünüm</div>
          <section className="companion-settings-panel">
            <div className="companion-opacity">
              <div className="companion-opacity__head">
                <strong>Pencere opaklığı</strong>
                <span className="companion-opacity__value">%{Math.round(preferences.windowOpacity * 100)}</span>
              </div>
              <input
                type="range"
                min={85}
                max={100}
                step={1}
                value={Math.round(preferences.windowOpacity * 100)}
                aria-label="Pencere opaklığı"
                onChange={(event) => void update({ windowOpacity: Number(event.target.value) / 100 })}
              />
            </div>
            <div className="companion-settings-field">
              <span className="companion-settings-field__label">Dock kenarı</span>
              <div className="companion-segmented" role="group" aria-label="Dock kenarı">
                {edges.map((edge) => (
                  <button key={edge} type="button" className={preferences.dockEdge === edge ? "is-active" : ""} onClick={() => void update({ dockEdge: edge })}>
                    {edgeLabels[edge]}
                  </button>
                ))}
              </div>
            </div>
            <div className="companion-settings-field">
              <span className="companion-settings-field__label">Tema</span>
              <div className="companion-segmented" role="group" aria-label="Companion teması">
                {(["system", "light", "dark"] as const).map((theme) => (
                  <button key={theme} type="button" className={preferences.theme === theme ? "is-active" : ""} onClick={() => void update({ theme })}>
                    {theme === "system" ? "Sistem" : theme === "light" ? "Açık" : "Koyu"}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="companion-settings-group">
          <div className="companion-settings-group__label">Kısayollar</div>
          <section className="companion-settings-panel companion-settings-panel--list">
            <div className="companion-shortcut-row"><span>Companion'a geç</span><kbd>Ctrl+Shift+C</kbd></div>
            <div className="companion-shortcut-row"><span>Hızlı yanıt</span><kbd>Ctrl+Shift+Y</kbd></div>
            <div className="companion-shortcut-row"><span>Mikrofonu aç/kapat</span><kbd>Ctrl+Shift+M</kbd></div>
          </section>
        </div>

        <div className="companion-a11y-note">
          <AppIcon name="eye" size={14} />
          <span>“Hareketi azalt” sistem ayarı açıkken tüm yay animasyonları solmaya döner.</span>
        </div>

        <section className="companion-settings-panel companion-settings-panel--action">
          <div className="companion-settings-panel__intro">
            <strong>Oyun modu</strong>
            <span>Tam ekran oyunlarda yalnızca ses kapsülü ve geçici mesaj balonu göster.</span>
          </div>
          <button type="button" className="companion-settings-action" onClick={() => openWindow("gaming")}>Oyun modunu aç</button>
        </section>

        {saveError ? <p className="companion-settings-feedback" role="alert">{saveError}</p> : null}
      </div>
    </CompanionFrame>
  );
}

function CompanionDock({ bubble = false }: { bubble?: boolean }) {
  const [snapshot, setSnapshot] = useState<CompanionHomeSnapshot | null>(null);
  const [prefs, setPrefs] = useState<CompanionPreferences>();
  const [layout, setLayout] = useState<"collapsed" | "rail" | "expanded">("rail");
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void getCompanionPreferences().then(setPrefs);
    void companionDataService.subscribeHome(setSnapshot).then((next) => {
      cleanup = next;
    });
    const removeSync = window.picomDesktop?.companion?.onSync((event) => {
      if (event.topic === "preferences") void getCompanionPreferences().then(setPrefs);
    });
    return () => {
      cleanup?.();
      removeSync?.();
    };
  }, []);

  useEffect(() => {
    if (bubble || !prefs || prefs.dockAutoHide) return;
    setLayout((current) => {
      if (current !== "collapsed") return current;
      void window.picomDesktop?.companion?.setDockLayout?.("rail");
      return "rail";
    });
  }, [bubble, prefs, prefs?.dockAutoHide]);

  useEffect(() => {
    if (!prefs?.dockAutoHide || bubble) return;
    const arm = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        setLayout("collapsed");
        void window.picomDesktop?.companion?.setDockLayout?.("collapsed");
      }, 30_000);
    };
    const wake = () => {
      setLayout((current) => (current === "collapsed" ? "rail" : current));
      void window.picomDesktop?.companion?.setDockLayout?.("rail");
      arm();
    };
    arm();
    window.addEventListener("pointermove", wake);
    window.addEventListener("focus", wake);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("focus", wake);
    };
  }, [bubble, prefs?.dockAutoHide]);

  useEffect(() => {
    if (!bubble) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void window.picomDesktop?.companion?.closeCurrent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bubble]);

  const online = snapshot?.people.filter((person) => person.status === "online") ?? [];
  const favorites = snapshot?.people.filter((person) => person.favorite) ?? [];
  const dockPeople = (favorites.length ? favorites : online).slice(0, 8);
  const unreadPeople = useMemo(
    () => snapshot?.people.filter((person) => (person.unreadCount ?? 0) > 0).slice(0, 3) ?? [],
    [snapshot?.people],
  );
  const unreadTotal = snapshot?.people.filter((person) => (person.unreadCount ?? 0) > 0).length ?? 0;
  const bubbleHasPreview = Boolean(unreadPeople[0]?.lastMessagePreview);

  useEffect(() => {
    if (!bubble) return;
    const count = Math.max(1, unreadPeople.length);
    const width = unreadPeople.length === 0 ? 72 : bubbleHasPreview ? 214 : 76;
    const height = unreadPeople.length === 0
      ? 72
      : 10 + count * 58 + (unreadTotal > 3 ? 48 : 0) + 28;
    const api = window.picomDesktop?.companion;
    if (!api?.setWindowBounds) return;
    const nextX = Math.round(window.screenX + (window.outerWidth - width));
    const nextY = Math.round(window.screenY + (window.outerHeight - height));
    void api.setWindowBounds({ width, height, x: nextX, y: nextY });
  }, [bubble, bubbleHasPreview, unreadPeople.length, unreadTotal]);

  if (bubble) {
    const closeBubble = (event?: { stopPropagation(): void }) => {
      event?.stopPropagation();
      void window.picomDesktop?.companion?.closeCurrent();
    };
    const primary = unreadPeople[0];
    const rest = unreadPeople.slice(1);

    return (
      <CompanionFrame title="Bubble" variant="bubble">
        <div className={`companion-bubble-stack${primary ? " has-unread" : " is-idle"}`}>
          {primary ? (
            <div className={`companion-bubble-wrap${primary.lastMessagePreview ? " has-preview" : ""}`}>
              {primary.lastMessagePreview ? (
                <div className="companion-bubble-preview" aria-live="polite">{primary.lastMessagePreview}</div>
              ) : null}
              <button
                type="button"
                className={`companion-bubble is-avatar${(primary.unreadCount ?? 0) > 0 ? " is-pulse" : ""}`}
                aria-label={`${primary.displayName} sohbetini aç`}
                onClick={() => primary.conversationId && openWindow("chat", { conversationId: primary.conversationId })}
              >
                <UserAvatar
                  userId={primary.userId}
                  displayName={primary.displayName}
                  fallbackUrl={primary.avatarUrl}
                  size={52}
                  priority="eager"
                  className="companion-bubble__avatar"
                />
                {(primary.unreadCount ?? 0) > 0 ? <b>{primary.unreadCount! > 9 ? "9+" : primary.unreadCount}</b> : null}
              </button>
            </div>
          ) : (
            <div className="companion-bubble-wrap companion-bubble-wrap--idle">
              <button type="button" className="companion-bubble companion-bubble--logo" aria-label="Picom Companion'ı aç" onClick={() => openWindow("home")}>
                <img className="companion-bubble__logo" src={brandLogoUrl} alt="" draggable={false} />
              </button>
              <button type="button" className="companion-bubble-dismiss" aria-label="Baloncuğu kapat" onClick={(event) => closeBubble(event)}>
                <AppIcon name="close" size={10} />
              </button>
            </div>
          )}
          {rest.map((person) => (
            <div key={person.userId} className="companion-bubble-wrap">
              <button
                type="button"
                className={`companion-bubble is-avatar${(person.unreadCount ?? 0) > 0 ? " is-pulse" : ""}`}
                aria-label={`${person.displayName} sohbetini aç`}
                onClick={() => person.conversationId && openWindow("chat", { conversationId: person.conversationId })}
              >
                <UserAvatar
                  userId={person.userId}
                  displayName={person.displayName}
                  fallbackUrl={person.avatarUrl}
                  size={52}
                  priority="eager"
                  className="companion-bubble__avatar"
                />
                {(person.unreadCount ?? 0) > 0 ? <b>{person.unreadCount! > 9 ? "9+" : person.unreadCount}</b> : null}
              </button>
            </div>
          ))}
          {unreadTotal > 3 ? (
            <button type="button" className="companion-bubble companion-bubble--more" onClick={() => openWindow("home")}>
              <span>+{unreadTotal - 3}</span>
            </button>
          ) : null}
          {primary ? (
            <button type="button" className="companion-bubble-dismiss companion-bubble-dismiss--stack" aria-label="Baloncukları kapat" onClick={() => closeBubble()}>
              <AppIcon name="close" size={10} />
            </button>
          ) : null}
        </div>
      </CompanionFrame>
    );
  }

  return (
    <CompanionFrame title="Dock" subtitle={`${online.length} çevrimiçi`} variant="dock" actions={(
      <button type="button" className="companion-icon-button" aria-label="Companion ana sayfa" onClick={() => openWindow("home")}>
        <AppIcon name="users" size={15} />
      </button>
    )}>
      <div
        className={`companion-dock-rail${layout === "collapsed" ? " is-collapsed" : ""}${layout === "expanded" ? " is-expanded" : ""}`}
        onMouseEnter={() => {
          setLayout("expanded");
          void window.picomDesktop?.companion?.setDockLayout?.("expanded");
        }}
        onMouseLeave={() => {
          setLayout(prefs?.dockAutoHide ? "rail" : "rail");
          void window.picomDesktop?.companion?.setDockLayout?.("rail");
        }}
      >
        <div className="companion-titlebar__brand" aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9 }}><img className="companion-titlebar__brand-image" src={brandLogoUrl} alt="" /></div>
        <div className="companion-dock-rail__divider" />
        {dockPeople.map((person, index) => (
          <button
            key={person.userId}
            type="button"
            className="companion-dock-avatar"
            aria-label={`${person.displayName} ile sohbet`}
            onClick={() => person.conversationId && openWindow("chat", { conversationId: person.conversationId })}
          >
            <UserAvatar userId={person.userId} displayName={person.displayName} fallbackUrl={person.avatarUrl} size={36} />
            {(person.unreadCount ?? 0) > 0 || index === 0 && online.length > 1 ? (
              <span className="companion-dock-avatar__badge">{(person.unreadCount ?? 0) > 0 ? Math.min(person.unreadCount!, 9) : Math.min(online.length, 9)}</span>
            ) : null}
            {layout === "expanded" ? (
              <span className="companion-dock-avatar__meta">
                <strong>{person.displayName}</strong>
                <small>{person.lastMessagePreview || companionStatusLabel(person.status)}</small>
              </span>
            ) : null}
          </button>
        ))}
        {!dockPeople.length ? <span style={{ color: "var(--companion-faint)", fontSize: 10, writingMode: "vertical-rl" }}>Çevrimiçi yok</span> : null}
        <div className="companion-dock-spacer" />
        <button type="button" className="companion-icon-button" aria-label="Yeni sohbet" onClick={() => void window.picomDesktop?.companion?.returnToMain()}>
          <AppIcon name="plus" size={15} />
        </button>
      </div>
    </CompanionFrame>
  );
}

export function CompanionApp() {
  const [route, setRoute] = useState<CompanionRoute>(() => parseCompanionRoute());
  const [preferences, setPreferences] = useState<CompanionPreferences>();
  const [picomThemePreference, setPicomThemePreference] = useState<PicomThemePreference>(getPicomThemePreference);

  useEffect(() => {
    const syncRoute = () => setRoute(parseCompanionRoute());
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.picomDesktop?.companion?.getContext?.().then((context) => {
      if (cancelled || !context) return;
      const next = parseCompanionRoute(
        `?type=${encodeURIComponent(String(context.type ?? "home"))}`
        + (context.conversationId ? `&conversationId=${encodeURIComponent(context.conversationId)}` : "")
        + (context.callId ? `&callId=${encodeURIComponent(context.callId)}` : "")
        + (context.communityId ? `&communityId=${encodeURIComponent(context.communityId)}` : "")
        + (context.channelId ? `&channelId=${encodeURIComponent(context.channelId)}` : ""),
      );
      setRoute((current) => (
        next.type === current.type
        && next.conversationId === current.conversationId
        && next.callId === current.callId
        && next.communityId === current.communityId
        && next.channelId === current.channelId
          ? current
          : next
      ));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void getCompanionPreferences().then(setPreferences);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PICOM_SETTINGS_STORAGE_KEY) return;
      const nextTheme = getPicomThemePreferenceFromStorage(event.newValue);
      if (nextTheme) setPicomThemePreference(nextTheme);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const companionPreference = preferences?.theme ?? "system";
    const effectivePreference = companionPreference === "system" ? picomThemePreference : companionPreference;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = effectivePreference === "system" ? (systemTheme.matches ? "dark" : "light") : effectivePreference;
      document.documentElement.dataset.companionTheme = resolved;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    if (effectivePreference !== "system") return undefined;
    systemTheme.addEventListener("change", applyTheme);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [picomThemePreference, preferences?.theme]);

  useEffect(() => {
    document.documentElement.dataset.companionDensity = preferences?.compactDensity ? "compact" : "comfortable";
  }, [preferences?.compactDensity]);

  useEffect(() => {
    document.documentElement.dataset.companionWindow = "true";
    const transparent = route.type === "bubble" || route.type === "notification" || route.type === "gaming";
    document.documentElement.dataset.companionSurface = transparent ? route.type : "panel";
    return () => {
      delete document.documentElement.dataset.companionSurface;
    };
  }, [route.type]);

  useUnreadNotifications(Boolean(preferences?.showNotifications) && route.type === "home");

  useEffect(() => {
    const remove = window.picomDesktop?.companion?.onSync((event) => {
      if (event.topic === "preferences") {
        void getCompanionPreferences().then(setPreferences);
        return;
      }
      if (event.topic !== "quick-reply") return;
      void companionDataService.loadHome().then((home) => {
        const person = home.people.find((item) => (item.unreadCount ?? 0) > 0 && item.conversationId);
        if (person?.conversationId) openWindow("notification", { conversationId: person.conversationId });
      });
    });
    return () => remove?.();
  }, []);

  switch (route.type) {
    case "chat": return <CompanionChat route={route} />;
    case "community": return <CompanionCommunity route={route} />;
    case "voice":
    case "video": return <CompanionCall route={route} />;
    case "settings": return <CompanionSettings />;
    case "dock": return <CompanionDock />;
    case "bubble": return <CompanionDock bubble />;
    case "notification": return <CompanionNotification route={route} />;
    case "gaming": return <CompanionGaming />;
    default: return <CompanionHome />;
  }
}
