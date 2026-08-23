import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";
import { notificationPolicyStateService, type NotificationPolicyState } from "../../services/notificationPolicyStateService";
import { notificationService, type NotificationRuntimeStatus } from "../../services/notificationService";
import { settingsService, type NotificationSettings } from "../../services/settingsService";
import { translateSettings, type SettingsI18nKey } from "../../services/settings/settingsI18n";

const NOTIFICATION_CATEGORY_KEYS = [
  "directMessages",
  "mentions",
  "incomingCalls",
  "friendRequests",
  "communityAnnouncements",
] as const;

type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY_KEYS)[number];
type NotificationPreset = "recommended" | "focused" | "minimal" | "custom";

const CATEGORY_COPY: Readonly<Record<NotificationCategoryKey, Readonly<{ label: SettingsI18nKey; description: SettingsI18nKey }>>> = {
  directMessages: { label: "notifications.pref.directMessages.label", description: "notifications.pref.directMessages.description" },
  mentions: { label: "notifications.pref.mentions.label", description: "notifications.pref.mentions.description" },
  incomingCalls: { label: "notifications.pref.incomingCalls.label", description: "notifications.pref.incomingCalls.description" },
  friendRequests: { label: "notifications.pref.friendRequests.label", description: "notifications.pref.friendRequests.description" },
  communityAnnouncements: { label: "notifications.pref.communityAnnouncements.label", description: "notifications.pref.communityAnnouncements.description" },
};

const PRESETS: Readonly<Record<Exclude<NotificationPreset, "custom">, Readonly<Record<NotificationCategoryKey, boolean>>>> = {
  recommended: { directMessages: true, mentions: true, incomingCalls: true, friendRequests: true, communityAnnouncements: true },
  focused: { directMessages: true, mentions: true, incomingCalls: true, friendRequests: false, communityAnnouncements: false },
  minimal: { directMessages: false, mentions: true, incomingCalls: true, friendRequests: false, communityAnnouncements: false },
};

function resolvePreset(settings: NotificationSettings): NotificationPreset {
  for (const [preset, values] of Object.entries(PRESETS) as Array<[Exclude<NotificationPreset, "custom">, Readonly<Record<NotificationCategoryKey, boolean>>]>) {
    if (NOTIFICATION_CATEGORY_KEYS.every((key) => settings[key] === values[key])) return preset;
  }
  return "custom";
}

export function firstLaunchNotificationStatusKey(status: NotificationRuntimeStatus): string {
  if (status.capability === "native-checking") return "notifications.statusChecking";
  if (status.capability === "native-available" || status.capability === "browser-granted") return "notifications.statusAvailable";
  if (status.capability === "browser-permission-required") return "notifications.statusPermissionRequired";
  if (status.capability === "browser-blocked") return "notifications.statusBlocked";
  if (status.capability === "native-unsupported" || status.capability === "unsupported") return "notifications.statusUnsupported";
  return "notifications.statusUnavailable";
}

