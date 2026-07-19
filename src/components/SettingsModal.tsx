import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SettingsModal.css";
import { notificationService } from "../services/notificationService";
import { notificationPolicyStateService, type NotificationPolicyState } from "../services/notificationPolicyStateService";
import type { Community } from "../types/community";
import { feedbackService, type FeedbackIssueType } from "../services/feedbackService";
import { authService } from "../services/authService";
import { menuService } from "../services/menuService";
import { settingsSections, settingsService, type AccessibilitySettings, type AppearanceSettings, type NotificationSettings, type ProfileSettings, type SettingsSection } from "../services/settingsService";
import { appearanceService } from "../services/appearanceService";
import { localizationService, type LocalizationKey } from "../services/localizationService";
import { statusPageService } from "../services/statusPageService";
import { dataSourceService } from "../services/dataSourceService";
import { maintenanceStatusService, type MaintenanceStatusSnapshot } from "../services/maintenanceStatusService";
import { sessionManagementService, type SessionDeviceSummary } from "../services/sessionManagementService";
import { socialAuthService, SOCIAL_AUTH_PROVIDER_ORDER, getSocialAuthProviderLabel, type SocialAuthProvider, type SocialProviderAccountState } from "../services/auth/socialAuthService";
import { accountDeletionService } from "../services/accountDeletionService";
import { dataExportService } from "../services/dataExportService";
import { appLockService } from "../services/appLockService";
import { startupService } from "../services/startupService";
import { trayService } from "../services/trayService";
import { updateService } from "../services/updateService";
import { dateTimeService } from "../services/dateTimeService";
import { cacheManagementService, type CacheSummary } from "../services/cacheManagementService";
import { safeModeService } from "../services/safeModeService";
import { localDataMigrationService } from "../services/localDataMigrationService";
import { feedUiStateService } from "../services/feed/feedUiStateService";
import { communityNavigationService } from "../services/community/communityNavigationService";
import { userBlockingService, type BlockedUserRecord } from "../services/userBlockingService";
import { userSafetyCenterService, type UserSafetySettings } from "../services/userSafetyCenterService";
import { profilePrivacyService } from "../services/profilePrivacyService";
import { directSafetyService } from "../services/directMessages/directSafetyService";
import type { DirectMessagePrivacy } from "../types/directMessageSafety";
import { profileService } from "../services/profileService";
import type { ProfileSummary } from "../services/profileService";
import { globalPresenceService } from "../services/presence/globalPresenceService";
import { activityPresenceService, type ActivitySnapshot } from "../services/presence/activityPresenceService";
import { ProfileVerificationRequestCard } from "./VerificationRequestPanel";
import { ProfileMediaEditor } from "./settings/ProfileMediaEditor";
import { EmailPreferencesPanel } from "./settings/EmailPreferencesPanel";
import { voiceService, type VoiceServiceSnapshot } from "../services/voiceService";
import { VoiceDeviceSelection } from "./settings/VoiceDeviceSelection";
import type { ProfilePrivacySettings } from "../types/profilePrivacy";
import { notificationDigestService } from "../services/notificationDigestService";
import { accountActivityService, type AccountActivityRecord } from "../services/accountActivityService";
import { appConfig } from "../config/appConfig";
import { legalConfig } from "../config/legalConfig";
import { AdminOperationsPanelRedirect } from "./AdminOperationsPanelRedirect";
import { canAccessAdminOperationsView } from "./AdminOperationsView";
import { adminOperationsService, type AdminOperationsAccess } from "../services/adminOperationsService";
import { analyticsService } from "../services/analyticsService";
import { crashReporterService } from "../services/crashReporterService";
import { AppIcon } from "./AppIcon";
import { KeyboardShortcutsSection } from "./KeyboardShortcutsSection";
import { mvpUiIconMap } from "./iconRegistry";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import { legalDocumentOrder, legalDocuments, type LegalDocumentId } from "../data/legalDocuments";
import { FeedbackSection } from "./settings/FeedbackSection";
import { DiagnosticsSection } from "./settings/DiagnosticsSection";
import { LogsViewer } from "./settings/LogsViewer";
import { DeveloperPortalView } from "./DeveloperPortalView";
import { featureFlagService } from "../services/featureFlagService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";
type NotificationPreferenceKey = "mentions" | "replies" | "reactions" | "directMessages" | "communityAnnouncements" | "friendRequests" | "friendAcceptances" | "radioLive" | "radioReminders" | "podcastReleases" | "eventReminders";
const notificationPreferenceRows: ReadonlyArray<Readonly<{ key: NotificationPreferenceKey; label: string; description: string }>> = [
  { key: "mentions", label: "Mentions", description: "Notify when someone mentions you in a visible community channel." },
  { key: "replies", label: "Replies", description: "Notify when someone replies to one of your messages." },
  { key: "reactions", label: "Reactions", description: "Notify when people react to your messages." },
  { key: "directMessages", label: "Direct messages", description: "Notify for private messages when that conversation is not already visible." },
  { key: "communityAnnouncements", label: "Community announcements", description: "Notify for official announcements in communities you can access." },
  { key: "friendRequests", label: "Friend requests", description: "Notify when someone sends you a friend request." },
  { key: "friendAcceptances", label: "Friend request acceptances", description: "Notify when someone accepts a friend request you sent." },
  { key: "radioLive", label: "Radio live alerts", description: "Notify when a followed or reminded Radio show goes live." },
  { key: "radioReminders", label: "Radio reminders", description: "Notify for saved Radio schedule reminders and changes." },
  { key: "podcastReleases", label: "Podcast releases", description: "Notify for new releases from followed Podcast communities." },
  { key: "eventReminders", label: "Event reminders", description: "Notify before events you marked Going or Interested." },
];

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
  appearanceSettings: AppearanceSettings;
  profileSettings: ProfileSettings;
  communities: Community[];
  onThemeChange: (theme: "light" | "dark") => void;
  onAccessibilitySettingsChange: (settings: AccessibilitySettings) => void;
  onAppearanceSettingsChange: (settings: AppearanceSettings) => void;
  onProfileSettingsChange: (settings: ProfileSettings) => void;
  onClose: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  onAccountDeletionRequested: () => void;
  onLogout: () => Promise<void> | void;
  currentUsername: string;
  currentEmail?: string | null;
  ownedCommunityCount: number;
  currentEmailVerifiedAt?: string | null;
  requireEmailVerification?: boolean;
  developerPortalContext: {
    communityId: string;
    communityName: string;
    ownerId: string;
    canManageBots: boolean;
    canManageWebhooks: boolean;
  };
  onOpenPanel?: () => void;
};

