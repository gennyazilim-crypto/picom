import { useCallback, useEffect, useState } from "react";
import { notificationService } from "../services/notificationService";
import { feedbackService, type FeedbackIssueType } from "../services/feedbackService";
import { authService } from "../services/authService";
import { menuService } from "../services/menuService";
import { settingsService, type NotificationSettings, type ProfileSettings } from "../services/settingsService";
import { statusPageService } from "../services/statusPageService";
import { sessionManagementService, type SessionDeviceSummary } from "../services/sessionManagementService";
import { twoFactorAuthService } from "../services/twoFactorAuthService";
import { accountDeletionService } from "../services/accountDeletionService";
import { dataExportService } from "../services/dataExportService";
import { appLockService } from "../services/appLockService";
import { shortcutService } from "../services/shortcutService";
import { startupService } from "../services/startupService";
import { trayService } from "../services/trayService";
import { dateTimeService } from "../services/dateTimeService";
import { AdminOperationsPanel } from "./AdminOperationsPanel";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";

type SettingsModalProps = {
  theme: "light" | "dark";
  profileSettings: ProfileSettings;
  onThemeChange: (theme: "light" | "dark") => void;
  onProfileSettingsChange: (settings: ProfileSettings) => void;
  onClose: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function SettingsModal({ theme, profileSettings, onThemeChange, onProfileSettingsChange, onClose, pushToast }: SettingsModalProps) {
  const [active, setActive] = useState("Appearance");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(profileSettings);
  const [feedbackIssueType, setFeedbackIssueType] = useState<FeedbackIssueType>("bug");
  const [feedbackTitle, setFeedbackTitle] = useState("Beta feedback placeholder");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [emailVerificationMessage, setEmailVerificationMessage] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<SessionDeviceSummary[]>([]);
  const [sessionManagementMessage, setSessionManagementMessage] = useState<string | null>(null);
  const [twoFactorStatus, setTwoFactorStatus] = useState(() => twoFactorAuthService.getStatus());
  const [twoFactorMessage, setTwoFactorMessage] = useState(twoFactorStatus.message);
  const [accountDeletionStatus, setAccountDeletionStatus] = useState(() => accountDeletionService.getStatus());
  const [accountDeletionConfirmText, setAccountDeletionConfirmText] = useState("");
  const [dataExportStatus, setDataExportStatus] = useState(() => dataExportService.getStatus());
  const [appLockSettings, setAppLockSettings] = useState(() => appLockService.getSettings());
  const [startupSettings, setStartupSettings] = useState(() => startupService.getState());
  const showAdminOperationsPlaceholder = import.meta.env.DEV;
  const sections = ["Account", "Profile", "Appearance", "Notifications", "Voice & Video", "Keyboard Shortcuts", "Advanced"];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setProfileDraft(profileSettings);
  }, [profileSettings]);

  const refreshActiveSessions = useCallback(async () => {
    const result = await sessionManagementService.getActiveSessions();
    if (!result.ok) {
      setSessionManagementMessage(result.message);
      setActiveSessions([]);
      pushToast(result.message, result.requiresSignIn ? "error" : "info");
      return;
    }

    setActiveSessions(result.data.sessions);
    setSessionManagementMessage(result.data.message);
  }, [pushToast]);

  useEffect(() => {
    if (active === "Account") {
      void refreshActiveSessions();
    }
  }, [active, refreshActiveSessions]);

  const testNotification = async () => {
    const result = await notificationService.showTestNotification();
    pushToast(result.ok ? "Notification placeholder sent." : result.reason ?? "Notification unavailable.", result.ok ? "success" : "error");
  };
  const notificationStatus = notificationService.getStatus();
  const updateNotifications = (partial: Partial<NotificationSettings>) => {
    const next = settingsService.updateNotificationSettings(partial).notificationSettings;
    setNotificationSettings(next);
    pushToast("Notification setting saved locally.", "success");
  };
  const saveProfileSettings = () => {
    const next = settingsService.updateProfileSettings({
      displayName: profileDraft.displayName.trim(),
      statusText: profileDraft.statusText.trim(),
      bio: profileDraft.bio.trim(),
    }).profileSettings;
    onProfileSettingsChange(next);
    pushToast("Profile changes saved locally.", "success");
  };
  const resetProfileSettings = () => {
    const next = settingsService.updateProfileSettings({ displayName: "", statusText: "", bio: "" }).profileSettings;
    setProfileDraft(next);
    onProfileSettingsChange(next);
    pushToast("Profile changes reset locally.", "info");
  };
  const createFeedbackDraft = () => ({
    issueType: feedbackIssueType,
    title: feedbackTitle.trim() || "Beta feedback placeholder",
    description: feedbackDescription.trim() || "No description provided.",
    includeDiagnostics,
    includeLogs
  });
  const submitFeedbackPlaceholder = () => {
    const result = feedbackService.submitPlaceholder(createFeedbackDraft());
    pushToast(`${result.message} Ref: ${result.referenceId}`, "success");
  };
  const exportDiagnostics = async () => {
    const result = await feedbackService.exportSupportDiagnostics(createFeedbackDraft());
    if (result.ok) {
      pushToast(result.canceled ? "Diagnostics export canceled." : `Diagnostics exported via ${result.method}.`, result.canceled ? "info" : "success");
      return;
    }

    pushToast(result.reason, "error");
  };
  const openSystemStatus = async () => {
    const result = await statusPageService.openStatusPage();
    if (result.ok) {
      pushToast(`Opened system status: ${statusPageService.getDisplayDomain()}.`, "success");
      return;
    }

    pushToast(result.reason === "STATUS_PAGE_URL_NOT_CONFIGURED" ? "System status page is not configured yet." : "System status page could not be opened.", "info");
  };
  const updateLaunchOnStartup = (enabled: boolean) => {
    const next = startupService.setLaunchOnStartupEnabled(enabled);
    setStartupSettings(next);
    pushToast(enabled ? "Launch on startup placeholder enabled locally." : "Launch on startup placeholder disabled locally.", "info");
  };
  const updateStartMinimizedToTray = (enabled: boolean) => {
    const next = startupService.setStartMinimizedToTray(enabled);
    setStartupSettings(next);
    pushToast(enabled ? "Start minimized to tray placeholder enabled locally." : "Start minimized to tray placeholder disabled locally.", "info");
  };
  const updateLockAfterInactivity = (enabled: boolean) => {
    const next = appLockService.updateSettings({ lockAfterInactivityEnabled: enabled });
    setAppLockSettings(next);
    pushToast(enabled ? "Inactivity lock placeholder enabled locally." : "Inactivity lock placeholder disabled locally.", "info");
  };
  const requestEmailVerification = async () => {
    const result = await authService.requestEmailVerification();
    if (!result.ok) {
      setEmailVerificationMessage(result.error.message);
      pushToast(result.error.message, "error");
      return;
    }

    setEmailVerificationMessage(result.data.message);
    pushToast(result.data.message, "success");
  };
  const revokeOtherSessions = async () => {
    const result = await sessionManagementService.revokeOtherSessions();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setSessionManagementMessage(result.data.message);
    pushToast(result.data.message, "success");
  };
  const prepareTwoFactorPlaceholder = () => {
    const result = twoFactorAuthService.prepareSetupPlaceholder();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setTwoFactorStatus(result.data);
    setTwoFactorMessage(result.data.message);
    pushToast("Two-factor placeholder prepared locally.", "success");
  };
  const disableTwoFactorPlaceholder = () => {
    const result = twoFactorAuthService.disablePlaceholder();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setTwoFactorStatus(result.data);
    setTwoFactorMessage(result.data.message);
    pushToast("Two-factor placeholder disabled locally.", "info");
  };
  const regenerateRecoveryCodesPlaceholder = () => {
    const result = twoFactorAuthService.regenerateRecoveryCodesPlaceholder();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setTwoFactorMessage(result.data.message);
    pushToast(result.data.message, "info");
  };
  const accountDeletionConfirmationText = profileDraft.displayName.trim() || "Picom Mock User";
  const requestAccountDeletionPlaceholder = () => {
    const result = accountDeletionService.requestDeletionPlaceholder(accountDeletionConfirmText, accountDeletionConfirmationText);
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    pushToast(result.data.message, "success");
  };
  const cancelAccountDeletionPlaceholder = () => {
    const result = accountDeletionService.cancelDeletionPlaceholder();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    pushToast("Account deletion placeholder canceled.", "info");
  };
  const requestDataExportPlaceholder = () => {
    const result = dataExportService.requestExportPlaceholder();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setDataExportStatus(result.data);
    pushToast(result.data.message, "success");
  };
  const downloadDataExportPlaceholder = () => {
    const payload = dataExportService.buildPlaceholderPayload(profileDraft);
    if (!payload.ok) {
      pushToast(payload.message, "error");
      return;
    }

    const result = dataExportService.downloadPlaceholderJson(payload.data);
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    pushToast(`Data export placeholder downloaded: ${result.data.fileName}.`, "success");
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="settings-nav">
          <span className="eyebrow">Settings</span>
          <h2>Picom Desktop</h2>
          <div className="settings-tabs">
            {sections.map((section) => (
              <button key={section} className={active === section ? "active" : ""} onClick={() => setActive(section)}>
                <span className="tab-dot" />{section}
              </button>
            ))}
          </div>
        </aside>
        <main className="settings-content">
          <button className="icon-button modal-close" aria-label="Close settings" onClick={onClose}>
            <AppIcon name={overlayIcons.close} size="lg" />
          </button>
          <span className="eyebrow">{active}</span>
          <h2>{active}</h2>
          {active === "Appearance" ? (
            <div className="theme-grid">
              <button className={`theme-card ${theme === "light" ? "selected" : ""}`} onClick={() => onThemeChange("light")}>
                <span className="theme-preview light-preview" />
                <strong>Light Theme</strong>
                <small>Soft shell with clean white surfaces.</small>
              </button>
              <button className={`theme-card ${theme === "dark" ? "selected" : ""}`} onClick={() => onThemeChange("dark")}>
                <span className="theme-preview dark-preview" />
                <strong>Dark Theme</strong>
                <small>Charcoal shell with separated surfaces.</small>
              </button>
            </div>
          ) : active === "Account" ? (
            <div className="placeholder-panel action-panel">
              <strong>Account security foundation</strong>
              <p>Security controls are prepared as beta placeholders. Supabase Auth remains the source of truth for production account actions.</p>
              <div className="settings-status-card" aria-label="Email verification placeholder">
                <span>Email verification</span>
                <strong>Verification placeholder</strong>
                <small>{emailVerificationMessage ?? "Email verification is prepared but not required for MVP login."}</small>
              </div>
              <div className="security-card-grid">
                <article className="security-card">
                  <span>Session</span>
                  <strong>Current desktop session</strong>
                  <small>Session restore is handled by the auth data source. Raw tokens are never shown here.</small>
                </article>
                <article className="security-card">
                  <span>Password</span>
                  <strong>Password reset placeholder</strong>
                  <small>Future flow should use Supabase Auth and never reveal whether an email exists.</small>
                </article>
                <article className="security-card">
                  <span>2FA</span>
                  <strong>{twoFactorStatus.enabled ? "Prepared locally" : "Two-factor placeholder"}</strong>
                  <small>{twoFactorMessage}</small>
                </article>
                <article className="security-card">
                  <span>Logs</span>
                  <strong>Redacted diagnostics</strong>
                  <small>Support payloads are routed through loggingService redaction before export.</small>
                </article>
              </div>
              <div className="settings-status-card" aria-label="Active desktop sessions">
                <span>Active sessions</span>
                <strong>{activeSessions.length ? `${activeSessions.length} current session` : "Session metadata unavailable"}</strong>
                <small>{sessionManagementMessage ?? "Refresh active sessions to inspect safe desktop session metadata."}</small>
              </div>
              <div className="session-list" aria-label="Active sessions list">
                {activeSessions.map((session) => (
                  <article key={session.id} className="session-card">
                    <div>
                      <strong>{session.deviceLabel}</strong>
                      <small>{session.email ?? session.displayName ?? "Current Picom account"}</small>
                    </div>
                    <span className={`session-status ${session.status}`}>{session.current ? "Current" : session.status}</span>
                    <small>Provider: {session.provider}. Last checked: {dateTimeService.formatFullTimestamp(session.lastUsedAt)}.</small>
                    {session.expiresAt ? <small>Expires: {dateTimeService.formatFullTimestamp(session.expiresAt)}.</small> : <small>Mock/local sessions do not expose an expiry.</small>}
                  </article>
                ))}
              </div>
              <div className="settings-actions-row">
                <button onClick={() => pushToast("Security settings placeholder reviewed.", "info")}>Review placeholder</button>
                <button onClick={() => pushToast("Password reset is available from the login screen placeholder.", "info")}>Password reset placeholder</button>
                <button onClick={requestEmailVerification}>Resend verification placeholder</button>
                <button onClick={refreshActiveSessions}>Refresh sessions</button>
                <button onClick={revokeOtherSessions}>Revoke other sessions placeholder</button>
                <button onClick={prepareTwoFactorPlaceholder}>Enable 2FA placeholder</button>
                <button onClick={disableTwoFactorPlaceholder}>Disable 2FA placeholder</button>
                <button onClick={regenerateRecoveryCodesPlaceholder}>Recovery codes placeholder</button>
              </div>
              <div className="settings-status-card" aria-label="User data export placeholder">
                <span>Data export</span>
                <strong>{dataExportStatus.status === "ready_placeholder" ? "Ready placeholder" : "Not requested"}</strong>
                <small>{dataExportStatus.message}</small>
              </div>
              <div className="settings-actions-row">
                <button onClick={requestDataExportPlaceholder}>Request data export placeholder</button>
                <button onClick={downloadDataExportPlaceholder}>Download export JSON placeholder</button>
              </div>
              <div className="danger-zone-card" aria-label="Account deletion danger zone">
                <span>Danger Zone</span>
                <strong>Delete account request placeholder</strong>
                <small>{accountDeletionStatus.message} Community ownership transfer and data retention review must happen before any real deletion.</small>
                <label>
                  <small>Type <b>{accountDeletionConfirmationText}</b> to request account deletion placeholder.</small>
                  <input value={accountDeletionConfirmText} onChange={(event) => setAccountDeletionConfirmText(event.target.value)} placeholder={accountDeletionConfirmationText} />
                </label>
                <div className="settings-actions-row">
                  <button disabled={accountDeletionConfirmText.trim() !== accountDeletionConfirmationText} onClick={requestAccountDeletionPlaceholder}>Request deletion placeholder</button>
                  <button onClick={cancelAccountDeletionPlaceholder}>Cancel deletion placeholder</button>
                </div>
              </div>
            </div>
          ) : active === "Profile" ? (
            <div className="placeholder-panel action-panel">
              <strong>Local profile editing</strong>
              <p>Changes apply to this desktop profile immediately. Supabase profile persistence is a future backend step.</p>
              <div className="settings-profile-form">
                <label>
                  <span>Display name</span>
                  <input value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} placeholder="Use mock profile name" />
                </label>
                <label>
                  <span>Status text</span>
                  <input value={profileDraft.statusText} onChange={(event) => setProfileDraft({ ...profileDraft, statusText: event.target.value })} placeholder="Use mock status text" />
                </label>
                <label>
                  <span>Bio</span>
                  <textarea value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} placeholder="Write a short desktop profile bio" rows={4} />
                </label>
              </div>
              <div className="settings-actions-row">
                <button onClick={saveProfileSettings}>Save profile locally</button>
                <button onClick={resetProfileSettings}>Reset local profile</button>
              </div>
            </div>
          ) : active === "Notifications" ? (
            <div className="placeholder-panel action-panel">
              <strong>Native notification foundation</strong>
              <p>Uses a safe browser/native fallback and never calls desktop APIs directly from React.</p>
              <div className="settings-status-card" aria-label="Notification runtime status">
                <span>Runtime support</span>
                <strong>{notificationStatus.supported ? "Available" : "Fallback only"}</strong>
                <small>Permission: {notificationStatus.permission}. Settings are saved locally for this desktop profile.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Enable desktop notifications</strong>
                  <small>Allow Picom to show native desktop notification placeholders.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.enabled} onChange={(event) => updateNotifications({ enabled: event.target.checked })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Mute notifications</strong>
                  <small>Keep notifications quiet while preserving inbox foundations later.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.muted} onChange={(event) => updateNotifications({ muted: event.target.checked })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Mentions only placeholder</strong>
                  <small>Future notification routing can use this preference.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.mentionsOnly} onChange={(event) => updateNotifications({ mentionsOnly: event.target.checked })} />
              </label>
              <button onClick={testNotification}>Send test notification</button>
            </div>
          ) : active === "Keyboard Shortcuts" ? (
            <div className="shortcut-list">
              {shortcutService.bindings.map((binding) => (
                <div key={binding.action}>
                  <strong>{binding.label}</strong>
                  <span>{binding.action}</span>
                </div>
              ))}
            </div>
          ) : active === "Advanced" ? (
            <div className="placeholder-panel action-panel">
              <strong>Desktop service placeholders</strong>
              <p>Tray, window controls, file handling and clipboard are routed through safe services.</p>
              <button onClick={() => { trayService.simulate("settings"); pushToast("Tray settings action simulated.", "info"); }}>Simulate tray settings</button>
              <div className="settings-status-card" aria-label="Native app menu foundation">
                <span>Native app menu</span>
                <strong>Hidden chrome, safe actions</strong>
                <small>The operating-system menu remains hidden for the custom Picom titlebar. Future menu entries route through menuService instead of direct Electron calls.</small>
              </div>
              <div className="settings-actions-row">
                <button onClick={() => menuService.triggerPlaceholderAction("open-command-palette")}>Simulate menu palette</button>
                <button onClick={() => menuService.triggerPlaceholderAction("export-diagnostics")}>Simulate menu diagnostics</button>
                <button onClick={openSystemStatus}>Open system status</button>
              </div>
              <div className="settings-status-card" aria-label="System status page placeholder">
                <span>System status</span>
                <strong>{statusPageService.isConfigured() ? statusPageService.getDisplayDomain() : "Not configured"}</strong>
                <small>Future production deployments can point `VITE_STATUS_PAGE_URL` to a public non-sensitive status page.</small>
              </div>
              <div className="settings-status-card" aria-label="Launch on startup placeholder">
                <span>Launch on startup</span>
                <strong>{startupSettings.launchOnStartup ? "Prepared locally" : "Disabled"}</strong>
                <small>Mode: {startupSettings.mode}. Native OS registration is intentionally deferred until packaging/signing is finalized.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Launch Picom on startup placeholder</strong>
                  <small>Saves the preference locally without creating OS startup entries yet.</small>
                </span>
                <input type="checkbox" checked={startupSettings.launchOnStartup} onChange={(event) => updateLaunchOnStartup(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Start minimized to tray placeholder</strong>
                  <small>Prepared for future tray startup behavior; currently stored as a local preference.</small>
                </span>
                <input type="checkbox" checked={startupSettings.startMinimizedToTray} onChange={(event) => updateStartMinimizedToTray(event.target.checked)} />
              </label>
              <div className="settings-status-card" aria-label="App lock placeholder">
                <span>App lock</span>
                <strong>Ctrl + Shift + L</strong>
                <small>Quick lock hides chat content without storing a password locally. Future Supabase re-auth can replace the placeholder unlock.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Lock app after inactivity placeholder</strong>
                  <small>Preference saved locally. Automatic idle locking is intentionally deferred until native idle detection is approved.</small>
                </span>
                <input type="checkbox" checked={appLockSettings.lockAfterInactivityEnabled} onChange={(event) => updateLockAfterInactivity(event.target.checked)} />
              </label>
              <div className="settings-status-card" aria-label="Beta feedback and logs placeholder">
                <span>Beta support</span>
                <strong>Feedback & logs placeholder</strong>
                <small>User-facing feedback stays separate from redacted developer diagnostics. No report is sent until a backend endpoint is added.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Issue type</strong>
                  <small>Used only in the local placeholder payload.</small>
                </span>
                <select value={feedbackIssueType} onChange={(event) => setFeedbackIssueType(event.target.value as FeedbackIssueType)}>
                  <option value="bug">Bug</option>
                  <option value="crash">Crash</option>
                  <option value="login">Login</option>
                  <option value="message">Message</option>
                  <option value="upload">Upload</option>
                  <option value="voice">Voice</option>
                  <option value="packaging">Packaging</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <input value={feedbackTitle} onChange={(event) => setFeedbackTitle(event.target.value)} placeholder="Short feedback title" aria-label="Feedback title" />
              <textarea value={feedbackDescription} onChange={(event) => setFeedbackDescription(event.target.value)} placeholder="Describe what happened. Do not include passwords, tokens, or secrets." aria-label="Feedback description" rows={3} />
              <label className="settings-toggle-row">
                <span>
                  <strong>Include diagnostics</strong>
                  <small>Includes app mode, release channel, runtime, and non-sensitive state.</small>
                </span>
                <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Include recent redacted logs</strong>
                  <small>Logs are redacted by loggingService before export.</small>
                </span>
                <input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)} />
              </label>
              <div className="settings-actions-row">
                <button onClick={submitFeedbackPlaceholder}>Save feedback placeholder</button>
                <button onClick={exportDiagnostics}>Export diagnostics JSON</button>
              </div>
              {showAdminOperationsPlaceholder ? <AdminOperationsPanel /> : null}
            </div>
          ) : (
            <div className="placeholder-panel">
              <strong>{active} placeholder</strong>
              <p>This MVP keeps the section ready without advanced roadmap work.</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