export function FirstLaunchNotificationsStudio() {
  const { t, locale } = useTranslation("firstLaunch");
  const settingsT = (key: SettingsI18nKey) => translateSettings(key, locale);
  const [settings, setSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [policy, setPolicy] = useState<NotificationPolicyState>(() => notificationPolicyStateService.getSnapshot());
  const [status, setStatus] = useState<NotificationRuntimeStatus>(() => notificationService.getStatus());
  const [busy, setBusy] = useState<"permission" | "test" | null>(null);
  const [message, setMessage] = useState<Readonly<{ tone: "success" | "error"; text: string }> | null>(null);
  const preset = useMemo(() => resolvePreset(settings), [settings]);

  useEffect(() => {
    let active = true;
    void notificationService.refreshStatus().then((next) => { if (active) setStatus(next); });
    const unsubscribeSettings = settingsService.subscribe((next) => setSettings(next.notificationSettings));
    const unsubscribePolicy = notificationPolicyStateService.subscribe(setPolicy);
    return () => {
      active = false;
      unsubscribeSettings();
      unsubscribePolicy();
    };
  }, []);

  const updateSettings = (partial: Partial<NotificationSettings>) => {
    setMessage(null);
    setSettings(settingsService.updateNotificationSettings(partial).notificationSettings);
  };

  const choosePreset = (nextPreset: Exclude<NotificationPreset, "custom">) => {
    updateSettings(PRESETS[nextPreset]);
  };

  const requestPermission = async () => {
    setBusy("permission");
    setMessage(null);
    const result = await notificationService.requestPermission();
    const refreshed = await notificationService.refreshStatus();
    setStatus(refreshed);
    setBusy(null);
    setMessage(result.ok
      ? { tone: "success", text: t("notifications.permissionEnabled") }
      : { tone: "error", text: t("notifications.permissionFailed") });
  };

  const sendTest = async () => {
    setBusy("test");
    setMessage(null);
    const result = await notificationService.showTestNotification({ title: t("notifications.testTitle"), body: t("notifications.testBody") });
    setStatus(await notificationService.refreshStatus());
    setBusy(null);
    setMessage(result.ok
      ? { tone: "success", text: t("notifications.testSent") }
      : { tone: "error", text: t("notifications.testFailed") });
  };

  const canSendTest = settings.enabled && settings.nativeDesktopEnabled
    && (status.capability === "native-available" || status.capability === "browser-granted");
  const nativeDeliveryAvailable = status.capability === "native-checking" || status.capability === "native-available" || status.capability === "browser-granted" || status.capability === "browser-permission-required";

  return (
    <div className="first-launch-notifications-studio">
      <section className="first-launch-notification-group" aria-labelledby="first-launch-notification-desktop">
        <div className="first-launch-notification-heading">
          <h3 id="first-launch-notification-desktop">{t("notifications.desktopTitle")}</h3>
          <p>{t("notifications.desktopBody")}</p>
        </div>
        <div className="first-launch-notification-status" aria-live="polite">
          <span>{t("notifications.desktopStatus")}</span>
          <strong>{t(firstLaunchNotificationStatusKey(status))}</strong>
          <small>{status.nativeBridgeAvailable ? t("notifications.systemControlledHint") : t("notifications.browserFallbackHint")}</small>
        </div>
        {status.requiresPermission ? <button type="button" className="secondary" disabled={busy !== null} onClick={() => void requestPermission()}>{busy === "permission" ? t("notifications.requesting") : t("notifications.enablePermission")}</button> : null}
        <label className="first-launch-notification-toggle">
          <span><strong>{settingsT("notifications.enableAll")}</strong><small>{settingsT("notifications.masterHint")}</small></span>
          <input type="checkbox" checked={settings.enabled} disabled={busy !== null} onChange={(event) => updateSettings({ enabled: event.target.checked })} />
        </label>
        <label className="first-launch-notification-toggle">
          <span><strong>{settingsT("notifications.nativeDesktop")}</strong><small>{settingsT("notifications.nativeHint")}</small></span>
          <input type="checkbox" checked={settings.nativeDesktopEnabled} disabled={!nativeDeliveryAvailable || !settings.enabled || busy !== null} onChange={(event) => updateSettings({ nativeDesktopEnabled: event.target.checked })} />
        </label>
        <button type="button" className="secondary" disabled={!canSendTest || busy !== null} onClick={() => void sendTest()}>{busy === "test" ? t("notifications.sendingTest") : settingsT("notifications.sendTest")}</button>
      </section>

      <section className="first-launch-notification-group" aria-labelledby="first-launch-notification-preferences">
        <div className="first-launch-notification-heading">
          <h3 id="first-launch-notification-preferences">{t("notifications.notifyLegend")}</h3>
          <p>{t("notifications.notifyBody")}</p>
        </div>
        <fieldset className="first-launch-notification-options" disabled={!settings.enabled || busy !== null}>
          <legend>{t("notifications.presetLegend")}</legend>
          {(["recommended", "focused", "minimal"] as const).map((option) => <label className="first-launch-notification-radio" key={option}>
            <input type="radio" name="first-launch-notification-preset" checked={preset === option} onChange={() => choosePreset(option)} />
            <span><strong>{t(`notifications.preset.${option}`)}</strong><small>{t(`notifications.preset.${option}Hint`)}</small></span>
          </label>)}
          {preset === "custom" ? <p className="first-launch-notification-custom" role="status">{t("notifications.preset.custom")}</p> : null}
        </fieldset>
        <fieldset className="first-launch-notification-options" disabled={!settings.enabled || busy !== null}>
          <legend>{t("notifications.categoryLegend")}</legend>
          {NOTIFICATION_CATEGORY_KEYS.map((key) => <label className="first-launch-notification-toggle" key={key}>
            <span><strong>{settingsT(CATEGORY_COPY[key].label)}</strong><small>{settingsT(CATEGORY_COPY[key].description)}</small></span>
            <input type="checkbox" checked={settings[key]} onChange={(event) => updateSettings({ [key]: event.target.checked })} />
          </label>)}
        </fieldset>
      </section>

      <section className="first-launch-notification-group" aria-labelledby="first-launch-notification-focus">
        <div className="first-launch-notification-heading">
          <h3 id="first-launch-notification-focus">{t("notifications.focusLegend")}</h3>
          <p>{t("notifications.focusBody")}</p>
        </div>
        <label className="first-launch-notification-toggle">
          <span><strong>{settingsT("notifications.dnd")}</strong><small>{settingsT("notifications.dndHint")}</small></span>
          <input type="checkbox" checked={policy.doNotDisturb} disabled={busy !== null} onChange={(event) => setPolicy(notificationPolicyStateService.setDoNotDisturb(event.target.checked))} />
        </label>
        <fieldset className="first-launch-notification-options" disabled={busy !== null}>
          <legend>{t("notifications.quietLegend")}</legend>
          <label className="first-launch-notification-toggle">
            <span><strong>{settingsT("notifications.enableQuiet.label")}</strong><small>{settingsT("notifications.enableQuiet.hint")}</small></span>
            <input type="checkbox" checked={settings.quietHours.enabled} onChange={(event) => updateSettings({ quietHours: { ...settings.quietHours, enabled: event.target.checked } })} />
          </label>
          <div className="first-launch-notification-time-grid">
            <label><span>{settingsT("notifications.startTime")}</span><input type="time" value={settings.quietHours.startTime} disabled={!settings.quietHours.enabled} onChange={(event) => updateSettings({ quietHours: { ...settings.quietHours, startTime: event.target.value } })} /></label>
            <label><span>{settingsT("notifications.endTime")}</span><input type="time" value={settings.quietHours.endTime} disabled={!settings.quietHours.enabled} onChange={(event) => updateSettings({ quietHours: { ...settings.quietHours, endTime: event.target.value } })} /></label>
          </div>
          <label className="first-launch-notification-toggle">
            <span><strong>{settingsT("notifications.applyTo.label")}</strong><small>{settingsT("notifications.applyTo.hint")}</small></span>
            <select value={settings.quietHours.applyTo} disabled={!settings.quietHours.enabled} onChange={(event) => updateSettings({ quietHours: { ...settings.quietHours, applyTo: event.target.value as typeof settings.quietHours.applyTo } })}>
              <option value="all_notifications">{settingsT("notifications.applyTo.all")}</option>
              <option value="normal_messages_only">{settingsT("notifications.applyTo.normalOnly")}</option>
              <option value="sounds_only">{settingsT("notifications.applyTo.soundsOnly")}</option>
            </select>
          </label>
          <label className="first-launch-notification-toggle">
            <span><strong>{settingsT("notifications.allowMentionsQuiet.label")}</strong><small>{settingsT("notifications.allowMentionsQuiet.hint")}</small></span>
            <input type="checkbox" checked={settings.quietHours.allowMentions} disabled={!settings.quietHours.enabled} onChange={(event) => updateSettings({ quietHours: { ...settings.quietHours, allowMentions: event.target.checked } })} />
          </label>
          <small className="first-launch-notification-helper">{settingsT("notifications.quietTimezoneHint")}</small>
        </fieldset>
        <p className="first-launch-notification-helper">{settingsT("notifications.mutedHint")}</p>
      </section>

      {message ? <p className={`first-launch-notification-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
    </div>
  );
}
