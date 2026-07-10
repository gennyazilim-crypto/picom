import { useCallback, useEffect, useState } from "react";
import { notificationService } from "../services/notificationService";
import { feedbackService, type FeedbackIssueType } from "../services/feedbackService";
import { authService } from "../services/authService";
import { menuService } from "../services/menuService";
import { settingsService, type AccessibilitySettings, type NotificationSettings, type ProfileSettings } from "../services/settingsService";
import { statusPageService } from "../services/statusPageService";
import { sessionManagementService, type SessionDeviceSummary } from "../services/sessionManagementService";
import { twoFactorAuthService } from "../services/twoFactorAuthService";
import { accountDeletionService } from "../services/accountDeletionService";
import { dataExportService } from "../services/dataExportService";
import { appLockService } from "../services/appLockService";
import { shortcutService } from "../services/shortcutService";
import { startupService } from "../services/startupService";
import { trayService } from "../services/trayService";
import { updateService } from "../services/updateService";
import { dateTimeService } from "../services/dateTimeService";
import { cacheManagementService, type CacheSummary } from "../services/cacheManagementService";
import { userBlockingService, type BlockedUserRecord } from "../services/userBlockingService";
import { userSafetyCenterService, type UserSafetySettings } from "../services/userSafetyCenterService";
import { notificationDigestService } from "../services/notificationDigestService";
import { accountActivityService, type AccountActivityRecord } from "../services/accountActivityService";
import { appConfig } from "../config/appConfig";
import { legalConfig } from "../config/legalConfig";
import { AdminOperationsView } from "./AdminOperationsView";
import { adminOperationsService, type AdminOperationsAccess } from "../services/adminOperationsService";
import { analyticsService } from "../services/analyticsService";
import { crashReporterService } from "../services/crashReporterService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import { legalDocumentOrder, legalDocuments, type LegalDocumentId } from "../data/legalDocuments";
import { FeedbackSection } from "./settings/FeedbackSection";
import { DiagnosticsSection } from "./settings/DiagnosticsSection";
import { LogsViewer } from "./settings/LogsViewer";
import { DeveloperPortalView } from "./DeveloperPortalView";
import { featureFlagService } from "../services/featureFlagService";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";