export function SettingsModal({ theme, accessibilitySettings, appearanceSettings, profileSettings, communities, onThemeChange, onAccessibilitySettingsChange, onAppearanceSettingsChange, onProfileSettingsChange, onClose, pushToast, onAccountDeletionRequested, onLogout, currentUsername, currentEmail, ownedCommunityCount, currentEmailVerifiedAt, requireEmailVerification = false, developerPortalContext, onOpenPanel }: SettingsModalProps) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  const [active, setActive] = useState<SettingsSection>(settingsService.consumeInitialSection);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(() => ({ ...profileSettings, username: profileSettings.username || currentUsername }));
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileHydrating, setProfileHydrating] = useState(false);
  const profileMediaGenerationRef = useRef(0);
  const [feedbackIssueType, setFeedbackIssueType] = useState<FeedbackIssueType>("bug");
  const [feedbackTitle, setFeedbackTitle] = useState("Picom beta feedback");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [emailVerificationMessage, setEmailVerificationMessage] = useState<string | null>(null);
  const [liveEmail, setLiveEmail] = useState<string | undefined>(currentEmail ?? undefined);
  const [liveEmailVerifiedAt, setLiveEmailVerifiedAt] = useState<string | null | undefined>(currentEmailVerifiedAt);
  const [identityRefreshing, setIdentityRefreshing] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionDeviceSummary[]>([]);
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false);
  const [sessionManagementMessage, setSessionManagementMessage] = useState<string | null>(null);
  const passwordSectionRef = useRef<HTMLElement | null>(null);
  const sessionsSectionRef = useRef<HTMLElement | null>(null);
  const [socialProviders, setSocialProviders] = useState<SocialProviderAccountState[]>(() => SOCIAL_AUTH_PROVIDER_ORDER.map((provider) => { const availability = socialAuthService.getProviderAvailability(provider); return { provider, label: getSocialAuthProviderLabel(provider), available: availability.enabled, linked: false, reason: availability.reason }; }));
  const [socialProviderBusy, setSocialProviderBusy] = useState<SocialAuthProvider | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false);
  const [sessionRevokeConfirmationOpen, setSessionRevokeConfirmationOpen] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [accountDeletionStatus, setAccountDeletionStatus] = useState(() => accountDeletionService.getStatus());
  const [accountDeletionConfirmText, setAccountDeletionConfirmText] = useState("");
  const [accountDeletionPassword, setAccountDeletionPassword] = useState("");
  const [accountDeletionBusy, setAccountDeletionBusy] = useState(false);
  const [dataExportStatus, setDataExportStatus] = useState(() => dataExportService.getStatus());
  const [appLockSettings, setAppLockSettings] = useState(() => appLockService.getSettings());
  const [startupSettings, setStartupSettings] = useState(() => startupService.getState());
  const [closeToTrayEnabled, setCloseToTrayEnabled] = useState(() => trayService.getCloseToTrayEnabled());
  const [updateState, setUpdateState] = useState(() => updateService.getState());
  const [autoActivityEnabled, setAutoActivityEnabled] = useState(() => activityPresenceService.getEnabled());
  const [activitySnapshot, setActivitySnapshot] = useState<ActivitySnapshot>(() => activityPresenceService.getSnapshot());
  const activityBridgeAvailable = activityPresenceService.isAvailable();
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);
  const [safetySettings, setSafetySettings] = useState<UserSafetySettings>(() => userSafetyCenterService.getSettings());
  const [profilePrivacy,setProfilePrivacy]=useState<ProfilePrivacySettings>(()=>profilePrivacyService.getLocalSettings());
  const [directMessagePrivacy, setDirectMessagePrivacy] = useState<DirectMessagePrivacy>(() => directSafetyService.getLocalPrivacy());
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>(() => userBlockingService.listBlockedUsers());
  const [profileSaving, setProfileSaving] = useState(false);
  const [voiceSettingsSnapshot, setVoiceSettingsSnapshot] = useState<VoiceServiceSnapshot>(() => voiceService.getSnapshot());
  const [notificationPolicyState, setNotificationPolicyState] = useState<NotificationPolicyState>(() => notificationPolicyStateService.getSnapshot());
  const [accountActivities, setAccountActivities] = useState<AccountActivityRecord[]>(() => accountActivityService.listRecent());
  const [openLegalDocument, setOpenLegalDocument] = useState<LegalDocumentId | null>(null);
  const [adminOperationsAccess, setAdminOperationsAccess] = useState<AdminOperationsAccess>({ allowed: false, source: "none" });
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => analyticsService.isEnabled());
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(() => crashReporterService.getStatus().enabled);
  const [developerPortalOpen, setDeveloperPortalOpen] = useState(false);
  const developerPortalAvailable = featureFlagService.shouldShowEntryPoint("enableDeveloperPortal") && (developerPortalContext.canManageBots || developerPortalContext.canManageWebhooks);
  const adminOperationsVisible = canAccessAdminOperationsView(adminOperationsAccess);
  const visibleSections = useMemo(
    () => settingsSections.filter((section) => section !== "Admin Operations" || adminOperationsVisible),
    [adminOperationsVisible],
  );

  useEffect(() => {
    if (!profileHydrated) {
      setProfileDraft({ ...profileSettings, username: profileSettings.username || currentUsername });
    }
  }, [currentUsername, profileHydrated, profileSettings]);

  useEffect(() => {
    setLiveEmail(currentEmail ?? undefined);
    setLiveEmailVerifiedAt(currentEmailVerifiedAt);
  }, [currentEmail, currentEmailVerifiedAt]);

  useEffect(() => updateService.onStateChange(setUpdateState), []);
  useEffect(() => settingsService.subscribe((settings) => setNotificationSettings(settings.notificationSettings)), []);
  useEffect(() => notificationPolicyStateService.subscribe(setNotificationPolicyState), []);
  useEffect(() => voiceService.subscribe(setVoiceSettingsSnapshot), []);
  useEffect(() => { void startupService.refreshNativeState().then(setStartupSettings); }, []);
  useEffect(() => { let active = true; void adminOperationsService.getAccess().then((access) => { if (active) setAdminOperationsAccess(access); }); return () => { active = false; }; }, []);

  const refreshAccountIdentity = useCallback(async (options: Readonly<{ silent?: boolean }> = {}) => {
    if (!options.silent) setIdentityRefreshing(true);
    const result = await authService.getCurrentUser();
    if (!options.silent) setIdentityRefreshing(false);
    if (!result.ok) {
      if (!options.silent) pushToast(result.error.message, "error");
      return;
    }
    if (!result.data) {
      setLiveEmail(undefined);
      setLiveEmailVerifiedAt(null);
      return;
    }
    setLiveEmail(result.data.email ?? undefined);
    setLiveEmailVerifiedAt(result.data.emailVerifiedAt ?? null);
  }, [pushToast]);

  const refreshActiveSessions = useCallback(async (options: Readonly<{ silent?: boolean }> = {}) => {
    if (!options.silent) setSessionsRefreshing(true);
    const result = await sessionManagementService.getActiveSessions();
    if (!options.silent) setSessionsRefreshing(false);
    if (!result.ok) {
      setSessionManagementMessage(result.message);
      setActiveSessions([]);
      if (!options.silent) pushToast(result.message, result.requiresSignIn ? "error" : "info");
      return;
    }

    setActiveSessions(result.data.sessions);
    setSessionManagementMessage(result.data.message);
  }, [pushToast]);

  const refreshSocialProviders = useCallback(async () => {
    const result = await socialAuthService.getAccountProviderStates();
    if (result.ok) setSocialProviders(result.data);
    else pushToast(result.error, "error");
  }, [pushToast]);

  useEffect(() => {
    if (active !== "Account") return;

    let cancelled = false;
    const boot = async () => {
      await Promise.all([
        refreshAccountIdentity({ silent: true }),
        refreshActiveSessions({ silent: true }),
        dataExportService.refreshStatus().then(setDataExportStatus),
        accountDeletionService.refreshStatus().then(setAccountDeletionStatus),
        refreshSocialProviders(),
      ]);
      if (!cancelled) setAccountActivities(accountActivityService.listRecent());
    };
    void boot();

    const identityTimer = window.setInterval(() => {
      void refreshAccountIdentity({ silent: true });
    }, 30_000);
    const sessionsTimer = window.setInterval(() => {
      void refreshActiveSessions({ silent: true });
    }, 15_000);

    const unsubscribeAuth = authService.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") return;
      void refreshAccountIdentity({ silent: true });
      void refreshActiveSessions({ silent: true });
      void refreshSocialProviders();
    });

    let unsubscribeSessions: () => void = () => {};
    void authService.getCurrentUser().then((result) => {
      if (cancelled || !result.ok || !result.data?.id) return;
      unsubscribeSessions = sessionManagementService.subscribeToDeviceSessionChanges(result.data.id, () => {
        void refreshActiveSessions({ silent: true });
      });
      if (cancelled) {
        unsubscribeSessions();
        unsubscribeSessions = () => {};
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(identityTimer);
      window.clearInterval(sessionsTimer);
      unsubscribeAuth();
      unsubscribeSessions();
    };
  }, [active, refreshAccountIdentity, refreshActiveSessions, refreshSocialProviders]);

  const scrollToAccountSection = (target: "password" | "sessions") => {
    const node = target === "password" ? passwordSectionRef.current : sessionsSectionRef.current;
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const currentDesktopSession = useMemo(
    () => activeSessions.find((session) => session.current) ?? activeSessions[0] ?? null,
    [activeSessions],
  );
  const otherActiveSessionCount = useMemo(
    () => activeSessions.filter((session) => !session.current && session.status === "active").length,
    [activeSessions],
  );
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
      void userBlockingService.refreshRemoteBlocks().then(setBlockedUsers);
      setNotificationPolicyState(notificationPolicyStateService.getSnapshot());
      void userSafetyCenterService.refreshRemotePrivacy().then(setSafetySettings);
      void profilePrivacyService.getOwnSettings().then(setProfilePrivacy);
      void directSafetyService.getPrivacy().then(setDirectMessagePrivacy);
      void dataExportService.refreshStatus().then(setDataExportStatus);
    }
  }, [active]);

  useEffect(() => activityPresenceService.subscribe(setActivitySnapshot), []);
  useEffect(() => activityPresenceService.subscribeEnabled(setAutoActivityEnabled), []);

  const updateAutoActivity = (next: boolean) => {
    const enabled = activityPresenceService.setEnabled(next);
    setAutoActivityEnabled(enabled);
    pushToast(
      enabled
        ? "Automatic activity status enabled. Detected games and media will appear in your status text."
        : "Automatic activity status disabled.",
      "info",
    );
  };

  const testNotification = async () => {
    const result = await notificationService.showTestNotification();
    pushToast(result.ok ? "Test notification sent." : result.reason ?? "Notification unavailable.", result.ok ? "success" : "error");
  };
  const requestNotificationPermission = async () => {
    const result = await notificationService.requestPermission();
    pushToast(result.ok ? "Desktop notification permission enabled." : result.reason ?? "Notification permission is unavailable.", result.ok ? "success" : "error");
  };
  const notificationStatus = notificationService.getStatus();
  const updateNotifications = (partial: Partial<NotificationSettings>) => {
    const next = settingsService.updateNotificationSettings(partial).notificationSettings;
    setNotificationSettings(next);
    pushToast("Notification preference saved.", "success");
  };
  const updateAccessibility = (partial: Partial<AccessibilitySettings>) => {
    const next = settingsService.updateAccessibilitySettings(partial).accessibilitySettings;
    onAccessibilitySettingsChange(next);
    pushToast("Accessibility setting saved locally.", "success");
  };
  const updateAppearance = (partial: Partial<AppearanceSettings>) => {
    const next = settingsService.updateAppearanceSettings(partial).appearanceSettings;
    onAppearanceSettingsChange(next);
    if (partial.themeMode) onThemeChange(appearanceService.resolveTheme(next.themeMode));
    pushToast(next.language === "tr" ? "Görünüm tercihi kaydedildi." : "Appearance preference saved.", "success");
  };
  const updateSafetySettings = (partial: Partial<UserSafetySettings>) => {
    const next = userSafetyCenterService.updateSettings(partial);
    setSafetySettings(next);
    pushToast("Privacy & Safety setting saved locally.", "success");
  };
  const updateFriendRequestPrivacy = async (policy: UserSafetySettings["whoCanSendFriendRequests"]) => {
    const result = await userSafetyCenterService.updateFriendRequestPrivacy(policy);
    setSafetySettings(result.settings);
    pushToast(result.ok ? "Friend-request privacy updated." : "Friend-request privacy could not be saved; the previous setting was restored.", result.ok ? "success" : "error");
  };
  const unblockUser = async (userId: string, displayName: string, username: string) => {
    const ok = await userBlockingService.setBlockedUser({ userId, displayName, username }, false);
    setBlockedUsers(userBlockingService.listBlockedUsers());
    pushToast(ok ? `${displayName} unblocked.` : `Could not unblock ${displayName}.`, ok ? "success" : "error");
  };
  const applyProfileSummary = useCallback((profile: ProfileSummary, options?: { mediaOnly?: boolean }) => {
    if (options?.mediaOnly) profileMediaGenerationRef.current += 1;
    setProfileDraft((current) => {
      const next = settingsService.updateProfileSettings(options?.mediaOnly ? {
        // Keep unsaved text fields; media URLs always come from the media op response.
        ...current,
        avatarUrl: profile.avatarUrl ?? null,
        coverUrl: profile.coverUrl ?? null,
      } : {
        username: profile.username,
        displayName: profile.displayName,
        status: profile.status,
        statusText: profile.statusText ?? "",
        bio: profile.bio ?? "",
        avatarUrl: profile.avatarUrl ?? null,
        coverUrl: profile.coverUrl ?? null,
        location: profile.location ?? "",
        timezone: profile.timezone ?? "",
        preferredLanguage: profile.preferredLanguage ?? "",
        tags: [...profile.tags],
      }).profileSettings;
      onProfileSettingsChange(next);
      return next;
    });
  }, [onProfileSettingsChange]);

  const saveProfileSettings = async () => {
    if (profileSaving || profileHydrating) return;
    const previous = profileSettings;
    const optimistic = settingsService.updateProfileSettings(profileDraft).profileSettings;
    onProfileSettingsChange(optimistic);
    setProfileSaving(true);
    const result = await profileService.updateCurrentProfile({
      username: profileDraft.username,
      displayName: profileDraft.displayName,
      status: profileDraft.status,
      statusText: profileDraft.statusText,
      bio: profileDraft.bio,
      location: profileDraft.location,
      timezone: profileDraft.timezone,
      preferredLanguage: profileDraft.preferredLanguage,
      tags: profileDraft.tags,
    });
    setProfileSaving(false);
    if (!result.ok) {
      const rollback = settingsService.updateProfileSettings(previous).profileSettings;
      setProfileDraft(rollback);
      onProfileSettingsChange(rollback);
      pushToast(result.error.message, "error");
      return;
    }
    applyProfileSummary(result.data);
    // Keep left-rail presence in sync with Profile Presence (busy→dnd, offline→invisible).
    const presencePreference = profileDraft.status === "busy" ? "dnd" as const
      : profileDraft.status === "offline" ? "invisible" as const
      : profileDraft.status === "idle" ? "idle" as const
      : "online" as const;
    globalPresenceService.setPreference(presencePreference);
    pushToast("Profile changes saved.", "success");
  };

  useEffect(() => {
    if (active !== "Profile") {
      setProfileHydrated(false);
      setProfileHydrating(false);
      return;
    }
    let cancelled = false;
    const mediaGenerationAtStart = profileMediaGenerationRef.current;
    setProfileHydrating(true);
    void profileService.getCurrentProfile().then((result) => {
      if (cancelled) return;
      setProfileHydrating(false);
      if (!result.ok) {
        pushToast(result.error.message, "error");
        setProfileHydrated(true);
        return;
      }
      // Prefer server fields, but keep local media if upload/remove raced this hydrate.
      if (result.data) {
        const mediaChangedWhileHydrating = mediaGenerationAtStart !== profileMediaGenerationRef.current;
        setProfileDraft((current) => {
          const incoming = result.data!;
          const next = settingsService.updateProfileSettings({
            username: incoming.username,
            displayName: incoming.displayName,
            status: incoming.status,
            statusText: incoming.statusText ?? "",
            bio: incoming.bio ?? "",
            avatarUrl: mediaChangedWhileHydrating ? current.avatarUrl ?? null : incoming.avatarUrl ?? null,
            coverUrl: mediaChangedWhileHydrating ? current.coverUrl ?? null : incoming.coverUrl ?? null,
            location: incoming.location ?? current.location ?? "",
            timezone: incoming.timezone ?? current.timezone ?? "",
            preferredLanguage: incoming.preferredLanguage ?? "",
            tags: [...incoming.tags],
          }).profileSettings;
          onProfileSettingsChange(next);
          return next;
        });
      }
      setProfileHydrated(true);
    });
    return () => { cancelled = true; };
    // Hydrate once per Profile tab open — not on every applyProfileSummary identity change.
  }, [active, onProfileSettingsChange, pushToast]);

  const resetProfileSettings = () => {
    setProfileDraft(profileSettings);
    pushToast("Unsaved profile changes discarded.", "info");
  };
  const createFeedbackDraft = () => ({
    issueType: feedbackIssueType,
    title: feedbackTitle.trim() || "Picom beta feedback",
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
  const [systemStatusOpen, setSystemStatusOpen] = useState(false);
  const [systemStatusChecking, setSystemStatusChecking] = useState(false);
  const [maintenanceSnapshot, setMaintenanceSnapshot] = useState<MaintenanceStatusSnapshot>(() => maintenanceStatusService.getSnapshot());
  const supabaseHost = (() => { try { return appConfig.supabase.url ? new URL(appConfig.supabase.url).hostname : "not configured"; } catch { return "invalid URL"; } })();
  const dataStatus = dataSourceService.getStatus();

  const refreshSystemStatus = async () => {
    setSystemStatusChecking(true);
    setMaintenanceSnapshot(await maintenanceStatusService.refresh());
    setSystemStatusChecking(false);
  };

  const openSystemStatus = async () => {
    // Show the live in-app system status. If a hosted public status page is also
    // configured, open it in the browser as well; otherwise the in-app panel is the
    // source of truth (no external status page is required).
    setSystemStatusOpen(true);
    void refreshSystemStatus();
    if (statusPageService.isConfigured()) {
      const result = await statusPageService.openStatusPage();
      pushToast(result.ok ? `Opened system status: ${statusPageService.getDisplayDomain()}.` : "The external status page could not be opened; showing in-app status.", result.ok ? "success" : "info");
    }
  };
  const updateLaunchOnStartup = async (enabled: boolean) => {
    const next = await startupService.setLaunchOnStartupEnabled(enabled);
    setStartupSettings(next);
    pushToast(next.error ? "Launch on startup is unavailable in this build or platform." : next.launchOnStartup ? "Picom will launch when you sign in." : "Launch on startup disabled.", next.error ? "error" : "success");
  };
  const updateProfilePrivacy=(partial:Partial<ProfilePrivacySettings>)=>{void profilePrivacyService.updateOwn(partial).then((result)=>{setProfilePrivacy(result.settings);pushToast(result.ok?"Profile privacy updated.":"Profile privacy could not be saved; the previous setting was restored.",result.ok?"success":"error")});};
  const updateDirectMessagePrivacy = (value: DirectMessagePrivacy) => { void directSafetyService.updatePrivacy(value).then((result) => { setDirectMessagePrivacy(result.value); if (result.ok) setSafetySettings(userSafetyCenterService.updateSettings({ whoCanDmMe: result.value === "friends" ? "friends_only" : result.value === "no_one" ? "nobody" : "everyone" })); pushToast(result.ok ? "Direct-message privacy updated." : "Direct-message privacy could not be synchronized.", result.ok ? "success" : "error"); }); };
  const updateStartMinimizedToTray = async (enabled: boolean) => {
    const next = await startupService.setStartMinimizedToTray(enabled);
    setStartupSettings(next);
    pushToast(next.startMinimizedToTray === enabled ? "Start-minimized preference saved." : "Start minimized requires supported launch-at-startup.", next.startMinimizedToTray === enabled ? "info" : "error");
  };
  const updateLockAfterInactivity = (enabled: boolean) => {
    const next = appLockService.updateSettings({ lockAfterInactivityEnabled: enabled });
    setAppLockSettings(next);
    pushToast(enabled ? "Inactivity lock preference enabled locally." : "Inactivity lock preference disabled.", "info");
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
  const runCacheAction = async (action: () => Promise<{ message: string; summary: CacheSummary }>, confirmation: string) => {
    if (!window.confirm(confirmation)) return;
    const result = await action();
    setCacheSummary(result.summary);
    pushToast(result.message, "success");
  };
  const resetLayoutState = () => {
    if (!window.confirm("Reset Picom feed and community navigation layout on this device? Messages, drafts, accounts, and server data are preserved.")) return;
    feedUiStateService.resetLayoutState();
    communityNavigationService.resetRouteMemory();
    pushToast("Local layout state reset. Reopen the affected view to apply defaults.", "success");
  };
  const resetLocalSettings = () => {
    if (!window.confirm("Reset local Picom settings to safe defaults? Your auth session, messages, drafts, and server data will not be deleted.")) return;
    settingsService.resetSettings();
    pushToast("Local settings reset. Restart Picom to apply every default.", "success");
  };
  const restartInSafeMode = () => {
    if (!window.confirm("Restart Picom in Safe Mode? Realtime, voice, notifications, tray, updates, and other optional services will be paused.")) return;
    safeModeService.enableSafeMode("manual_flag");
    window.location.reload();
  };
  const localDataMigrationStatus = localDataMigrationService.getStatus();
  const safeModeState = safeModeService.getStartupState();
  const requestEmailVerification = async () => {
    const result = await authService.requestEmailVerification();
    if (!result.ok) {
      setEmailVerificationMessage(result.error.message);
      pushToast(result.error.message, "error");
      return;
    }

    setEmailVerificationMessage(result.data.message);
    pushToast(result.data.message, "success");
    void refreshAccountIdentity({ silent: true });
  };
  const revokeOtherSessions = async () => {
    const result = await sessionManagementService.revokeOtherSessions();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setSessionManagementMessage(result.data.message);
    setSessionRevokeConfirmationOpen(false);
    accountActivityService.recordActivity({ type: "session_revoked", metadata: { scope: "other_sessions" } });
    setAccountActivities(accountActivityService.listRecent());
    await refreshActiveSessions();
    pushToast(result.data.message, "success");
  };
  const requestPasswordReset = async () => {
    if (!liveEmail) { pushToast("No email address is available for this account.", "error"); return; }
    const result = await authService.requestPasswordReset(liveEmail);
    const message = result.ok ? result.data.message : result.error.message;
    setPasswordResetMessage(message);
    pushToast(message, result.ok ? "success" : "error");
  };
  const submitPasswordChange = async () => {
    if (passwordChangeBusy) return;
    if (newPassword !== confirmNewPassword) { pushToast("New passwords do not match.", "error"); return; }
    setPasswordChangeBusy(true);
    const result = await authService.changeCurrentPassword(currentPassword, newPassword);
    setPasswordChangeBusy(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
    if (!result.ok) { pushToast(result.error.message, "error"); return; }
    accountActivityService.recordActivity({ type: "password_changed", metadata: { sessionsRevoked: result.data.sessionsRevoked } });
    pushToast(result.data.message, "success");
    onClose();
    await onLogout();
  };
  const connectSocialProvider = async (provider: SocialAuthProvider) => {
    setSocialProviderBusy(provider);
    const result = await socialAuthService.beginProviderLink(provider);
    setSocialProviderBusy(null);
    if (!result.ok) { pushToast(result.error, "error"); return; }
    pushToast(result.data.message, "info");
    await refreshSocialProviders();
  };
  const logoutCurrentSession = async () => {
    accountActivityService.recordActivity({ type: "logout", metadata: { source: "settings" } });
    setLogoutConfirmationOpen(false);
    onClose();
    await onLogout();
  };
  const accountDeletionConfirmationText = currentUsername;
  const requestAccountDeletion = async () => {
    if (accountDeletionBusy) return;
    setAccountDeletionBusy(true);
    const reauthentication = await authService.reauthenticateCurrentUser(accountDeletionPassword);
    setAccountDeletionPassword("");
    if (!reauthentication.ok) {
      setAccountDeletionBusy(false);
      pushToast(reauthentication.error.message, "error");
      return;
    }
    const result = await accountDeletionService.requestDeletion({ confirmationText: accountDeletionConfirmText, expectedUsername: accountDeletionConfirmationText, ownedCommunityCount });
    setAccountDeletionBusy(false);
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    accountActivityService.recordActivity({ type: "account_deletion_requested", metadata: { sessionsRevoked: result.data.sessionsRevoked } });
    pushToast(result.data.message, "success");
    onAccountDeletionRequested();
  };
  const updateCloseToTray = async (enabled: boolean) => {
    const result = await trayService.setCloseToTrayEnabled(enabled);
    if (!result.ok) {
      pushToast("Close to tray could not be updated.", "error");
      return;
    }
    setCloseToTrayEnabled(enabled);
    pushToast(enabled ? "Close to tray enabled." : "Close to tray disabled.", "success");
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
  const requestDataExport = async () => {
    const pending = dataExportService.requestExport(profileDraft);
    setDataExportStatus(dataExportService.getStatus());
    const result = await pending;
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setDataExportStatus(result.data);
    pushToast(result.data.message, "success");
  };
  const downloadDataExport = () => {
    const result = dataExportService.downloadExportJson();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    pushToast(`Data export downloaded: ${result.data.fileName}.`, "success");
  };

  const t = (key: LocalizationKey) => localizationService.translate(key, appearanceSettings.language);
  const sectionLabel = (section: SettingsSection) => localizationService.translateSettingsSection(section, appearanceSettings.language);

  return (
    <>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section ref={dialogRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <aside className="settings-nav">
          <span className="eyebrow">{t("settings.title")}</span>
          <h2 id="settings-modal-title">Picom Desktop</h2>
          <div className="settings-tabs">
            {visibleSections.map((section) => (
              <button key={section} className={active === section ? "active" : ""} onClick={() => setActive(section)}>
                <span className="tab-dot" />{sectionLabel(section)}
              </button>
            ))}
          </div>
        </aside>
        <main className="settings-content">
          <button className="icon-button modal-close" aria-label={t("settings.close")} onClick={onClose}>
            <AppIcon name={overlayIcons.close} size="lg" />
          </button>
          <span className="eyebrow">{sectionLabel(active)}</span>
          <h2>{sectionLabel(active)}</h2>
          {active === "Appearance" ? (
            <div className="appearance-settings-stack">
              <p className="settings-section-description">{t("appearance.description")}</p>
              <section className="appearance-theme-panel" aria-label="Theme selection">
                <div className="theme-grid">
                <button className={`theme-card ${appearanceSettings.themeMode === "light" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "light" })}>
                  <span className="theme-preview light-preview" />
                  <strong>{t("theme.light")}</strong>
                  <small>{t("theme.lightHint")}</small>
                </button>
                <button className={`theme-card ${appearanceSettings.themeMode === "dark" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "dark" })}>
                  <span className="theme-preview dark-preview" />
                  <strong>{t("theme.dark")}</strong>
                  <small>{t("theme.darkHint")}</small>
                </button>
                <button className={`theme-card ${appearanceSettings.themeMode === "system" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "system" })}>
                  <span className={`theme-preview ${theme === "dark" ? "dark-preview" : "light-preview"}`} />
                  <strong>{t("theme.system")}</strong>
                  <small>{t("theme.systemHint")}</small>
                </button>
                </div>
              </section>
              <div className="appearance-panels-grid">
              <div className="accessibility-card" aria-label="Accessibility display options">
                <strong>{t("accessibility.title")}</strong>
                <p>{t("accessibility.description")}</p>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{t("accessibility.highContrast")}</strong>
                    <small>{t("accessibility.highContrastHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.highContrast} onChange={(event) => updateAccessibility({ highContrast: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{t("accessibility.reducedMotion")}</strong>
                    <small>{t("accessibility.reducedMotionHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.reducedMotion} onChange={(event) => updateAccessibility({ reducedMotion: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{t("accessibility.largerText")}</strong>
                    <small>{t("accessibility.largerTextHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.largerText} onChange={(event) => updateAccessibility({ largerText: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{t("accessibility.focusRing")}</strong>
                    <small>{t("accessibility.focusRingHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.focusRingStrong} onChange={(event) => updateAccessibility({ focusRingStrong: event.target.checked })} />
                </label>
              </div>
              <div className="accessibility-card" aria-label="Language date and desktop density">
                <label className="settings-toggle-row"><span><strong>{t("appearance.language")}</strong><small>{t("appearance.languageHint")}</small></span><select value={appearanceSettings.language} onChange={(event) => updateAppearance({ language: event.target.value as AppearanceSettings["language"] })}><option value="en">English</option><option value="tr">Türkçe</option></select></label>
                <label className="settings-toggle-row"><span><strong>{t("appearance.density")}</strong><small>{t("appearance.densityHint")}</small></span><select value={appearanceSettings.density} onChange={(event) => updateAppearance({ density: event.target.value as AppearanceSettings["density"] })}><option value="comfortable">{appearanceSettings.language === "tr" ? "Rahat" : "Comfortable"}</option><option value="compact">{appearanceSettings.language === "tr" ? "Kompakt" : "Compact"}</option></select></label>
                <label className="settings-toggle-row"><span><strong>{t("appearance.dateStyle")}</strong><small>{t("appearance.dateStyleHint")}</small></span><select value={appearanceSettings.dateStyle} onChange={(event) => updateAppearance({ dateStyle: event.target.value as AppearanceSettings["dateStyle"] })}><option value="system">{appearanceSettings.language === "tr" ? "Sistem" : "System"}</option><option value="numeric">{appearanceSettings.language === "tr" ? "Sayısal" : "Numeric"}</option><option value="descriptive">{appearanceSettings.language === "tr" ? "Açıklamalı" : "Descriptive"}</option></select></label>
                <label className="settings-toggle-row"><span><strong>{t("appearance.timeFormat")}</strong><small>{t("appearance.timeFormatHint")}</small></span><select value={appearanceSettings.timeFormat} onChange={(event) => updateAppearance({ timeFormat: event.target.value as AppearanceSettings["timeFormat"] })}><option value="system">{appearanceSettings.language === "tr" ? "Sistem" : "System"}</option><option value="12h">12 {appearanceSettings.language === "tr" ? "saat" : "hour"}</option><option value="24h">24 {appearanceSettings.language === "tr" ? "saat" : "hour"}</option></select></label>
              </div>
              </div>
            </div>
          ) : active === "Account" ? (
            <div className="account-settings-stack">
              <p className="settings-section-description">Review session, verification, export, and deletion controls. Supabase Auth remains the source of truth for account actions.</p>

              <section className="account-settings-section">
                <h3 className="account-settings-section-title">Identity & verification</h3>
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label="Account identity">
                  <span>Account identity</span>
                  <strong>{liveEmail ?? currentUsername}</strong>
                  <small>{liveEmail ? `${liveEmailVerifiedAt ? "Verified email" : "Unverified email"}. Authentication provider details never expose tokens.` : "Mock/local identity. Connect Supabase Auth to manage a production email account."}</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={identityRefreshing} onClick={() => void refreshAccountIdentity()}>{identityRefreshing ? "Refreshing identity..." : "Refresh identity"}</button>
                  </div>
                </div>
                <div className="settings-status-card settings-feature-card" aria-label="Email verification controls">
                  <span>Email verification</span>
                  <strong>{liveEmailVerifiedAt ? "Email verified" : requireEmailVerification ? "Verification required" : "Verification recommended"}</strong>
                  <small>{emailVerificationMessage ?? (liveEmailVerifiedAt ? `Verified ${dateTimeService.formatFullTimestamp(liveEmailVerifiedAt)}.` : requireEmailVerification ? "Verify your email before the production policy is enforced. Resend uses a cooldown and a neutral response." : "Verification is available but not required by this build.")}</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" disabled={Boolean(liveEmailVerifiedAt) || !liveEmail} onClick={() => void requestEmailVerification()}>{liveEmailVerifiedAt ? "Email verified" : "Resend verification email"}</button>
                    {!liveEmailVerifiedAt ? <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={identityRefreshing || !liveEmail} onClick={() => void refreshAccountIdentity()}>Check verification status</button> : null}
                  </div>
                </div>
                <div className="security-card-grid" aria-label="Account security summary">
                  <article className="security-card">
                    <span>Session</span>
                    <strong>{currentDesktopSession ? currentDesktopSession.deviceLabel : "Current desktop session"}</strong>
                    <small>
                      {currentDesktopSession
                        ? `${currentDesktopSession.current ? "This device" : "Registered device"} · Provider ${currentDesktopSession.provider}${currentDesktopSession.expiresAt ? ` · Expires ${dateTimeService.formatFullTimestamp(currentDesktopSession.expiresAt)}` : ""}${otherActiveSessionCount ? ` · ${otherActiveSessionCount} other active` : ""}`
                        : (sessionManagementMessage ?? "Session metadata loads from the auth data source. Raw tokens are never shown here.")}
                    </small>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={sessionsRefreshing} onClick={() => void refreshActiveSessions()}>{sessionsRefreshing ? "Refreshing..." : "Refresh sessions"}</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToAccountSection("sessions")}>Manage sessions</button>
                      <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={() => { scrollToAccountSection("sessions"); setLogoutConfirmationOpen(true); }}>Log out</button>
                    </div>
                  </article>
                  <article className="security-card">
                    <span>Password</span>
                    <strong>Reset or change securely</strong>
                    <small>{passwordResetMessage ?? "Reset responses are non-enumerating. Password changes require the current password and revoke every session."}</small>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action" disabled={!liveEmail} onClick={() => void requestPasswordReset()}>Send password reset email</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToAccountSection("password")}>Change password</button>
                    </div>
                  </article>
                  <article className="security-card">
                    <span>Logs</span>
                    <strong>Redacted diagnostics</strong>
                    <small>Support payloads are routed through loggingService redaction before export.</small>
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setActive("Diagnostics")}>Open diagnostics</button>
                  </article>
                </div>
              </section>

              <section className="account-settings-section">
                <h3 className="account-settings-section-title">Sign-in providers</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Connected sign-in providers">
                  <span>Connected sign-in providers</span>
                  <strong>{socialProviders.filter((provider) => provider.linked).length ? `${socialProviders.filter((provider) => provider.linked).length} connected` : "Email and password"}</strong>
                  <small>Google, Apple, Steam, and Epic are enabled only after their Supabase provider and Picom callback configuration are explicitly available.</small>
                </div>
                <div className="security-card-grid" aria-label="Social provider connections">
                  {socialProviders.map((provider) => (
                    <article className="security-card" key={provider.provider}>
                      <span>{provider.label}</span>
                      <strong>{provider.linked ? "Connected" : provider.available ? "Available" : "Unavailable"}</strong>
                      <small>{provider.linked ? `${provider.label} is connected to this account.` : provider.reason ?? `Connect ${provider.label} through Supabase Auth.`}</small>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={provider.linked || !provider.available || socialProviderBusy !== null} onClick={() => void connectSocialProvider(provider.provider)}>{socialProviderBusy === provider.provider ? "Opening browser..." : provider.linked ? "Connected" : `Connect ${provider.label}`}</button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="account-settings-section" ref={passwordSectionRef} id="account-password">
                <h3 className="account-settings-section-title">Password</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Password reset and change">
                  <span>Password security</span>
                  <strong>Reset by email or change now</strong>
                  <small>{passwordResetMessage ?? "Password reset uses a neutral email response. Changing your password requires recent re-authentication and signs out every device."}</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" disabled={!liveEmail} onClick={() => void requestPasswordReset()}>Send password reset email</button>
                  </div>
                  <div className="account-settings-form-grid">
                    <label className="account-settings-field">
                      <small>Current password</small>
                      <input className="advanced-settings-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                    </label>
                    <label className="account-settings-field">
                      <small>New password (12+ characters)</small>
                      <input className="advanced-settings-input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                    </label>
                    <label className="account-settings-field">
                      <small>Confirm new password</small>
                      <input className="advanced-settings-input" type="password" autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} />
                    </label>
                  </div>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" disabled={passwordChangeBusy || currentPassword.length < 8 || newPassword.length < 12 || confirmNewPassword.length < 12} onClick={() => void submitPasswordChange()}>{passwordChangeBusy ? "Changing password..." : "Change password and sign out all sessions"}</button>
                  </div>
                </div>
              </section>

              <section className="account-settings-section" ref={sessionsSectionRef} id="account-sessions">
                <h3 className="account-settings-section-title">Sessions</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Active desktop sessions">
                  <span>Active sessions</span>
                  <strong>{activeSessions.length ? `${activeSessions.length} current session${activeSessions.length === 1 ? "" : "s"}` : "Session metadata unavailable"}</strong>
                  <small>{sessionManagementMessage ?? "Refresh active sessions to inspect safe desktop session metadata."}</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={sessionsRefreshing} onClick={() => void refreshActiveSessions()}>{sessionsRefreshing ? "Refreshing..." : "Refresh sessions"}</button>
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSessionRevokeConfirmationOpen(true)}>Revoke other sessions</button>
                    <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={() => setLogoutConfirmationOpen(true)}>Log out</button>
                  </div>
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
                {sessionRevokeConfirmationOpen ? (
                  <div className="danger-zone-card">
                    <span>Confirm session revocation</span>
                    <strong>Sign out every other device?</strong>
                    <small>The current desktop session remains active. This security action is recorded without storing raw tokens.</small>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={() => void revokeOtherSessions()}>Revoke other sessions now</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSessionRevokeConfirmationOpen(false)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
                {logoutConfirmationOpen ? (
                  <div className="danger-zone-card">
                    <span>Confirm logout</span>
                    <strong>Log out of this desktop session?</strong>
                    <small>Unsaved composer text may be lost. Other sessions are not affected.</small>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={() => void logoutCurrentSession()}>Log out now</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setLogoutConfirmationOpen(false)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="account-settings-section">
                <h3 className="account-settings-section-title">Account activity</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Account Activity section">
                  <span>Account Activity</span>
                  <strong>{accountActivities.length ? `${accountActivities.length} recent events` : "No recent activity"}</strong>
                  <small>Security history is local-only in this beta. Raw IP addresses, passwords, tokens, cookies, and auth headers are not stored.</small>
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
              </section>

              <section className="account-settings-section">
                <h3 className="account-settings-section-title">Data & account</h3>
                <div className="settings-status-card settings-feature-card" aria-label="User data export">
                  <span>Data export</span>
                  <strong>{dataExportStatus.status === "ready" ? "Export ready" : dataExportStatus.status === "processing" ? "Generating export" : dataExportStatus.status === "failed" ? "Export failed" : "Not requested"}</strong>
                  <small>{dataExportStatus.message}</small>
                  {dataExportStatus.requestedAt ? <small>Requested {dateTimeService.formatFullTimestamp(dataExportStatus.requestedAt)}. Export content is held only in this app session and is not stored in the request table.</small> : null}
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" disabled={dataExportStatus.status === "processing"} onClick={() => void requestDataExport()}>{dataExportStatus.status === "processing" ? "Generating export..." : "Request data export"}</button>
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!dataExportStatus.canDownload} onClick={downloadDataExport}>Download JSON export</button>
                  </div>
                </div>
                <div className="danger-zone-card" aria-label="Account deletion danger zone">
                  <span>Danger Zone</span>
                  <strong>Request account deletion</strong>
                  <small>{accountDeletionStatus.message} {ownedCommunityCount ? `You own ${ownedCommunityCount} communit${ownedCommunityCount === 1 ? "y" : "ies"}; transfer ownership first.` : "The request revokes sessions and starts a 14-day review period. It never hard-deletes immediately."}</small>
                  <label className="account-settings-field">
                    <small>Type username <b>{accountDeletionConfirmationText}</b> to confirm the request.</small>
                    <input className="advanced-settings-input" value={accountDeletionConfirmText} onChange={(event) => setAccountDeletionConfirmText(event.target.value)} placeholder={accountDeletionConfirmationText} />
                  </label>
                  <label className="account-settings-field">
                    <small>Re-enter your current password. Picom sends it only to Supabase Auth for re-authentication and never stores or logs it.</small>
                    <input className="advanced-settings-input" type="password" autoComplete="current-password" value={accountDeletionPassword} onChange={(event) => setAccountDeletionPassword(event.target.value)} placeholder="Current password" />
                  </label>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action settings-inline-action--danger" disabled={accountDeletionConfirmText.trim().toLowerCase() !== accountDeletionConfirmationText.toLowerCase() || accountDeletionPassword.length < 8 || ownedCommunityCount > 0 || accountDeletionStatus.requested || accountDeletionBusy} onClick={() => void requestAccountDeletion()}>{accountDeletionBusy ? "Verifying account..." : "Request deletion and sign out"}</button>
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!accountDeletionStatus.requested} onClick={() => void cancelAccountDeletion()}>Cancel request</button>
                  </div>
                </div>
              </section>
            </div>
          ) : active === "Privacy & Safety" ? (
            <div className="privacy-settings-stack">
              <p className="settings-section-description">Central desktop controls for blocking, privacy, data requests, and safety guidance. Supabase/RLS remains the source of truth for production enforcement.</p>

              <section className="privacy-settings-section">
                <h3 className="privacy-settings-section-title">Overview</h3>
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label="Safety summary">
                  <span>Safety summary</span>
                  <strong>{userSafetyCenterService.getPrivacySummary(blockedUsers.length)}</strong>
                  <small>Privacy choices are enforced locally and synchronized to Supabase when connected; passwords, tokens, and message content are never stored here.</small>
                </div>
                <div className="settings-status-card settings-feature-card" aria-label="Public and visitor profile behavior">
                  <span>Public and visitor visibility</span>
                  <strong>{profilePrivacy.visibility === "everyone" ? "Safe profile basics are public" : profilePrivacy.visibility === "shared_communities" ? "Shared communities only" : "Friends only"}</strong>
                  <small>Visitors never receive private-channel activity or media. Each section below can be hidden independently, and server-side profile projection remains authoritative.</small>
                </div>
                <div className="security-card-grid" aria-label="Privacy metrics">
                  <article className="security-card"><span>Blocked users</span><strong>{blockedUsers.length}</strong><small>Community messages are collapsed and direct messages are disabled for blocked users.</small></article>
                  <article className="security-card"><span>Online status</span><strong>{safetySettings.showOnlineStatus ? "Visible" : "Hidden"}</strong><small>Profile visibility is synchronized when Supabase profile privacy is available.</small></article>
                  <article className="security-card"><span>Read receipts</span><strong>{safetySettings.enableReadReceipts ? "Enabled" : "Disabled"}</strong><small>Read receipts remain opt-in and should not expose detailed reads in large communities.</small></article>
                  <article className="security-card"><span>Account data</span><strong>{dataExportStatus.status === "ready" ? "Export ready" : dataExportStatus.status === "processing" ? "Export processing" : "Export not requested"}</strong><small>{accountDeletionStatus.requested ? "Deletion request recorded; sign in again to cancel during the review period." : "No deletion request active."}</small></article>
                </div>
              </section>

              <section className="privacy-settings-section">
                <h3 className="privacy-settings-section-title">Who can reach you</h3>
                <label className="settings-toggle-row">
                  <span><strong>Who can send friend requests</strong><small>Controls incoming friend requests while preserving existing community access.</small></span>
                  <select value={safetySettings.whoCanSendFriendRequests} onChange={(event) => void updateFriendRequestPrivacy(event.target.value as UserSafetySettings["whoCanSendFriendRequests"])}>
                    <option value="everyone">Everyone</option>
                    <option value="community_members">Community members</option>
                    <option value="friends_of_friends">Friends of friends</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </label>
                <label className="settings-toggle-row"><span><strong>Who can start a direct message</strong><small>Existing blocked relationships remain inaccessible regardless of this preference.</small></span><select value={directMessagePrivacy} onChange={(event) => updateDirectMessagePrivacy(event.target.value as DirectMessagePrivacy)}><option value="everyone">Everyone</option><option value="friends">Friends only</option><option value="no_one">No one</option></select></label>
                <label className="settings-toggle-row">
                  <span><strong>Show online status</strong><small>Hide your online status and status text from other profile viewers.</small></span>
                  <input type="checkbox" checked={profilePrivacy.showOnlineStatus} onChange={(event) => { const enabled = event.target.checked; updateSafetySettings({ showOnlineStatus: enabled }); updateProfilePrivacy({ showOnlineStatus: enabled }); }} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Read receipts</strong><small>Controls whether eligible conversations may publish read receipts; detailed reader lists remain disabled.</small></span>
                  <input type="checkbox" checked={safetySettings.enableReadReceipts} onChange={(event) => updateSafetySettings({ enableReadReceipts: event.target.checked })} />
                </label>
              </section>

              <section className="privacy-settings-section">
                <h3 className="privacy-settings-section-title">Profile visibility</h3>
                <label className="settings-toggle-row"><span><strong>Profile audience</strong><small>Private-channel activity is always filtered by channel access, regardless of this choice.</small></span><select value={profilePrivacy.visibility} onChange={(event) => updateProfilePrivacy({ visibility: event.target.value as ProfilePrivacySettings["visibility"] })}><option value="everyone">Everyone</option><option value="shared_communities">Shared communities</option><option value="friends">Friends only</option></select></label>
                <label className="settings-toggle-row"><span><strong>Show location</strong><small>Hide your location from profile viewers.</small></span><input type="checkbox" checked={profilePrivacy.showLocation} onChange={(event) => updateProfilePrivacy({ showLocation: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show timezone</strong><small>Hide your timezone from profile viewers.</small></span><input type="checkbox" checked={profilePrivacy.showTimezone} onChange={(event) => updateProfilePrivacy({ showTimezone: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show recent activity</strong><small>Only friends or shared-community members can see activity, and only from channels they may access.</small></span><input type="checkbox" checked={profilePrivacy.showActivity} onChange={(event) => updateProfilePrivacy({ showActivity: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show shared media</strong><small>Only friends or shared-community members can see eligible media.</small></span><input type="checkbox" checked={profilePrivacy.showMedia} onChange={(event) => updateProfilePrivacy({ showMedia: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show communities and roles</strong><small>Hide community and role summaries from your public profile.</small></span><input type="checkbox" checked={profilePrivacy.showCommunities} onChange={(event) => updateProfilePrivacy({ showCommunities: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show friends</strong><small>Allow trusted profile viewers to see friendship context when supported.</small></span><input type="checkbox" checked={profilePrivacy.showFriends} onChange={(event) => updateProfilePrivacy({ showFriends: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show follower counts</strong><small>Control follower and following statistics on your profile.</small></span><input type="checkbox" checked={profilePrivacy.showFollows} onChange={(event) => updateProfilePrivacy({ showFollows: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>Show Radio and Podcast sections</strong><small>Hide audio activity from your profile without removing public community audio.</small></span><input type="checkbox" checked={profilePrivacy.showAudio} onChange={(event) => updateProfilePrivacy({ showAudio: event.target.checked })} /></label>
              </section>

              <section className="privacy-settings-section">
                <h3 className="privacy-settings-section-title">Blocking & mutes</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Blocked users list">
                  <span>Blocked users</span>
                  <strong>{blockedUsers.length ? "Manage locally" : "No blocked users"}</strong>
                  <small>Blocked users are enforced locally and synchronized through Supabase RLS when connected.</small>
                  <div className="privacy-list">
                    {blockedUsers.length ? blockedUsers.map((blockedUser) => (
                      <article key={blockedUser.userId} className="privacy-list-item">
                        <div>
                          <strong>{blockedUser.displayName}</strong>
                          <small>@{blockedUser.username} · blocked {dateTimeService.formatMessageTime(blockedUser.blockedAt)}</small>
                        </div>
                        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void unblockUser(blockedUser.userId, blockedUser.displayName, blockedUser.username)}>Unblock</button>
                      </article>
                    )) : (
                      <article className="privacy-list-item privacy-list-item--empty">
                        <div>
                          <strong>Your block list is clear</strong>
                          <small>Use member/profile actions to block someone locally.</small>
                        </div>
                      </article>
                    )}
                  </div>
                </div>
                <label className="settings-toggle-row"><span><strong>Mute all notifications</strong><small>Suppress desktop alerts while keeping the inbox available. This does not hide moderation-required content.</small></span><input type="checkbox" checked={notificationSettings.muted} onChange={(event) => updateNotifications({ muted: event.target.checked })} /></label>
                <div className="settings-status-card settings-feature-card" aria-label="Muted communities and channels">
                  <span>Muted scopes</span>
                  <strong>{notificationPolicyState.mutedCommunityIds.length + notificationPolicyState.mutedChannelIds.length ? "Manage notification and feed mutes" : "No muted communities or channels"}</strong>
                  <small>Muted scopes suppress native notifications and normal Mention Feed items. Community chat and moderator queues stay accessible.</small>
                  <div className="privacy-list">
                    {notificationPolicyState.mutedCommunityIds.map((communityId) => {
                      const community = communities.find((candidate) => candidate.id === communityId);
                      return (
                        <article key={`community-${communityId}`} className="privacy-list-item">
                          <div><strong>{community?.name ?? "Unavailable community"}</strong><small>Community mute</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setCommunityMuted(communityId, false))}>Unmute</button>
                        </article>
                      );
                    })}
                    {notificationPolicyState.mutedChannelIds.map((channelId) => {
                      const community = communities.find((candidate) => candidate.categories.some((category) => category.channels.some((channel) => channel.id === channelId)));
                      const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === channelId);
                      return (
                        <article key={`channel-${channelId}`} className="privacy-list-item">
                          <div><strong>#{channel?.name ?? "unavailable-channel"}</strong><small>{community?.name ?? "Unavailable community"} · channel mute</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setChannelMuted(channelId, false))}>Unmute</button>
                        </article>
                      );
                    })}
                    {!notificationPolicyState.mutedCommunityIds.length && !notificationPolicyState.mutedChannelIds.length ? (
                      <article className="privacy-list-item privacy-list-item--empty">
                        <div><strong>No muted scopes</strong><small>Mute communities or channels from their context menus.</small></div>
                      </article>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="privacy-settings-section">
                <h3 className="privacy-settings-section-title">Data & guidance</h3>
                <label className="settings-toggle-row"><span><strong>Share anonymous usage diagnostics</strong><small>Off by default. Records feature counts and app health locally; never message content, passwords, tokens, channel names, or attachment contents.</small></span><input type="checkbox" checked={analyticsEnabled} onChange={(event) => { const enabled = analyticsService.setEnabled(event.target.checked); setAnalyticsEnabled(enabled); pushToast(enabled ? "Anonymous diagnostics enabled locally." : "Anonymous diagnostics disabled and local queue cleared.", "success"); }} /></label>
                <div className="settings-status-card settings-feature-card retention-user-notice" aria-label="Content deletion and retention information">
                  <span>Content deletion and retention</span>
                  <strong>Deletion hides content; retention periods are not yet enforced</strong>
                  <small>Deleted messages appear as placeholders and their content, reactions, and attachments are hidden. Picom does not currently run an automatic production purge. Limited tombstones, moderation records, immutable audit events, and backups follow separate review and retention paths. Deleted accounts use a “Deleted User” fallback where historical context must remain.</small>
                  <small>Final retention periods and legal copy are pending privacy/legal approval. Clearing desktop cache does not delete server data; use Account data controls for export or deletion requests.</small>
                </div>
                <div className="settings-status-card settings-feature-card" aria-label="Safety tips">
                  <span>Safety tips</span>
                  <strong>Stay in control</strong>
                  <small>Do not share passwords, tokens, recovery codes, or private invite links. Report suspicious behavior from message/member context actions.</small>
                </div>
              </section>

              <section className="privacy-settings-section privacy-settings-section--compact">
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" disabled={dataExportStatus.status === "processing"} onClick={() => void requestDataExport()}>{dataExportStatus.status === "processing" ? "Generating export..." : "Request data export"}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { setActive("Account"); pushToast(accountDeletionStatus.message, accountDeletionStatus.requested ? "info" : "success"); }}>Review account deletion</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { setActive("Advanced"); pushToast("Open Beta support to report a problem.", "info"); }}>Report a problem</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => updateSafetySettings(userSafetyCenterService.resetSettings())}>Reset safety settings</button>
                </div>
              </section>
            </div>
          ) : active === "Profile" ? (
            <div className="profile-settings-stack">
              <p className="settings-section-description">Photos save immediately. Username, bio, and other fields save when you click Save profile.</p>
              {profileHydrating ? <p className="settings-section-description" aria-live="polite">Loading your live profile from Supabase…</p> : null}

              <section className="profile-settings-section">
                <header className="profile-settings-section-head">
                  <h3 className="profile-settings-section-title">Photos</h3>
                  <p>Upload a wide cover image and a square profile photo for your public profile.</p>
                </header>
                <ProfileMediaEditor displayName={profileDraft.displayName || currentUsername} avatarUrl={profileDraft.avatarUrl} coverUrl={profileDraft.coverUrl} onProfileUpdated={(profile) => applyProfileSummary(profile, { mediaOnly: true })} onNotice={pushToast} />
              </section>

              <section className="profile-settings-section">
                <header className="profile-settings-section-head">
                  <h3 className="profile-settings-section-title">Public profile</h3>
                  <p>These details appear on your profile and in communities you join.</p>
                </header>
                <div className="profile-settings-form">
                  <div className="profile-settings-form-grid">
                    <label className="profile-settings-field">
                      <span>Username</span>
                      <input className="advanced-settings-input" value={profileDraft.username} minLength={3} maxLength={32} pattern="[a-z0-9._-]+" onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value.toLowerCase() })} placeholder="username" autoCapitalize="none" spellCheck={false} />
                    </label>
                    <label className="profile-settings-field">
                      <span>Display name</span>
                      <input className="advanced-settings-input" value={profileDraft.displayName} maxLength={80} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} placeholder="Display name" />
                    </label>
                  </div>

                  <div className="profile-settings-field">
                    <span>Presence</span>
                    <div className="profile-presence-segment" role="group" aria-label="Presence">
                      {(["online", "idle", "busy", "offline"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`profile-presence-option${profileDraft.status === status ? " is-active" : ""}`}
                          aria-pressed={profileDraft.status === status}
                          onClick={() => setProfileDraft({ ...profileDraft, status })}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="profile-settings-form-grid">
                    <label className="profile-settings-field">
                      <span>Status text</span>
                      <input
                        className="advanced-settings-input"
                        value={autoActivityEnabled && activitySnapshot.statusText ? activitySnapshot.statusText : profileDraft.statusText}
                        maxLength={120}
                        onChange={(event) => setProfileDraft({ ...profileDraft, statusText: event.target.value })}
                        placeholder="What are you working on?"
                        disabled={autoActivityEnabled && Boolean(activitySnapshot.statusText)}
                        readOnly={autoActivityEnabled && Boolean(activitySnapshot.statusText)}
                      />
                    </label>
                    <label className="profile-settings-field">
                      <span>Location</span>
                      <input className="advanced-settings-input" value={profileDraft.location} maxLength={120} onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })} placeholder="City or region" />
                    </label>
                    <label className="profile-settings-field">
                      <span>Timezone</span>
                      <input className="advanced-settings-input" value={profileDraft.timezone} maxLength={80} onChange={(event) => setProfileDraft({ ...profileDraft, timezone: event.target.value })} placeholder="Europe/Berlin" />
                    </label>
                    <label className="profile-settings-field">
                      <span>Preferred language</span>
                      <input className="advanced-settings-input" value={profileDraft.preferredLanguage} maxLength={48} onChange={(event) => setProfileDraft({ ...profileDraft, preferredLanguage: event.target.value })} placeholder="English" />
                    </label>
                  </div>

                  <label className="settings-toggle-row">
                    <span>
                      <strong>Automatic activity status</strong>
                      <small>
                        {activityBridgeAvailable
                          ? "Show the game or song currently playing on this Windows PC (Media Session + active window)."
                          : "Available in the Picom desktop app on Windows. Browser sessions cannot detect games or media."}
                      </small>
                      {autoActivityEnabled && activitySnapshot.statusText ? (
                        <small aria-live="polite">Live: {activitySnapshot.statusText}</small>
                      ) : autoActivityEnabled && activityBridgeAvailable ? (
                        <small aria-live="polite">Waiting for a game or media session…</small>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      checked={autoActivityEnabled}
                      onChange={(event) => updateAutoActivity(event.target.checked)}
                      disabled={!activityBridgeAvailable}
                    />
                  </label>

                  <label className="profile-settings-field">
                    <span>Tags</span>
                    <input className="advanced-settings-input" value={profileDraft.tags.join(", ")} onChange={(event) => setProfileDraft({ ...profileDraft, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12) })} placeholder="Design, Community, Music" />
                    <small>Up to 12 comma-separated tags.</small>
                  </label>

                  <label className="profile-settings-field">
                    <span>Bio</span>
                    <textarea className="advanced-settings-textarea" value={profileDraft.bio} maxLength={500} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} placeholder="Write a short profile bio" rows={4} />
                  </label>
                </div>
              </section>

              <section className="profile-settings-section profile-settings-section--compact">
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" disabled={profileSaving || profileHydrating || !profileDraft.displayName.trim() || !/^[a-z0-9._-]{3,32}$/.test(profileDraft.username)} onClick={() => void saveProfileSettings()}>{profileSaving ? "Saving..." : profileHydrating ? "Loading profile..." : "Save profile"}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={profileSaving || profileHydrating} onClick={resetProfileSettings}>Discard changes</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={profileSaving} onClick={() => setActive("Privacy & Safety")}>Manage profile privacy</button>
                </div>
              </section>

              <section className="profile-settings-section">
                <ProfileVerificationRequestCard />
              </section>
            </div>
          ) : active === "Notifications" ? (
            <div className="notification-settings-stack">
              <p className="settings-section-description">Choose which Picom activity can reach your inbox and desktop. Native delivery remains behind the safe preload bridge.</p>

              <EmailPreferencesPanel />
              <section className="notification-settings-section">
                <h3 className="notification-settings-section-title">Runtime & delivery</h3>
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label="Notification runtime status">
                  <span>Runtime support</span>
                  <strong>{notificationStatus.supported ? "Available" : "Fallback only"}</strong>
                  <small>Permission: {notificationStatus.permission}. Account preferences synchronize when Supabase mode is available.</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" disabled={!notificationStatus.supported || notificationStatus.permission === "granted"} onClick={() => void requestNotificationPermission()}>{notificationStatus.permission === "granted" ? "Permission granted" : "Allow desktop notifications"}</button>
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!notificationSettings.enabled || !notificationSettings.nativeDesktopEnabled} onClick={() => void testNotification()}>Send test notification</button>
                  </div>
                </div>
                <label className="settings-toggle-row">
                  <span><strong>Enable notifications</strong><small>Master preference for notification inbox, unread routing, and desktop alerts.</small></span>
                  <input type="checkbox" checked={notificationSettings.enabled} onChange={(event) => updateNotifications({ enabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Native desktop notifications</strong><small>Show approved alerts outside Picom when the desktop runtime and permission allow it.</small></span>
                  <input type="checkbox" disabled={!notificationSettings.enabled} checked={notificationSettings.nativeDesktopEnabled} onChange={(event) => updateNotifications({ nativeDesktopEnabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Notification sounds</strong><small>Play the operating-system notification sound when an alert is not silenced by Quiet Hours.</small></span>
                  <input type="checkbox" disabled={!notificationSettings.enabled || !notificationSettings.nativeDesktopEnabled} checked={notificationSettings.soundEnabled} onChange={(event) => updateNotifications({ soundEnabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Do not disturb</strong><small>Pause desktop interruptions while preserving the notification inbox and unread state.</small></span>
                  <input type="checkbox" checked={notificationPolicyState.doNotDisturb} onChange={(event) => setNotificationPolicyState(notificationPolicyStateService.setDoNotDisturb(event.target.checked))} />
                </label>
              </section>

              <section className="notification-settings-section">
                <h3 className="notification-settings-section-title">Activity</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Notification categories">
                  <span>Categories</span>
                  <strong>Choose what notifies you</strong>
                  <small>Disabled categories do not create native alerts or inbox entries.</small>
                </div>
                {notificationPreferenceRows.map((preference) => (
                  <label className="settings-toggle-row" key={preference.key}>
                    <span><strong>{preference.label}</strong><small>{preference.description}</small></span>
                    <input type="checkbox" disabled={!notificationSettings.enabled} checked={notificationSettings[preference.key]} onChange={(event) => updateNotifications({ [preference.key]: event.target.checked })} />
                  </label>
                ))}
                <label className="settings-toggle-row">
                  <span><strong>Mentions only</strong><small>Suppress normal-message desktop alerts while preserving mentions and system notices.</small></span>
                  <input type="checkbox" checked={notificationSettings.mentionsOnly} onChange={(event) => updateNotifications({ mentionsOnly: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Message digest preview</strong><small>{notificationDigestService.getDigestModeLabel(notificationSettings.digestMode)} groups lower-priority messages in the inbox instead of interrupting you.</small></span>
                  <select value={notificationSettings.digestMode} onChange={(event) => updateNotifications({ digestMode: event.target.value as typeof notificationSettings.digestMode })}>
                    <option value="off">Off</option>
                    <option value="hourly_placeholder">Hourly grouping</option>
                    <option value="daily_placeholder">Daily grouping</option>
                  </select>
                </label>
              </section>

              <section className="notification-settings-section">
                <h3 className="notification-settings-section-title">Quiet Hours</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Quiet Hours notification setting">
                  <span>Schedule</span>
                  <strong>{notificationSettings.quietHours.enabled ? `${notificationSettings.quietHours.startTime} – ${notificationSettings.quietHours.endTime}` : "Disabled"}</strong>
                  <small>Uses your system timezone. Notification inbox can still record suppressed notifications later.</small>
                </div>
                <label className="settings-toggle-row">
                  <span><strong>Enable Quiet Hours</strong><small>Silence notification interruptions during scheduled hours.</small></span>
                  <input type="checkbox" checked={notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, enabled: event.target.checked } })} />
                </label>
                <div className="notification-settings-time-grid">
                  <label className="notification-settings-time-field">
                    <span>Start time</span>
                    <input className="notification-settings-time-input" type="time" value={notificationSettings.quietHours.startTime} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, startTime: event.target.value } })} />
                    <small>Local desktop time when Quiet Hours begin.</small>
                  </label>
                  <label className="notification-settings-time-field">
                    <span>End time</span>
                    <input className="notification-settings-time-input" type="time" value={notificationSettings.quietHours.endTime} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, endTime: event.target.value } })} />
                    <small>Local desktop time when Quiet Hours end.</small>
                  </label>
                </div>
                <label className="settings-toggle-row">
                  <span><strong>Apply to</strong><small>Choose whether Quiet Hours suppress all notifications, normal messages, or sounds only.</small></span>
                  <select value={notificationSettings.quietHours.applyTo} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, applyTo: event.target.value as typeof notificationSettings.quietHours.applyTo } })}>
                    <option value="all_notifications">All notifications</option>
                    <option value="normal_messages_only">Normal messages only</option>
                    <option value="sounds_only">Sounds only</option>
                  </select>
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Allow mentions during Quiet Hours</strong><small>Mentions can still notify when this preference is enabled.</small></span>
                  <input type="checkbox" disabled={!notificationSettings.quietHours.enabled} checked={notificationSettings.quietHours.allowMentions} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, allowMentions: event.target.checked } })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>Allow mentions from muted communities and channels</strong><small>When disabled, muted scopes suppress mentions as well as normal activity.</small></span>
                  <input type="checkbox" checked={notificationSettings.allowMentionsFromMutedScopes} onChange={(event) => updateNotifications({ allowMentionsFromMutedScopes: event.target.checked })} />
                </label>
              </section>

              <section className="notification-settings-section">
                <h3 className="notification-settings-section-title">Muted scopes</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Muted communities and channels">
                  <span>Muted scopes</span>
                  <strong>{notificationPolicyState.mutedCommunityIds.length + notificationPolicyState.mutedChannelIds.length ? "Muted communities and channels" : "No muted communities or channels"}</strong>
                  <small>Muted scopes suppress normal activity. Mentions follow your muted-scope override above.</small>
                  <div className="privacy-list">
                    {notificationPolicyState.mutedCommunityIds.map((communityId) => {
                      const community = communities.find((candidate) => candidate.id === communityId);
                      return (
                        <article key={`notifications-community-${communityId}`} className="privacy-list-item">
                          <div><strong>{community?.name ?? "Unavailable community"}</strong><small>Community mute</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setCommunityMuted(communityId, false))}>Unmute</button>
                        </article>
                      );
                    })}
                    {notificationPolicyState.mutedChannelIds.map((channelId) => {
                      const community = communities.find((candidate) => candidate.categories.some((category) => category.channels.some((channel) => channel.id === channelId)));
                      const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === channelId);
                      return (
                        <article key={`notifications-channel-${channelId}`} className="privacy-list-item">
                          <div><strong>#{channel?.name ?? "unavailable-channel"}</strong><small>{community?.name ?? "Unavailable community"} · channel mute</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setChannelMuted(channelId, false))}>Unmute</button>
                        </article>
                      );
                    })}
                    {!notificationPolicyState.mutedCommunityIds.length && !notificationPolicyState.mutedChannelIds.length ? (
                      <article className="privacy-list-item privacy-list-item--empty">
                        <div><strong>No muted scopes</strong><small>Mute communities or channels from their context menus.</small></div>
                      </article>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          ) : active === "Voice & Video" ? (
            <div className="voice-settings-stack">
              <p className="settings-section-description">Manage permission-gated voice devices, LiveKit capture processing, screen-share guidance, and Radio/Podcast playback defaults.</p>

              <section className="voice-settings-section">
                <h3 className="voice-settings-section-title">Live session</h3>
                <div className="security-card-grid" aria-label="Voice session status">
                  <article className="security-card"><span>Connection</span><strong>{voiceSettingsSnapshot.status.replace(/_/g, " ")}</strong><small>{voiceSettingsSnapshot.roomName ? `Room: ${voiceSettingsSnapshot.roomName}` : "Join a voice channel to activate controls."}</small></article>
                  <article className="security-card"><span>Microphone</span><strong>{voiceSettingsSnapshot.muted ? "Muted" : "Unmuted"}</strong><small>Shortcut: Ctrl + Shift + M while connected.</small></article>
                  <article className="security-card"><span>Incoming audio</span><strong>{voiceSettingsSnapshot.deafened ? "Deafened" : "Listening"}</strong><small>Shortcut: Ctrl + Shift + D while connected.</small></article>
                  <article className="security-card"><span>Screen share</span><strong>{voiceSettingsSnapshot.screenSharing ? "Sharing" : "Not sharing"}</strong><small>Source selection is available from an active voice room.</small></article>
                </div>
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" disabled={voiceSettingsSnapshot.status !== "connected"} onClick={() => void voiceService.setMuted(!voiceSettingsSnapshot.muted)}>{voiceSettingsSnapshot.muted ? "Unmute microphone" : "Mute microphone"}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={voiceSettingsSnapshot.status !== "connected"} onClick={() => { const result = voiceService.setDeafened(!voiceSettingsSnapshot.deafened); if (!result.ok) pushToast(result.error.message, "error"); }}>{voiceSettingsSnapshot.deafened ? "Undeafen" : "Deafen"}</button>
                </div>
              </section>

              <VoiceDeviceSelection />
            </div>
          ) : active === "Keyboard Shortcuts" ? (
            <KeyboardShortcutsSection />
          ) : active === "Diagnostics" ? (
            <div className="diagnostics-settings-stack">
              <p className="settings-section-description">Review redacted runtime health, export support payloads, and inspect local logs without exposing secrets.</p>
              <FeedbackSection onNotice={pushToast} />
              <DiagnosticsSection onNotice={pushToast} />
              <LogsViewer onNotice={pushToast} />
            </div>
          ) : active === "Admin Operations" ? (
            onOpenPanel ? (
              <AdminOperationsPanelRedirect onOpenPanel={() => { onClose(); onOpenPanel(); }} />
            ) : (
              <AdminOperationsPanelRedirect onOpenPanel={onClose} />
            )
          ) : active === "Legal" ? (
            <div className="legal-settings-panel">
              <div className="settings-status-card"><span>Legal version {legalConfig.currentVersion}</span><strong>Professional review required</strong><small>Terms and privacy links below match the version recorded during registration or re-acceptance. These drafts are not final legal advice.</small></div>
              {legalDocumentOrder.map((documentId) => <button type="button" key={documentId} onClick={() => setOpenLegalDocument(documentId)}><span><strong>{legalDocuments[documentId].title}</strong><small>{legalDocuments[documentId].updatedLabel}</small></span><AppIcon name="chevronRight" size="sm" /></button>)}
              <small>Picom {appConfig.version} · {appConfig.releaseChannel} channel</small>
            </div>
          ) : active === "Advanced" ? (
            <div className="advanced-settings-stack">
              <p className="settings-section-description">Tray, window controls, file handling and clipboard are routed through safe services.</p>

              <section className="advanced-settings-section">
                <h3 className="advanced-settings-section-title">Runtime & build</h3>
                {developerPortalAvailable ? <div className="settings-status-card settings-feature-card" aria-label="Developer Portal restricted beta"><span>Developer Portal</span><strong>Restricted beta</strong><small>Review safe bot/webhook metadata and developer guidance. No raw keys, application registration, or public publishing.</small><button type="button" className="settings-inline-action" onClick={() => setDeveloperPortalOpen(true)}>Open Developer Portal</button></div> : null}
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label="About Picom build metadata">
                  <span>About Picom <span className="picom-beta-badge">Beta · Frontend preview</span></span>
                  <strong>{appConfig.name} {appConfig.version} ({appConfig.releaseChannel})</strong>
                  <small>Frontend-only beta: the desktop app is feature-complete, but some backend services may not be fully enabled yet. Build: {appConfig.build.date}. Commit: {appConfig.build.commitShort}. Runtime: {appConfig.build.desktopRuntime}. API compatibility: {appConfig.build.backendApiCompatibilityVersion}.</small>
                </div>
                <div className="security-card-grid" aria-label="Advanced runtime summary">
                  <article className="security-card"><span>Release</span><strong>{appConfig.releaseChannel}</strong><small>{appConfig.version} / {appConfig.build.commitShort} / {appConfig.build.date}</small></article>
                  <article className="security-card"><span>Data source</span><strong>{appConfig.dataSource}</strong><small>{appConfig.runtimeTarget} on {navigator.platform || "unknown platform"}</small></article>
                  <article className="security-card"><span>Local data</span><strong>Manifest v{localDataMigrationStatus.manifestSchemaVersion} / settings v{localDataMigrationStatus.settingsSchemaVersion}</strong><small>{localDataMigrationStatus.lastMigrationOk === false ? "Last migration needs Safe Mode review" : localDataMigrationStatus.lastMigratedAt ? `Migrated ${dateTimeService.formatFullTimestamp(localDataMigrationStatus.lastMigratedAt)}` : "Migration manifest will be created at startup"}</small></article>
                  <article className="security-card"><span>Recovery backups</span><strong>{localDataMigrationStatus.retainedBackupCount}</strong><small>Bounded non-sensitive local migration backups; auth storage is excluded.</small></article>
                </div>
              </section>

              <section className="advanced-settings-section">
                <h3 className="advanced-settings-section-title">Recovery & desktop shell</h3>
                <div className="settings-status-card settings-feature-card" aria-label="Safe Mode recovery">
                  <span>Safe Mode</span><strong>{safeModeState.active ? `Active: ${safeModeState.reason ?? "manual"}` : "Available for troubleshooting"}</strong><small>Safe Mode pauses optional services without clearing your authentication session or server data.</small>
                  <div className="settings-actions-row"><button type="button" className="settings-inline-action" onClick={restartInSafeMode}>Restart in Safe Mode</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={resetLayoutState}>Reset layout</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={resetLocalSettings}>Reset local settings</button></div>
                </div>
                {import.meta.env.DEV ? <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { trayService.simulate("settings"); pushToast("Tray settings action simulated.", "info"); }}>Simulate tray settings</button> : null}
                <div className="settings-status-card settings-feature-card" aria-label="Native app menu foundation">
                  <span>Native app menu</span>
                  <strong>Hidden chrome, safe actions</strong>
                  <small>The operating-system menu remains hidden for the custom Picom titlebar. Desktop menu actions route through menuService instead of direct Electron calls.</small>
                </div>
                {import.meta.env.DEV ? <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => menuService.triggerPlaceholderAction("open-command-palette")}>Simulate menu palette</button>
                  <button
                    type="button"
                    className="settings-inline-action settings-inline-action--ghost"
                    aria-label="Reset first launch setup for development testing"
                    onClick={() => {
                      if (!window.confirm("Reset first-launch setup for development/support testing? Account and local content are preserved.")) return;
                      settingsService.resetFirstLaunchSetup();
                      pushToast("First-launch setup reset. Restart Picom to test it again; account and local data were preserved.", "success");
                    }}
                  >
                    Reset first-launch setup
                  </button>
                </div> : null}
                <button type="button" className="settings-inline-action" onClick={openSystemStatus}>Open system status</button>
                {systemStatusOpen ? (
                  <div className="settings-status-card settings-feature-card system-status-panel" aria-label="Live system status" aria-live="polite">
                    <span>System status</span>
                    <strong className={`system-status-pill system-status-pill--${maintenanceSnapshot.status}`}>
                      {maintenanceSnapshot.status === "operational" ? "All systems operational" : maintenanceSnapshot.status === "degraded" ? "Some services degraded" : "Under maintenance"}
                    </strong>
                    <small>{maintenanceSnapshot.message}</small>
                    <dl className="system-status-list">
                      <div><dt>App</dt><dd>{appConfig.name} {appConfig.version} · {appConfig.releaseChannel} · {appConfig.build.commitShort}</dd></div>
                      <div><dt>Backend</dt><dd>{dataStatus.isSupabase ? `Supabase · ${supabaseHost}` : "Mock data"} · {dataStatus.configured ? "configured" : "not configured"}</dd></div>
                      <div><dt>Voice (LiveKit)</dt><dd>{appConfig.liveKit.enabled && appConfig.liveKit.url ? "Configured" : "Not configured"}</dd></div>
                      <div><dt>Realtime</dt><dd>{appConfig.realtimeScalingMode}</dd></div>
                      <div><dt>Network</dt><dd>{typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"}</dd></div>
                      <div><dt>Last checked</dt><dd>{maintenanceSnapshot.checkedAt ? new Date(maintenanceSnapshot.checkedAt).toLocaleString() : "—"}</dd></div>
                    </dl>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action" disabled={systemStatusChecking} onClick={() => void refreshSystemStatus()}>{systemStatusChecking ? "Checking…" : "Refresh"}</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSystemStatusOpen(false)}>Hide</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="advanced-settings-section">
                <h3 className="advanced-settings-section-title">Updates & diagnostics</h3>
              <div className="settings-status-card settings-feature-card" aria-label="Desktop update recovery status">
                <span>Desktop updates</span>
                <strong>{updateState.status.split("_").join(" ")}</strong>
                <small>{updateState.message}</small>
                <small>Version {updateState.appVersion} on {updateState.releaseChannel}. Production auto-update remains disabled until a signed endpoint is configured.</small>
                {updateState.progress !== null ? <small>Simulation progress: {updateState.progress}%</small> : null}
              </div>
              <div className="settings-status-card settings-feature-card" aria-label="Support diagnostics export">
                <span>Support diagnostics</span>
                <strong>Redacted snapshot ready</strong>
                <small>Review app/platform, data source, realtime, voice, recent errors, and redacted logs before sharing.</small>
                <button type="button" className="settings-inline-action" onClick={() => setActive("Diagnostics")}>Open diagnostics</button>
              </div>
              <label className="settings-toggle-row"><span><strong>Enable diagnostic reports</strong><small>Off by default. Stores a bounded redacted local crash envelope; no provider or DSN is configured.</small></span><input type="checkbox" checked={crashReportingEnabled} onChange={(event) => { const enabled = crashReporterService.setEnabled(event.target.checked); setCrashReportingEnabled(enabled); pushToast(enabled ? "Diagnostic reports enabled locally." : "Diagnostic reports disabled and local queue cleared.", "success"); }} /></label>
              {import.meta.env.DEV ? <div className="settings-actions-row"><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { const record = crashReporterService.captureException(new Error("Picom development crash report test"), { source: "settings-test", authorization: "Bearer redaction-test" }); pushToast(record ? "Redacted test error captured locally." : "Enable diagnostic reports before capturing a test error.", record ? "success" : "info"); }}>Capture test error safely</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { const status = crashReporterService.getStatus(); pushToast(`${status.queuedLocalRecords} redacted crash records queued locally.`, "info"); }}>Show crash report status</button></div> : null}
              <div className="settings-actions-row">
                <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled aria-disabled="true" onClick={() => void checkForUpdatesPlaceholder()}>Automatic updates require a signed release endpoint</button>
                {import.meta.env.DEV ? <><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setAvailablePlaceholder())}>Simulate available</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.startDownloadPlaceholder())}>Simulate download</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setReadyToInstallPlaceholder())}>Simulate ready</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateUpdateFailure("download")}>Simulate download failure</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateUpdateFailure("install")}>Simulate install failure</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateUpdateFailure("error")}>Simulate error</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setRollbackAvailablePlaceholder())}>Simulate rollback</button></> : null}
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.retry())}>Retry</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.clearError())}>Clear error</button>
              </div>
              <div className="settings-status-card settings-feature-card" aria-label="System status page">
                <span>System status</span>
                <strong>{statusPageService.isConfigured() ? statusPageService.getDisplayDomain() : "Not configured"}</strong>
                <small>`VITE_STATUS_PAGE_URL` can point to a public non-sensitive status page when one is configured.</small>
              </div>
              </section>

              <section className="advanced-settings-section">
                <h3 className="advanced-settings-section-title">Startup & behavior</h3>
              <div className="settings-status-card settings-feature-card" aria-label="Launch on startup">
                <span>Launch on startup</span>
                <strong>{startupSettings.launchOnStartup ? "Enabled" : "Disabled"}</strong>
                <small>Mode: {startupSettings.mode}. Windows/macOS registration is available only in packaged builds; Linux remains unsupported safely.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Launch Picom on startup</strong>
                  <small>Registers Picom only after you enable it. Disabled by default.</small>
                </span>
                <input type="checkbox" checked={startupSettings.launchOnStartup} onChange={(event) => void updateLaunchOnStartup(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Start minimized to tray</strong>
                  <small>Applied when launch-on-startup and native tray support are available; stored per device.</small>
                </span>
                <input type="checkbox" checked={startupSettings.startMinimizedToTray} onChange={(event) => void updateStartMinimizedToTray(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Close to tray</strong>
                  <small>When supported, the close button hides Picom. Use Quit from the tray menu to exit completely.</small>
                </span>
                <input type="checkbox" checked={closeToTrayEnabled} onChange={(event) => void updateCloseToTray(event.target.checked)} />
              </label>
              <div className="settings-status-card settings-feature-card" aria-label="App lock status">
                <span>App lock</span>
                <strong>Ctrl + Shift + L</strong>
                <small>Quick lock hides chat content without storing a password locally. Account authentication remains managed by Supabase.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Automatic inactivity lock</strong>
                  <small>Not available in Full MVP. Use Ctrl + Shift + L to lock Picom immediately.</small>
                </span>
                <input type="checkbox" checked={appLockSettings.lockAfterInactivityEnabled} onChange={(event) => updateLockAfterInactivity(event.target.checked)} disabled aria-disabled="true" />
              </label>
              </section>

              <section className="advanced-settings-section">
                <h3 className="advanced-settings-section-title">Cache & support</h3>
              <div className="settings-status-card settings-feature-card" aria-label="Cache management">
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
                  <strong>{cacheSummary?.messageCacheStatus.replace(/_/g, " ") ?? "not persisted"}</strong>
                  <small>Picom does not persist a separate message cache; server messages and local drafts are untouched.</small>
                </article>
                <article className="security-card">
                  <span>Offline data</span>
                  <strong>{cacheSummary ? `${cacheSummary.pendingQueuedMessages} queued` : "memory only"}</strong>
                  <small>Pending messages stay in memory and are preserved by cache clearing.</small>
                </article>
              </div>
              <div className="settings-actions-row">
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={refreshCacheSummary}>Refresh cache summary</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void runCacheAction(() => cacheManagementService.clearImageCache(), "Clear Picom's in-memory image metadata cache? Images will load again when needed.")}>Clear image cache</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void runCacheAction(() => cacheManagementService.clearLogs(), "Clear recent redacted logs from this Picom session?")}>Clear logs</button>
                <button type="button" className="settings-inline-action" onClick={() => void runCacheAction(() => cacheManagementService.clearAllNonEssentialCache(), "Clear all non-essential image metadata and redacted logs? Auth sessions, drafts, queued messages, and server data are preserved.")}>Clear all non-essential cache</button>
              </div>
              <div className="settings-status-card settings-feature-card" aria-label="Beta feedback and redacted logs">
                <span>Beta support</span>
                <strong>Feedback and redacted exports</strong>
                <small>User-facing feedback stays separate from redacted developer diagnostics. Prepared reports remain local until you explicitly copy/export them or open the support portal.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Issue type</strong>
                  <small>Used only in the local export payload.</small>
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
              <input className="advanced-settings-input" value={feedbackTitle} onChange={(event) => setFeedbackTitle(event.target.value)} placeholder="Short feedback title" aria-label="Feedback title" />
              <textarea className="advanced-settings-textarea" value={feedbackDescription} onChange={(event) => setFeedbackDescription(event.target.value)} placeholder="Describe what happened. Do not include passwords, tokens, or secrets." aria-label="Feedback description" rows={3} />
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
                <button type="button" className="settings-inline-action" onClick={() => void copyFeedbackReport()}>Copy feedback report</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={exportDiagnostics}>Export diagnostics JSON</button>
              </div>
              </section>
            </div>
          ) : (
            <div className="placeholder-panel">
              <strong>Settings section unavailable</strong>
              <p>Close and reopen Settings. If the problem persists, open Diagnostics and export a redacted report.</p>
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