function formatCacheSize(bytes: number | null): string {
  if (bytes === null) return "Not available";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

type SettingsModalProps = {
  theme: "light" | "dark";
  accessibilitySettings: AccessibilitySettings;
  profileSettings: ProfileSettings;
  onThemeChange: (theme: "light" | "dark") => void;
  onAccessibilitySettingsChange: (settings: AccessibilitySettings) => void;
  onProfileSettingsChange: (settings: ProfileSettings) => void;
  onClose: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  onAccountDeletionRequested: () => void;
  currentUsername: string;
  ownedCommunityCount: number;
  developerPortalContext: {
    communityId: string;
    communityName: string;
    ownerId: string;
    canManageBots: boolean;
    canManageWebhooks: boolean;
  };
};

export function SettingsModal({ theme, accessibilitySettings, profileSettings, onThemeChange, onAccessibilitySettingsChange, onProfileSettingsChange, onClose, pushToast, onAccountDeletionRequested, currentUsername, ownedCommunityCount, developerPortalContext }: SettingsModalProps) {
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
  const [updateState, setUpdateState] = useState(() => updateService.getState());
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);
  const [safetySettings, setSafetySettings] = useState<UserSafetySettings>(() => userSafetyCenterService.getSettings());
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>(() => userBlockingService.listBlockedUsers());
  const [accountActivities, setAccountActivities] = useState<AccountActivityRecord[]>(() => accountActivityService.listRecent());
  const [openLegalDocument, setOpenLegalDocument] = useState<LegalDocumentId | null>(null);
  const [adminOperationsAccess, setAdminOperationsAccess] = useState<AdminOperationsAccess>({ allowed: false, source: "none" });
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => analyticsService.isEnabled());
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(() => crashReporterService.getStatus().enabled);
  const [developerPortalOpen, setDeveloperPortalOpen] = useState(false);
  const developerPortalAvailable = featureFlagService.shouldShowEntryPoint("enableDeveloperPortal") && (developerPortalContext.canManageBots || developerPortalContext.canManageWebhooks);
  const sections = ["Account", "Profile", "Privacy & Safety", "Appearance", "Notifications", "Voice & Video", "Keyboard Shortcuts", "Diagnostics", "Legal", "Advanced"];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setProfileDraft(profileSettings);
  }, [profileSettings]);

  useEffect(() => updateService.onStateChange(setUpdateState), []);
  useEffect(() => { let active = true; void adminOperationsService.getAccess().then((access) => { if (active) setAdminOperationsAccess(access); }); return () => { active = false; }; }, []);

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
      setAccountActivities(accountActivityService.listRecent());
    }
  }, [active, refreshActiveSessions]);

  const refreshCacheSummary = useCallback(async () => {
    setCacheSummary(await cacheManagementService.getCacheSummary());
  }, []);

  useEffect(() => {
    if (active === "Advanced") {
      void refreshCacheSummary();
    }
  }, [active, refreshCacheSummary]);

  useEffect(() => {
    if (active === "Privacy & Safety") {
      setBlockedUsers(userBlockingService.listBlockedUsers());
      setSafetySettings(userSafetyCenterService.getSettings());
    }
  }, [active]);

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
  const updateAccessibility = (partial: Partial<AccessibilitySettings>) => {
    const next = settingsService.updateAccessibilitySettings(partial).accessibilitySettings;
    onAccessibilitySettingsChange(next);
    pushToast("Accessibility setting saved locally.", "success");
  };
  const updateSafetySettings = (partial: Partial<UserSafetySettings>) => {
    const next = userSafetyCenterService.updateSettings(partial);
    setSafetySettings(next);
    pushToast("Privacy & Safety setting saved locally.", "success");
  };
  const unblockUser = (userId: string, displayName: string) => {
    userBlockingService.unblockUser(userId);
    setBlockedUsers(userBlockingService.listBlockedUsers());
    pushToast(`${displayName} unblocked locally.`, "success");
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
  const copyFeedbackReport = async () => {
    const result = await feedbackService.copyReport(createFeedbackDraft());
    pushToast(result.ok ? "Redacted feedback report copied. No report was sent." : result.reason, result.ok ? "success" : "error");
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
  const checkForUpdatesPlaceholder = async () => {
    const next = await updateService.checkForUpdatesPlaceholder();
    setUpdateState(next);
    pushToast(next.message, next.status === "download_failed" || next.status === "install_failed" ? "error" : "info");
  };
  const simulateUpdateFailure = (kind: "download" | "install" | "error") => {
    const next = kind === "download"
      ? updateService.setDownloadFailedPlaceholder()
      : kind === "install"
        ? updateService.setInstallFailedPlaceholder()
        : updateService.setErrorPlaceholder();
    setUpdateState(next);
    pushToast(next.message, next.status === "download_failed" || next.status === "install_failed" ? "error" : "info");
  };
  const runCacheAction = async (action: () => Promise<{ message: string; summary: CacheSummary }>) => {
    const result = await action();
    setCacheSummary(result.summary);
    pushToast(result.message, "success");
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
  const accountDeletionConfirmationText = currentUsername;
  const requestAccountDeletion = async () => {
    const result = await accountDeletionService.requestDeletion({ confirmationText: accountDeletionConfirmText, expectedUsername: accountDeletionConfirmationText, ownedCommunityCount });
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    pushToast(result.data.message, "success");
    onAccountDeletionRequested();
  };
  const cancelAccountDeletion = async () => {
    const result = await accountDeletionService.cancelDeletion();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    pushToast("Account deletion request canceled.", "info");
  };
  const requestDataExportPlaceholder = async () => {
    const result = await dataExportService.requestExport(profileDraft);
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setDataExportStatus(result.data);
    pushToast(result.data.message, "success");
  };
  const downloadDataExportPlaceholder = () => {
    const result = dataExportService.downloadExportJson();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    pushToast(`Data export downloaded: ${result.data.fileName}.`, "success");
  };

  return (
    <>
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
            <div className="appearance-settings-stack">
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
              <div className="accessibility-card" aria-label="Accessibility display options">
                <strong>Accessibility display options</strong>
                <p>Local desktop preferences for contrast, motion, text scale, and focus visibility.</p>
                <label className="settings-toggle-row">
                  <span>
                    <strong>High contrast mode</strong>
                    <small>Strengthens text, borders, and focus rings using Picom design tokens.</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.highContrast} onChange={(event) => updateAccessibility({ highContrast: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>Reduced motion</strong>
                    <small>Reduces non-essential transitions, animations, and smooth scrolling.</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.reducedMotion} onChange={(event) => updateAccessibility({ reducedMotion: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>Larger text placeholder</strong>
                    <small>Gently increases base desktop text scale without changing layout.</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.largerText} onChange={(event) => updateAccessibility({ largerText: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>Strong focus ring placeholder</strong>
                    <small>Makes keyboard focus indicators more visible.</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.focusRingStrong} onChange={(event) => updateAccessibility({ focusRingStrong: event.target.checked })} />
                </label>
              </div>
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
              <div className="settings-status-card" aria-label="Account Activity section">
                <span>Account Activity</span>
                <strong>{accountActivities.length ? `${accountActivities.length} recent events` : "No recent activity"}</strong>
                <small>Security history is local placeholder data. Raw IP addresses, passwords, tokens, cookies, and auth headers are not stored.</small>
              </div>
              <div className="session-list" aria-label="Account activity history">
                {accountActivities.length ? accountActivities.map((activity) => (
                  <article key={activity.id} className="session-card">
                    <div>
                      <strong>{accountActivityService.getActivityTitle(activity.type)}</strong>
                      <small>{activity.device} · {activity.locationPlaceholder}</small>
                    </div>
                    <span className="session-status active">{activity.platform}</span>
                    <small>{dateTimeService.formatFullTimestamp(activity.timestamp)}</small>
                  </article>
                )) : (
                  <article className="session-card">
                    <div>
                      <strong>No account activity yet</strong>
                      <small>Sign in, log out, or update security settings to create local activity records.</small>
                    </div>
                  </article>
                )}
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
              <div className="settings-status-card" aria-label="User data export">
                <span>Data export</span>
                <strong>{dataExportStatus.status === "ready" ? "Export ready" : dataExportStatus.status === "processing" ? "Generating export" : dataExportStatus.status === "failed" ? "Export failed" : "Not requested"}</strong>
                <small>{dataExportStatus.message}</small>
              </div>
              <div className="settings-actions-row">
                <button onClick={() => void requestDataExportPlaceholder()}>Request data export</button>
                <button disabled={!dataExportStatus.canDownload} onClick={downloadDataExportPlaceholder}>Download JSON export</button>
              </div>
              <div className="danger-zone-card" aria-label="Account deletion danger zone">
                <span>Danger Zone</span>
                <strong>Request account deletion</strong>
                <small>{accountDeletionStatus.message} {ownedCommunityCount ? `You own ${ownedCommunityCount} communit${ownedCommunityCount === 1 ? "y" : "ies"}; transfer ownership first.` : "The request revokes sessions and starts a 14-day review period. It never hard-deletes immediately."}</small>
                <label>
                  <small>Type username <b>{accountDeletionConfirmationText}</b> to confirm the request.</small>
                  <input value={accountDeletionConfirmText} onChange={(event) => setAccountDeletionConfirmText(event.target.value)} placeholder={accountDeletionConfirmationText} />
                </label>
                <div className="settings-actions-row">
                  <button disabled={accountDeletionConfirmText.trim().toLowerCase() !== accountDeletionConfirmationText.toLowerCase() || ownedCommunityCount > 0 || accountDeletionStatus.requested} onClick={() => void requestAccountDeletion()}>Request deletion and sign out</button>
                  <button disabled={!accountDeletionStatus.requested} onClick={() => void cancelAccountDeletion()}>Cancel request</button>
                </div>
              </div>
            </div>
          ) : active === "Privacy & Safety" ? (
            <div className="placeholder-panel action-panel">
              <strong>User Safety Center</strong>
              <p>Central desktop controls for blocking, privacy, data requests, and safety guidance. Supabase/RLS remains the source of truth for production enforcement.</p>
              <div className="settings-status-card" aria-label="Safety summary">
                <span>Safety summary</span>
                <strong>{userSafetyCenterService.getPrivacySummary(blockedUsers.length)}</strong>
                <small>These preferences are local placeholders and never store passwords, tokens, or private message content.</small>
              </div>
              <div className="security-card-grid">
                <article className="security-card">
                  <span>Blocked users</span>
                  <strong>{blockedUsers.length}</strong>
                  <small>Community messages are collapsed and direct messages are disabled for blocked users.</small>
                </article>
                <article className="security-card">
                  <span>Online status</span>
                  <strong>{safetySettings.showOnlineStatus ? "Visible" : "Hidden placeholder"}</strong>
                  <small>Presence visibility is local for now and must be enforced server-side later.</small>
                </article>
                <article className="security-card">
                  <span>Read receipts</span>
                  <strong>{safetySettings.enableReadReceipts ? "Enabled placeholder" : "Disabled"}</strong>
                  <small>Read receipts remain opt-in and should not expose detailed reads in large communities.</small>
                </article>
                <article className="security-card">
                  <span>Account data</span>
                  <strong>{dataExportStatus.status === "ready" ? "Export ready" : dataExportStatus.status === "processing" ? "Export processing" : "Export not requested"}</strong>
                  <small>{accountDeletionStatus.requested ? "Deletion request recorded; sign in again to cancel during the review period." : "No deletion request active."}</small>
                </article>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Who can message me</strong>
                  <small>Controls who may start a private conversation. Backend RLS remains authoritative.</small>
                </span>
                <select value={safetySettings.whoCanDmMe} onChange={(event) => updateSafetySettings({ whoCanDmMe: event.target.value as UserSafetySettings["whoCanDmMe"] })}>
                  <option value="everyone">Everyone</option>
                  <option value="community_members">Community members</option>
                  <option value="friends_only">Friends only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Who can send friend requests</strong>
                  <small>Controls incoming friend requests while preserving existing community access.</small>
                </span>
                <select value={safetySettings.whoCanSendFriendRequests} onChange={(event) => updateSafetySettings({ whoCanSendFriendRequests: event.target.value as UserSafetySettings["whoCanSendFriendRequests"] })}>
                  <option value="everyone">Everyone</option>
                  <option value="community_members">Community members</option>
                  <option value="friends_of_friends_placeholder">Friends of friends</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Show online status</strong>
                  <small>Controls the local placeholder preference for presence visibility.</small>
                </span>
                <input type="checkbox" checked={safetySettings.showOnlineStatus} onChange={(event) => updateSafetySettings({ showOnlineStatus: event.target.checked })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Read receipts placeholder</strong>
                  <small>Future read receipts should respect this privacy setting by default.</small>
                </span>
                <input type="checkbox" checked={safetySettings.enableReadReceipts} onChange={(event) => updateSafetySettings({ enableReadReceipts: event.target.checked })} />
              </label>
              <label className="settings-toggle-row"><span><strong>Share anonymous usage diagnostics</strong><small>Off by default. Records feature counts and app health locally; never message content, passwords, tokens, channel names, or attachment contents.</small></span><input type="checkbox" checked={analyticsEnabled} onChange={(event) => { const enabled = analyticsService.setEnabled(event.target.checked); setAnalyticsEnabled(enabled); pushToast(enabled ? "Anonymous diagnostics enabled locally." : "Anonymous diagnostics disabled and local queue cleared.", "success"); }} /></label>
              <div className="settings-status-card" aria-label="Blocked users list">
                <span>Blocked users</span>
                <strong>{blockedUsers.length ? "Manage locally" : "No blocked users"}</strong>
                <small>Blocked users are enforced locally and synchronized through Supabase RLS when connected.</small>
                <div className="session-list">
                  {blockedUsers.length ? blockedUsers.map((blockedUser) => (
                    <article key={blockedUser.userId} className="session-card">
                      <div>
                        <strong>{blockedUser.displayName}</strong>
                        <small>@{blockedUser.username} blocked {dateTimeService.formatMessageTime(blockedUser.blockedAt)}</small>
                      </div>
                      <button onClick={() => unblockUser(blockedUser.userId, blockedUser.displayName)}>Unblock</button>
                    </article>
                  )) : (
                    <article className="session-card">
                      <div>
                        <strong>Your block list is clear</strong>
                        <small>Use member/profile actions to block someone locally.</small>
                      </div>
                    </article>
                  )}
                </div>
              </div>
              <div className="settings-status-card" aria-label="Safety tips">
                <span>Safety tips</span>
                <strong>Stay in control</strong>
                <small>Do not share passwords, tokens, recovery codes, or private invite links. Report suspicious behavior from message/member context actions.</small>
              </div>
              <div className="settings-actions-row">
                <button onClick={requestDataExportPlaceholder}>Request data export</button>
                <button onClick={() => { setActive("Account"); pushToast(accountDeletionStatus.message, accountDeletionStatus.requested ? "info" : "success"); }}>Review account deletion</button>
                <button onClick={() => { setActive("Advanced"); pushToast("Open Beta support to report a problem.", "info"); }}>Report a problem</button>
                <button onClick={() => updateSafetySettings(userSafetyCenterService.resetSettings())}>Reset safety settings</button>
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
              <label className="settings-toggle-row">
                <span>
                  <strong>Notification digest placeholder</strong>
                  <small>{notificationDigestService.getDigestModeLabel(notificationSettings.digestMode)} groups lower-priority message notifications later.</small>
                </span>
                <select value={notificationSettings.digestMode} onChange={(event) => updateNotifications({ digestMode: event.target.value as typeof notificationSettings.digestMode })}>
                  <option value="off">Off</option>
                  <option value="hourly_placeholder">Hourly placeholder</option>
                  <option value="daily_placeholder">Daily placeholder</option>
                </select>
              </label>
              <div className="settings-status-card" aria-label="Quiet Hours notification setting">
                <span>Quiet Hours</span>
                <strong>{notificationSettings.quietHours.enabled ? `${notificationSettings.quietHours.startTime} - ${notificationSettings.quietHours.endTime}` : "Disabled"}</strong>
                <small>Uses your system timezone. Notification inbox can still record suppressed notifications later.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Enable Quiet Hours</strong>
                  <small>Silence notification interruptions during scheduled hours.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, enabled: event.target.checked } })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Start time</strong>
                  <small>Local desktop time when Quiet Hours begin.</small>
                </span>
                <input type="time" value={notificationSettings.quietHours.startTime} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, startTime: event.target.value } })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>End time</strong>
                  <small>Local desktop time when Quiet Hours end.</small>
                </span>
                <input type="time" value={notificationSettings.quietHours.endTime} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, endTime: event.target.value } })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Apply to</strong>
                  <small>Choose whether Quiet Hours suppress all notifications, normal messages, or sounds only.</small>
                </span>
                <select value={notificationSettings.quietHours.applyTo} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, applyTo: event.target.value as typeof notificationSettings.quietHours.applyTo } })}>
                  <option value="all_notifications">All notifications</option>
                  <option value="normal_messages_only">Normal messages only</option>
                  <option value="sounds_only_placeholder">Sounds only placeholder</option>
                </select>
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Allow mentions during Quiet Hours</strong>
                  <small>Mentions can still notify if this placeholder remains enabled.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.quietHours.allowMentions} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, allowMentions: event.target.checked } })} />
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
          ) : active === "Diagnostics" ? (
            <div className="settings-diagnostics-stack">
              <FeedbackSection onNotice={pushToast} />
              <DiagnosticsSection onNotice={pushToast} />
              <LogsViewer onNotice={pushToast} />
            </div>
          ) : active === "Legal" ? (
            <div className="legal-settings-panel">
              <div className="settings-status-card"><span>Legal version {legalConfig.currentVersion}</span><strong>Professional review required</strong><small>Terms and privacy links below match the version recorded during registration or re-acceptance. These drafts are not final legal advice.</small></div>
              {legalDocumentOrder.map((documentId) => <button type="button" key={documentId} onClick={() => setOpenLegalDocument(documentId)}><span><strong>{legalDocuments[documentId].title}</strong><small>{legalDocuments[documentId].updatedLabel}</small></span><AppIcon name="chevronRight" size="sm" /></button>)}
              <small>Picom {appConfig.version} · {appConfig.releaseChannel} channel</small>
            </div>
          ) : active === "Advanced" ? (
            <div className="placeholder-panel action-panel">
              <strong>Desktop service placeholders</strong>
              <p>Tray, window controls, file handling and clipboard are routed through safe services.</p>
              {developerPortalAvailable ? <div className="settings-status-card" aria-label="Developer Portal v1"><span>Developer Portal</span><strong>Restricted development foundation</strong><small>Manage safe bot/webhook metadata and review API placeholders. No raw keys or public publishing.</small><button type="button" onClick={() => setDeveloperPortalOpen(true)}>Open Developer Portal</button></div> : null}
              <div className="settings-status-card" aria-label="About Picom build metadata">
                <span>About Picom</span>
                <strong>{appConfig.name} {appConfig.version} ({appConfig.releaseChannel})</strong>
                <small>Build: {appConfig.build.date}. Commit: {appConfig.build.commitShort}. Runtime: {appConfig.build.desktopRuntime}. API compatibility: {appConfig.build.backendApiCompatibilityVersion}.</small>
              </div>
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
              <div className="settings-status-card" aria-label="Desktop update recovery placeholder">
                <span>Desktop updates</span>
                <strong>{updateState.status.split("_").join(" ")}</strong>
                <small>{updateState.message}</small>
                <small>Version {updateState.appVersion} on {updateState.releaseChannel}. Production auto-update remains disabled until a signed endpoint is configured.</small>
                {updateState.progress !== null ? <small>Simulation progress: {updateState.progress}%</small> : null}
              </div>
              <label className="settings-toggle-row"><span><strong>Enable diagnostic reports</strong><small>Off by default. Stores a bounded redacted local crash envelope; no provider or DSN is configured.</small></span><input type="checkbox" checked={crashReportingEnabled} onChange={(event) => { const enabled = crashReporterService.setEnabled(event.target.checked); setCrashReportingEnabled(enabled); pushToast(enabled ? "Diagnostic reports enabled locally." : "Diagnostic reports disabled and local queue cleared.", "success"); }} /></label>
              {import.meta.env.DEV ? <div className="settings-actions-row"><button onClick={() => { const record = crashReporterService.captureException(new Error("Picom development crash report test"), { source: "settings-test", authorization: "Bearer redaction-test" }); pushToast(record ? "Redacted test error captured locally." : "Enable diagnostic reports before capturing a test error.", record ? "success" : "info"); }}>Capture test error safely</button><button onClick={() => { const status = crashReporterService.getStatus(); pushToast(`${status.queuedLocalRecords} redacted crash records queued locally.`, "info"); }}>Show crash report status</button></div> : null}
              <div className="settings-actions-row">
                <button onClick={() => void checkForUpdatesPlaceholder()}>Check for updates</button>
                <button onClick={() => setUpdateState(updateService.setAvailablePlaceholder())}>Simulate available</button>
                <button onClick={() => setUpdateState(updateService.startDownloadPlaceholder())}>Simulate download</button>
                <button onClick={() => setUpdateState(updateService.setReadyToInstallPlaceholder())}>Simulate ready</button>
                <button onClick={() => simulateUpdateFailure("download")}>Simulate download failure</button>
                <button onClick={() => simulateUpdateFailure("install")}>Simulate install failure</button>
                <button onClick={() => simulateUpdateFailure("error")}>Simulate error</button>
                <button onClick={() => setUpdateState(updateService.retry())}>Retry</button>
                <button onClick={() => setUpdateState(updateService.clearError())}>Clear error</button>
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
              <div className="settings-status-card" aria-label="Cache management foundation">
                <span>Cache management</span>
                <strong>{cacheSummary ? `${cacheSummary.imageCacheEntries}/${cacheSummary.imageCacheMaxEntries} image cache entries` : "Loading cache summary"}</strong>
                <small>
                  Storage estimate: {formatCacheSize(cacheSummary?.estimatedUsageBytes ?? null)}
                  {cacheSummary?.estimatedQuotaBytes ? ` of ${formatCacheSize(cacheSummary.estimatedQuotaBytes)}` : ""}.
                  Auth sessions and drafts are preserved.
                </small>
              </div>
              <div className="security-card-grid" aria-label="Cache summary cards">
                <article className="security-card">
                  <span>Images</span>
                  <strong>{cacheSummary?.imageCacheEntries ?? 0}</strong>
                  <small>Metadata-only cache entries. Browser image bytes remain Chromium-managed.</small>
                </article>
                <article className="security-card">
                  <span>Logs</span>
                  <strong>{cacheSummary?.recentLogEntries ?? 0}</strong>
                  <small>Recent redacted in-memory log entries.</small>
                </article>
                <article className="security-card">
                  <span>Messages</span>
                  <strong>{cacheSummary?.messageCacheStatus.replace(/_/g, " ") ?? "placeholder"}</strong>
                  <small>Message cache clearing is prepared without deleting drafts.</small>
                </article>
                <article className="security-card">
                  <span>Offline data</span>
                  <strong>{cacheSummary?.offlineDataStatus.replace(/_/g, " ") ?? "placeholder"}</strong>
                  <small>No offline action queue is cleared in this MVP placeholder.</small>
                </article>
              </div>
              <div className="settings-actions-row">
                <button onClick={refreshCacheSummary}>Refresh cache summary</button>
                <button onClick={() => void runCacheAction(() => cacheManagementService.clearImageCache())}>Clear image cache placeholder</button>
                <button onClick={() => void runCacheAction(() => cacheManagementService.clearMessageCache())}>Clear message cache placeholder</button>
                <button onClick={() => void runCacheAction(() => cacheManagementService.clearLogs())}>Clear logs</button>
                <button onClick={() => void runCacheAction(() => cacheManagementService.clearAllNonEssentialCache())}>Clear all non-essential cache</button>
              </div>
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
                <button onClick={() => void copyFeedbackReport()}>Copy feedback report</button>
                <button onClick={exportDiagnostics}>Export diagnostics JSON</button>
              </div>
              <AdminOperationsView access={adminOperationsAccess} />
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
    {openLegalDocument ? <LegalDocumentModal documentId={openLegalDocument} onClose={() => setOpenLegalDocument(null)} /> : null}
    {developerPortalOpen && developerPortalAvailable ? <DeveloperPortalView {...developerPortalContext} onClose={() => setDeveloperPortalOpen(false)} onNotice={pushToast} /> : null}
    </>
  );
}

