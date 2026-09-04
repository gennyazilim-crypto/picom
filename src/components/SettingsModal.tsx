import { profileMediaStore } from "../services/profileMedia/profileMediaStore";
import { ProfileDisplayName, ProfileUsername } from "./ProfileDisplayName";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SettingsModal.css";
import { notificationService } from "../services/notificationService";
import { notificationPolicyStateService, type NotificationPolicyState } from "../services/notificationPolicyStateService";
import type { Community } from "../types/community";
import { feedbackService, type FeedbackIssueType } from "../services/feedbackService";
import { authService } from "../services/authService";
import { menuService } from "../services/menuService";
import { settingsNavGroups, settingsSections, settingsService, type AccessibilitySettings, type AppearanceSettings, type InterfaceScale, type NotificationSettings, type ProfileSettings, type SettingsSection } from "../services/settingsService";
import { INTERFACE_SCALE_FACTORS, TEXT_SIZE_OPTIONS } from "../services/appearanceStudioPreferences";
import {
  searchSettingsCatalog,
  settingsSearchResultDescription,
  settingsSearchResultLabel,
  type SettingsSearchHit,
} from "../services/settings/settingsSearchIndex";
import { AccountSummarySection } from "./settings/AccountSummarySection";
import { LanguageRegionSection } from "./settings/LanguageRegionSection";
import { WindowsStartupSection } from "./settings/WindowsStartupSection";
import { StorageCacheSection } from "./settings/StorageCacheSection";
import { translateSettings, translateSettingsNavGroup, translateSettingsSection, listSettingsLanguageOptions, type SettingsI18nKey } from "../services/settings/settingsI18n";
import { appearanceService } from "../services/appearanceService";
import { statusPageService } from "../services/statusPageService";
import { dataSourceService } from "../services/dataSourceService";
import { maintenanceStatusService, type MaintenanceStatusSnapshot } from "../services/maintenanceStatusService";
import { sessionManagementService, type SessionDeviceSummary } from "../services/sessionManagementService";
import { socialAuthService, SOCIAL_AUTH_PROVIDER_ORDER, getSocialAuthProviderLabel, type SocialAuthProvider, type SocialProviderAccountState } from "../services/auth/socialAuthService";
import { accountDeletionService } from "../services/accountDeletionService";
import { dataExportService } from "../services/dataExportService";
import { accountCenterUrls, isAllowedAccountCenterUrl } from "../config/accountCenterUrls";
import { externalLinkService } from "../services/desktop/externalLinkService";
import { appLockService } from "../services/appLockService";
import { startupService } from "../services/startupService";
import { trayService } from "../services/trayService";
import { updateService } from "../services/updateService";
import { DEFAULT_COMPANION_PREFERENCES, getCompanionPreferences, updateCompanionPreferences } from "../features/companion/companionPreferences";
import type { CompanionDockEdge, CompanionPreferences } from "../features/companion/companionTypes";
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
import { AdminOperationsPanelRedirect } from "./AdminOperationsPanelRedirect";
import { canAccessAdminOperationsView } from "./AdminOperationsView";
import { adminOperationsService, type AdminOperationsAccess } from "../services/adminOperationsService";
import { analyticsService } from "../services/analyticsService";
import { crashReporterService } from "../services/crashReporterService";
import { AppIcon } from "./AppIcon";
import { KeyboardShortcutsSection } from "./KeyboardShortcutsSection";
import { UpdateSettingsSection } from "./settings/UpdateSettingsSection";
import { LegalSettingsSection } from "./settings/LegalSettingsSection";
import { mvpUiIconMap } from "./iconRegistry";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import type { LegalDocumentId } from "../data/legalDocuments";
import { FeedbackSection } from "./settings/FeedbackSection";
import { DiagnosticsSection } from "./settings/DiagnosticsSection";
import { LogsViewer } from "./settings/LogsViewer";
import { DeveloperPortalView } from "./DeveloperPortalView";
import { featureFlagService } from "../services/featureFlagService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";
type NotificationPreferenceKey = "mentions" | "replies" | "reactions" | "directMessages" | "communityAnnouncements" | "friendRequests" | "friendAcceptances" | "friendOnline" | "followedUsersLive" | "followedPublishersLive" | "incomingCalls" | "radioLive" | "radioReminders" | "podcastReleases" | "eventReminders";
const notificationPreferenceRows: ReadonlyArray<Readonly<{ key: NotificationPreferenceKey; labelKey: SettingsI18nKey; descriptionKey: SettingsI18nKey }>> = [
  { key: "mentions", labelKey: "notifications.pref.mentions.label", descriptionKey: "notifications.pref.mentions.description" },
  { key: "replies", labelKey: "notifications.pref.replies.label", descriptionKey: "notifications.pref.replies.description" },
  { key: "reactions", labelKey: "notifications.pref.reactions.label", descriptionKey: "notifications.pref.reactions.description" },
  { key: "directMessages", labelKey: "notifications.pref.directMessages.label", descriptionKey: "notifications.pref.directMessages.description" },
  { key: "communityAnnouncements", labelKey: "notifications.pref.communityAnnouncements.label", descriptionKey: "notifications.pref.communityAnnouncements.description" },
  { key: "friendRequests", labelKey: "notifications.pref.friendRequests.label", descriptionKey: "notifications.pref.friendRequests.description" },
  { key: "friendAcceptances", labelKey: "notifications.pref.friendAcceptances.label", descriptionKey: "notifications.pref.friendAcceptances.description" },
  { key: "friendOnline", labelKey: "notifications.pref.friendOnline.label", descriptionKey: "notifications.pref.friendOnline.description" },
  { key: "followedUsersLive", labelKey: "notifications.pref.followedUsersLive.label", descriptionKey: "notifications.pref.followedUsersLive.description" },
  { key: "followedPublishersLive", labelKey: "notifications.pref.followedPublishersLive.label", descriptionKey: "notifications.pref.followedPublishersLive.description" },
  { key: "incomingCalls", labelKey: "notifications.pref.incomingCalls.label", descriptionKey: "notifications.pref.incomingCalls.description" },
  { key: "radioLive", labelKey: "notifications.pref.radioLive.label", descriptionKey: "notifications.pref.radioLive.description" },
  { key: "radioReminders", labelKey: "notifications.pref.radioReminders.label", descriptionKey: "notifications.pref.radioReminders.description" },
  { key: "podcastReleases", labelKey: "notifications.pref.podcastReleases.label", descriptionKey: "notifications.pref.podcastReleases.description" },
  { key: "eventReminders", labelKey: "notifications.pref.eventReminders.label", descriptionKey: "notifications.pref.eventReminders.description" },
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
  onInterfaceScaleChange: (scale: InterfaceScale) => Promise<boolean>;
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
  onOpenPublisherApply?: () => void;
  onOpenPublisherDashboard?: () => void;
};

function getLiveBlockedDisplayName(userId: string, fallback: string): string {
  return profileMediaStore.getSnapshot(userId).record?.displayName?.trim() || fallback;
}

function getLiveBlockedUsername(userId: string, fallback: string): string {
  return (profileMediaStore.getSnapshot(userId).record?.username?.trim() || fallback).replace(/^@+/, "");
}

export function SettingsModal({ theme, accessibilitySettings, appearanceSettings, profileSettings, communities, onThemeChange, onAccessibilitySettingsChange, onInterfaceScaleChange, onAppearanceSettingsChange, onProfileSettingsChange, onClose, pushToast, onAccountDeletionRequested, onLogout, currentUsername, currentEmail, ownedCommunityCount, currentEmailVerifiedAt, requireEmailVerification = false, developerPortalContext, onOpenPanel, onOpenPublisherApply, onOpenPublisherDashboard }: SettingsModalProps) {
  const settingsLang = appearanceSettings.language;
  const ts = (key: SettingsI18nKey, params?: Record<string, string | number>) => translateSettings(key, settingsLang, params);
  const sectionLabel = (section: SettingsSection) => translateSettingsSection(section, settingsLang);
  const dialogRef = useDialogFocusTrap<HTMLElement>(onClose);
  const [active, setActive] = useState<SettingsSection>(settingsService.consumeInitialSection);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [highlightSelector, setHighlightSelector] = useState<string | null>(null);
  const [memberSinceIso, setMemberSinceIso] = useState<string | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [notificationStatus, setNotificationStatus] = useState(() => notificationService.getStatus());
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
  const [companionPreferences, setCompanionPreferences] = useState<CompanionPreferences | null>(null);
  const [companionSaveError, setCompanionSaveError] = useState("");
  const [companionBusy, setCompanionBusy] = useState(false);
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
  const visibleNavGroups = useMemo(
    () => settingsNavGroups
      .map((group) => ({
        ...group,
        sections: group.sections.filter((section) => visibleSections.includes(section)),
      }))
      .filter((group) => group.sections.length > 0),
    [visibleSections],
  );
  const searchHits = useMemo(
    () => searchSettingsCatalog(settingsQuery, appearanceSettings.language).filter((hit) => visibleSections.includes(hit.section)),
    [appearanceSettings.language, settingsQuery, visibleSections],
  );
  const profileCanSave = Boolean(profileDraft.displayName.trim()) && /^[a-z0-9._-]{3,32}$/.test(profileDraft.username);
  const profileSaveDisabled = profileSaving || profileHydrating || !profileCanSave;

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
  useEffect(() => {
    if (active !== "Notifications") return;
    void notificationService.refreshStatus().then(setNotificationStatus);
  }, [active]);
  useEffect(() => voiceService.subscribe(setVoiceSettingsSnapshot), []);
  useEffect(() => { void startupService.refreshNativeState().then(setStartupSettings); }, []);
  useEffect(() => { let active = true; void adminOperationsService.getAccess().then((access) => { if (active) setAdminOperationsAccess(access); }); return () => { active = false; }; }, []);

  const applySearchHit = useCallback((hit: SettingsSearchHit) => {
    setActive(hit.section);
    setSettingsQuery("");
    window.setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const target = hit.focusSelector
        ? root.querySelector<HTMLElement>(hit.focusSelector)
        : root.querySelector<HTMLElement>(".settings-content");
      target?.scrollIntoView({ behavior: accessibilitySettings.reducedMotion ? "auto" : "smooth", block: "center" });
      if (hit.focusSelector) {
        setHighlightSelector(hit.focusSelector);
        window.setTimeout(() => setHighlightSelector(null), 1600);
      }
    }, 40);
  }, [accessibilitySettings.reducedMotion]);

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
      setMemberSinceIso(null);
      setAccountUserId(null);
      return;
    }
    setLiveEmail(result.data.email ?? undefined);
    setLiveEmailVerifiedAt(result.data.emailVerifiedAt ?? null);
    setMemberSinceIso(result.data.createdAt?.trim() || null);
    setAccountUserId(result.data.id || null);
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
    if (active !== "Companion") return;
    let cancelled = false;
    void getCompanionPreferences().then((prefs) => {
      if (!cancelled) {
        setCompanionPreferences(prefs);
        setCompanionSaveError("");
      }
    }).catch(() => {
      if (!cancelled) {
        setCompanionPreferences({ ...DEFAULT_COMPANION_PREFERENCES });
        setCompanionSaveError("Desktop Companion bridge unavailable — showing local defaults.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const patchCompanion = async (patch: Partial<Omit<CompanionPreferences, "version">>) => {
    if (!companionPreferences) return;
    const previous = companionPreferences;
    setCompanionSaveError("");
    setCompanionBusy(true);
    setCompanionPreferences({ ...previous, ...patch, version: 1 });
    try {
      const next = await updateCompanionPreferences(patch);
      setCompanionPreferences(next);
      if (typeof patch.compactDensity === "boolean") {
        document.documentElement.dataset.companionDensity = next.compactDensity ? "compact" : "comfortable";
      }
      if (typeof patch.closeToTray === "boolean") {
        await trayService.setCloseToTrayEnabled(next.closeToTray);
      }
      if (typeof patch.alwaysOnTop === "boolean") {
        void window.picomDesktop?.companion?.setAlwaysOnTop?.(next.alwaysOnTop);
      }
      pushToast(ts("toast.companionSaved"), "success");
    } catch (reason) {
      setCompanionPreferences(previous);
      setCompanionSaveError(reason instanceof Error ? reason.message : ts("toast.companionSaveFailed"));
    } finally {
      setCompanionBusy(false);
    }
  };

  useEffect(() => {
    if (active === "Privacy & Safety") {
      void userBlockingService.refreshRemoteBlocks().then(setBlockedUsers);
      setNotificationPolicyState(notificationPolicyStateService.getSnapshot());
      void dataExportService.refreshStatus().then(setDataExportStatus);
      void Promise.all([
        userSafetyCenterService.refreshRemotePrivacy(),
        profilePrivacyService.getOwnSettings(),
        directSafetyService.getPrivacy(),
      ]).then(([safety, privacy, dmPrivacy]) => {
        setDirectMessagePrivacy(dmPrivacy);
        setProfilePrivacy(privacy);
        // Keep overview + toggle in sync: profile privacy is the source of truth for online status.
        setSafetySettings({
          ...safety,
          showOnlineStatus: privacy.showOnlineStatus,
        });
      });
    }
  }, [active]);

  const scrollToSettingsSection = (sectionId: string) => {
    const content = dialogRef.current?.querySelector<HTMLElement>(".settings-content");
    const target = dialogRef.current?.querySelector<HTMLElement>(`#${sectionId}`);
    if (!content || !target) return;
    const top = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 12;
    content.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  useEffect(() => activityPresenceService.subscribe(setActivitySnapshot), []);
  useEffect(() => activityPresenceService.subscribeEnabled(setAutoActivityEnabled), []);

  const updateAutoActivity = (next: boolean) => {
    const enabled = activityPresenceService.setEnabled(next);
    setAutoActivityEnabled(enabled);
    pushToast(
      enabled ? ts("toast.autoActivityEnabled") : ts("toast.autoActivityDisabled"),
      "info",
    );
  };

  const testNotification = async () => {
    const result = await notificationService.showTestNotification();
    setNotificationStatus(await notificationService.refreshStatus());
    pushToast(result.ok ? ts("toast.testNotificationSent") : result.reason ?? ts("toast.notificationUnavailable"), result.ok ? "success" : "error");
  };
  const requestNotificationPermission = async () => {
    const result = await notificationService.requestPermission();
    setNotificationStatus(await notificationService.refreshStatus());
    pushToast(result.ok ? ts("toast.notificationPermissionEnabled") : result.reason ?? ts("toast.notificationPermissionUnavailable"), result.ok ? "success" : "error");
  };
  const updateNotifications = (partial: Partial<NotificationSettings>) => {
    const next = settingsService.updateNotificationSettings(partial).notificationSettings;
    setNotificationSettings(next);
    pushToast(ts("toast.notificationPrefSaved"), "success");
  };
  const updateAccessibility = (partial: Partial<AccessibilitySettings>) => {
    const next = settingsService.updateAccessibilitySettings(partial).accessibilitySettings;
    onAccessibilitySettingsChange(next);
    pushToast(ts("toast.accessibilitySaved"), "success");
  };
  const updateInterfaceScale = async (scale: InterfaceScale) => {
    if (await onInterfaceScaleChange(scale)) pushToast(ts("toast.accessibilitySaved"), "success");
    else pushToast(ts("error.ipcUnavailable"), "error");
  };
  const updateAppearance = (partial: Partial<AppearanceSettings>) => {
    const next = settingsService.updateAppearanceSettings(partial).appearanceSettings;
    onAppearanceSettingsChange(next);
    if (partial.themeMode) onThemeChange(appearanceService.resolveTheme(next.themeMode));
    pushToast(ts("toast.appearanceSaved"), "success");
  };
  const updateSafetySettings = (partial: Partial<UserSafetySettings>) => {
    const next = userSafetyCenterService.updateSettings(partial);
    setSafetySettings(next);
    pushToast(ts("toast.privacySaved"), "success");
  };
  const updateFriendRequestPrivacy = async (policy: UserSafetySettings["whoCanSendFriendRequests"]) => {
    const result = await userSafetyCenterService.updateFriendRequestPrivacy(policy);
    setSafetySettings(result.settings);
    pushToast(result.ok ? ts("toast.friendRequestPrivacyUpdated") : ts("toast.friendRequestPrivacyFailed"), result.ok ? "success" : "error");
  };
  const unblockUser = async (userId: string, displayName: string, username: string) => {
    const ok = await userBlockingService.setBlockedUser({ userId, displayName, username }, false);
    setBlockedUsers(userBlockingService.listBlockedUsers());
    pushToast(ok ? ts("toast.userUnblocked", { name: displayName }) : ts("toast.userUnblockFailed", { name: displayName }), ok ? "success" : "error");
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
    pushToast(ts("toast.profileSaved"), "success");
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
    pushToast(ts("toast.profileDiscarded"), "info");
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
    pushToast(result.ok ? ts("toast.feedbackCopied") : result.reason, result.ok ? "success" : "error");
  };
  const exportDiagnostics = async () => {
    const result = await feedbackService.exportSupportDiagnostics(createFeedbackDraft());
    if (result.ok) {
      pushToast(result.canceled ? ts("toast.diagnosticsExportCanceled") : ts("toast.diagnosticsExported", { method: result.method }), result.canceled ? "info" : "success");
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
      pushToast(result.ok ? ts("toast.systemStatusOpened", { domain: statusPageService.getDisplayDomain() }) : ts("toast.systemStatusFallback"), result.ok ? "success" : "info");
    }
  };
  const updateLaunchOnStartup = async (enabled: boolean) => {
    const next = await startupService.setLaunchOnStartupEnabled(enabled);
    setStartupSettings(next);
    pushToast(next.error ? ts("toast.launchOnStartupUnavailable") : next.launchOnStartup ? ts("toast.launchOnStartupEnabled") : ts("toast.launchOnStartupDisabled"), next.error ? "error" : "success");
  };
  const updateProfilePrivacy=(partial:Partial<ProfilePrivacySettings>)=>{void profilePrivacyService.updateOwn(partial).then((result)=>{setProfilePrivacy(result.settings);if(result.ok)globalPresenceService.setSharingEnabled(result.settings.showOnlineStatus);pushToast(result.ok?ts("toast.profilePrivacyUpdated"):ts("toast.profilePrivacyFailed"),result.ok?"success":"error")});};
  const updateDirectMessagePrivacy = (value: DirectMessagePrivacy) => { void directSafetyService.updatePrivacy(value).then((result) => { setDirectMessagePrivacy(result.value); if (result.ok) setSafetySettings(userSafetyCenterService.updateSettings({ whoCanDmMe: result.value === "friends" ? "friends_only" : result.value === "no_one" ? "nobody" : "everyone" })); pushToast(result.ok ? ts("toast.dmPrivacyUpdated") : ts("toast.dmPrivacyFailed"), result.ok ? "success" : "error"); }); };
  const updateStartMinimizedToTray = async (enabled: boolean) => {
    const next = await startupService.setStartMinimizedToTray(enabled);
    setStartupSettings(next);
    pushToast(next.startMinimizedToTray === enabled ? ts("toast.startMinimizedSaved") : ts("toast.startMinimizedRequiresStartup"), next.startMinimizedToTray === enabled ? "info" : "error");
  };
  const updateLockAfterInactivity = (enabled: boolean) => {
    const next = appLockService.updateSettings({ lockAfterInactivityEnabled: enabled });
    setAppLockSettings(next);
    pushToast(enabled ? ts("toast.inactivityLockEnabled") : ts("toast.inactivityLockDisabled"), "info");
  };
  const runCacheAction = async (action: () => Promise<{ message: string; summary: CacheSummary }>, confirmation: string) => {
    if (!window.confirm(confirmation)) return;
    const result = await action();
    setCacheSummary(result.summary);
    pushToast(result.message, "success");
  };
  const resetLayoutState = () => {
    if (!window.confirm(ts("confirm.resetLayout"))) return;
    feedUiStateService.resetLayoutState();
    communityNavigationService.resetRouteMemory();
    pushToast(ts("toast.layoutReset"), "success");
  };
  const resetLocalSettings = () => {
    if (!window.confirm(ts("confirm.resetLocalSettings"))) return;
    settingsService.resetSettings();
    pushToast(ts("toast.localSettingsReset"), "success");
  };
  const restartInSafeMode = () => {
    if (!window.confirm(ts("confirm.safeModeRestart"))) return;
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
  const openAccountCenter = async (url: string) => {
    if (!isAllowedAccountCenterUrl(url)) {
      pushToast(ts("toast.unsafeAccountLink"), "error");
      return;
    }
    const result = await externalLinkService.openExternalUrl(url);
    if (!result.ok) {
      pushToast(externalLinkService.getUserFriendlyError(String(result.reason)), "error");
    }
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
    if (!liveEmail) { pushToast(ts("toast.noEmail"), "error"); return; }
    const result = await authService.requestPasswordReset(liveEmail);
    const message = result.ok ? result.data.message : result.error.message;
    setPasswordResetMessage(message);
    pushToast(message, result.ok ? "success" : "error");
  };
  const submitPasswordChange = async () => {
    if (passwordChangeBusy) return;
    if (newPassword !== confirmNewPassword) { pushToast(ts("toast.passwordMismatch"), "error"); return; }
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
  const disconnectSocialProvider = async (provider: SocialAuthProvider) => {
    setSocialProviderBusy(provider);
    const result = await socialAuthService.unlinkProvider(provider);
    setSocialProviderBusy(null);
    if (!result.ok) { pushToast(result.error, "error"); return; }
    pushToast(result.data.message, "success");
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
      pushToast(ts("toast.closeToTrayFailed"), "error");
      return;
    }
    setCloseToTrayEnabled(enabled);
    pushToast(enabled ? ts("toast.closeToTrayEnabled") : ts("toast.closeToTrayDisabled"), "success");
  };
  const cancelAccountDeletion = async () => {
    const result = await accountDeletionService.cancelDeletion();
    if (!result.ok) {
      pushToast(result.message, "error");
      return;
    }

    setAccountDeletionStatus(result.data);
    setAccountDeletionConfirmText("");
    pushToast(ts("toast.deletionCanceled"), "info");
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

    pushToast(ts("toast.dataExportDownloaded", { fileName: result.data.fileName }), "success");
  };

  useEffect(() => {
    if (!highlightSelector || !dialogRef.current) return;
    const el = dialogRef.current.querySelector<HTMLElement>(highlightSelector);
    if (!el) return;
    el.classList.add("settings-search-highlight");
    const timer = window.setTimeout(() => el.classList.remove("settings-search-highlight"), 1600);
    return () => {
      window.clearTimeout(timer);
      el.classList.remove("settings-search-highlight");
    };
  }, [highlightSelector, active]);

  const profileVisibilitySummary = () => {
    if (profilePrivacy.visibility === "everyone") return ts("privacy.visibilityStrong.public");
    if (profilePrivacy.visibility === "shared_communities") return ts("privacy.visibilityStrong.sharedCommunities");
    return ts("privacy.visibilityStrong.friendsOnly");
  };
  const dataExportSummary = () => {
    if (dataExportStatus.status === "ready") return ts("privacy.exportReady");
    if (dataExportStatus.status === "processing") return ts("privacy.exportProcessing");
    return ts("privacy.exportNotRequested");
  };
  const notificationDigestModeLabel = () => {
    if (notificationSettings.digestMode === "hourly_placeholder") return ts("notifications.digest.hourly");
    if (notificationSettings.digestMode === "daily_placeholder") return ts("notifications.digest.daily");
    return ts("notifications.digest.off");
  };

  return (
    <>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`settings-modal${navCollapsed ? " settings-modal--nav-collapsed" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="settings-nav" aria-label={ts("settings.title")}>
          <div className="settings-nav-header">
            <span className="eyebrow">{ts("settings.title")}</span>
            <h2 id="settings-modal-title">{ts("shell.desktopTitle")}</h2>
            <button
              type="button"
              className="settings-nav-collapse"
              aria-expanded={!navCollapsed}
              aria-controls="settings-nav-body"
              onClick={() => setNavCollapsed((value) => !value)}
            >
              {navCollapsed
                ? translateSettings("nav.showMenu", appearanceSettings.language)
                : translateSettings("nav.hideMenu", appearanceSettings.language)}
            </button>
          </div>
          <div id="settings-nav-body" className="settings-nav-body" hidden={navCollapsed}>
            <label className="settings-search">
              <span className="sr-only">{translateSettings("nav.searchPlaceholder", appearanceSettings.language)}</span>
              <input
                type="search"
                value={settingsQuery}
                onChange={(event) => setSettingsQuery(event.target.value)}
                placeholder={translateSettings("nav.searchPlaceholder", appearanceSettings.language)}
                autoComplete="off"
              />
            </label>
            {settingsQuery.trim() ? (
              <div className="settings-search-results" role="listbox" aria-label={translateSettings("nav.searchPlaceholder", appearanceSettings.language)}>
                {searchHits.length === 0 ? (
                  <p className="settings-search-empty">
                    {translateSettings("nav.searchEmpty", appearanceSettings.language, { query: settingsQuery.trim() })}
                  </p>
                ) : (
                  searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      role="option"
                      className="settings-search-hit"
                      onClick={() => applySearchHit(hit)}
                    >
                      <strong>{settingsSearchResultLabel(hit, appearanceSettings.language)}</strong>
                      <small>{sectionLabel(hit.section)} · {settingsSearchResultDescription(hit, appearanceSettings.language)}</small>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="settings-tabs">
                {visibleNavGroups.map((group) => (
                  <div key={group.id} className="settings-nav-group">
                    <p className="settings-nav-group-label">
                      {translateSettingsNavGroup(group.id, settingsLang)}
                    </p>
                    {group.sections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        className={active === section ? "active" : ""}
                        aria-current={active === section ? "page" : undefined}
                        onClick={(event) => {
                          setActive(section);
                          event.currentTarget.closest(".settings-modal")?.querySelector<HTMLElement>(".settings-content")?.scrollTo({ top: 0 });
                        }}
                      >
                        <span className="tab-dot" />{sectionLabel(section)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        <main className="settings-content">
          <div className="settings-content-toolbar">
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={onClose}>
              {translateSettings("nav.back", appearanceSettings.language)}
            </button>
            <button type="button" className="icon-button modal-close" aria-label={ts("settings.close")} onClick={onClose}>
              <AppIcon name={overlayIcons.close} size="lg" />
            </button>
          </div>
          <span className="eyebrow">{sectionLabel(active)}</span>
          <h2>{sectionLabel(active)}</h2>
          {active === "Appearance" ? (
            <div className="appearance-settings-stack">
              <p className="settings-section-description">{ts("appearance.description")}</p>
              <section className="appearance-theme-panel" aria-label={ts("appearance.themePanelAria")}>
                <div className="theme-grid">
                <button className={`theme-card ${appearanceSettings.themeMode === "light" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "light" })}>
                  <span className="theme-preview light-preview" />
                  <strong>{ts("theme.light")}</strong>
                  <small>{ts("theme.lightHint")}</small>
                </button>
                <button className={`theme-card ${appearanceSettings.themeMode === "dark" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "dark" })}>
                  <span className="theme-preview dark-preview" />
                  <strong>{ts("theme.dark")}</strong>
                  <small>{ts("theme.darkHint")}</small>
                </button>
                <button className={`theme-card ${appearanceSettings.themeMode === "system" ? "selected" : ""}`} onClick={() => updateAppearance({ themeMode: "system" })}>
                  <span className={`theme-preview ${theme === "dark" ? "dark-preview" : "light-preview"}`} />
                  <strong>{ts("theme.system")}</strong>
                  <small>{ts("theme.systemHint")}</small>
                </button>
                </div>
              </section>
              <div className="appearance-panels-grid">
              <div className="accessibility-card" aria-label={ts("appearance.accessibilityPanelAria")}>
                <strong>{ts("accessibility.title")}</strong>
                <p>{ts("accessibility.description")}</p>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{ts("accessibility.highContrast")}</strong>
                    <small>{ts("accessibility.highContrastHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.highContrast} onChange={(event) => updateAccessibility({ highContrast: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{ts("accessibility.reducedMotion")}</strong>
                    <small>{ts("accessibility.reducedMotionHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.reducedMotion} onChange={(event) => updateAccessibility({ reducedMotion: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{ts("accessibility.textSize")}</strong>
                    <small>{ts("accessibility.textSizeHint")}</small>
                  </span>
                  <select value={accessibilitySettings.textSize} onChange={(event) => updateAccessibility({ textSize: event.target.value as AccessibilitySettings["textSize"] })}>
                    {TEXT_SIZE_OPTIONS.map((textSize) => <option key={textSize} value={textSize}>{ts(`accessibility.textSize.${textSize === "extra-large" ? "extraLarge" : textSize}` as "accessibility.textSize.default" | "accessibility.textSize.large" | "accessibility.textSize.extraLarge")}</option>)}
                  </select>
                </label>
                {window.picomDesktop?.appearance?.setInterfaceScale ? <label className="settings-toggle-row"><span><strong>{ts("accessibility.interfaceScale")}</strong><small>{ts("accessibility.interfaceScaleHint")}</small></span><select value={accessibilitySettings.interfaceScale} onChange={(event) => void updateInterfaceScale(Number(event.target.value) as InterfaceScale)}>{INTERFACE_SCALE_FACTORS.map((scale) => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}</select></label> : null}
                <label className="settings-toggle-row">
                  <span>
                    <strong>{ts("accessibility.focusRing")}</strong>
                    <small>{ts("accessibility.focusRingHint")}</small>
                  </span>
                  <input type="checkbox" checked={accessibilitySettings.focusRingStrong} onChange={(event) => updateAccessibility({ focusRingStrong: event.target.checked })} />
                </label>
              </div>
              <div className="accessibility-card" aria-label={ts("appearance.languageDatePanelAria")}>
                {/* App language now lives in its own Settings -> Language & Region section. */}
                <label className="settings-toggle-row"><span><strong>{ts("appearance.density")}</strong><small>{ts("appearance.densityHint")}</small></span><select value={appearanceSettings.density} onChange={(event) => updateAppearance({ density: event.target.value as AppearanceSettings["density"] })}><option value="comfortable">{ts("appearance.option.comfortable")}</option><option value="compact">{ts("appearance.option.compact")}</option></select></label>
                <label className="settings-toggle-row"><span><strong>{ts("appearance.dateStyle")}</strong><small>{ts("appearance.dateStyleHint")}</small></span><select value={appearanceSettings.dateStyle} onChange={(event) => updateAppearance({ dateStyle: event.target.value as AppearanceSettings["dateStyle"] })}><option value="system">{ts("appearance.option.system")}</option><option value="numeric">{ts("appearance.option.numeric")}</option><option value="descriptive">{ts("appearance.option.descriptive")}</option></select></label>
                <label className="settings-toggle-row"><span><strong>{ts("appearance.timeFormat")}</strong><small>{ts("appearance.timeFormatHint")}</small></span><select value={appearanceSettings.timeFormat} onChange={(event) => updateAppearance({ timeFormat: event.target.value as AppearanceSettings["timeFormat"] })}><option value="system">{ts("appearance.option.system")}</option><option value="12h">12 {ts("appearance.option.hour")}</option><option value="24h">24 {ts("appearance.option.hour")}</option></select></label>
              </div>
              </div>
            </div>
          ) : active === "Language & Region" ? (
            <LanguageRegionSection
              appearanceSettings={appearanceSettings}
              onUpdateAppearance={updateAppearance}
            />
          ) : active === "Account" ? (
            <AccountSummarySection
              language={appearanceSettings.language}
              userId={accountUserId}
              displayName={profileSettings.displayName || profileDraft.displayName}
              username={profileSettings.username || currentUsername}
              email={liveEmail ?? currentEmail ?? null}
              emailVerifiedAt={liveEmailVerifiedAt ? dateTimeService.formatFullTimestamp(liveEmailVerifiedAt) : null}
              avatarUrl={profileDraft.avatarUrl ?? profileSettings.avatarUrl}
              memberSinceLabel={memberSinceIso ? dateTimeService.formatCompactDateTime(memberSinceIso) : "—"}
              planLabel={translateSettings("account.planFree", appearanceSettings.language)}
              accountStatusLabel={profileSettings.status || "online"}
              socialProviders={socialProviders}
              socialProviderBusy={socialProviderBusy}
              onConnectProvider={(provider) => void connectSocialProvider(provider)}
              onDisconnectProvider={(provider) => void disconnectSocialProvider(provider)}
              onOpenAccountCenter={(url) => void openAccountCenter(url)}
              onOpenPublisherApply={onOpenPublisherApply}
              onOpenPublisherDashboard={onOpenPublisherDashboard}
              onLogout={() => setLogoutConfirmationOpen(true)}
              onRefreshIdentity={() => void refreshAccountIdentity()}
              identityRefreshing={identityRefreshing}
            />
          ) : active === "Privacy & Safety" ? (
            <div className="privacy-settings-stack">
              <p className="settings-section-description">{ts("privacy.description")}</p>

              <nav className="privacy-settings-jump" aria-label={ts("privacy.jumpAria")}>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("privacy-reach")}>{ts("privacy.jump.reach")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("privacy-visibility")}>{ts("privacy.jump.visibility")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("privacy-blocking")}>{ts("privacy.jump.blocking")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("privacy-data")}>{ts("privacy.jump.data")}</button>
              </nav>

              <section className="privacy-settings-section" id="privacy-reach">
                <h3 className="privacy-settings-section-title">{ts("privacy.reach.title")}</h3>
                <label className="settings-toggle-row">
                  <span><strong>{ts("privacy.friendRequests.label")}</strong><small>{ts("privacy.friendRequests.hint")}</small></span>
                  <select value={safetySettings.whoCanSendFriendRequests} onChange={(event) => void updateFriendRequestPrivacy(event.target.value as UserSafetySettings["whoCanSendFriendRequests"])}>
                    <option value="everyone">{ts("privacy.option.everyone")}</option>
                    <option value="community_members">{ts("privacy.option.communityMembers")}</option>
                    <option value="friends_of_friends">{ts("privacy.option.friendsOfFriends")}</option>
                    <option value="nobody">{ts("privacy.option.nobody")}</option>
                  </select>
                </label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.dm.label")}</strong><small>{ts("privacy.dm.hint")}</small></span><select value={directMessagePrivacy} onChange={(event) => updateDirectMessagePrivacy(event.target.value as DirectMessagePrivacy)}><option value="everyone">{ts("privacy.option.everyone")}</option><option value="friends">{ts("privacy.option.friendsOnly")}</option><option value="no_one">{ts("privacy.option.noOne")}</option></select></label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("privacy.onlineStatus.label")}</strong><small>{ts("privacy.onlineStatus.hint")}</small></span>
                  <input type="checkbox" checked={profilePrivacy.showOnlineStatus} onChange={(event) => updateProfilePrivacy({ showOnlineStatus: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("privacy.readReceipts.label")}</strong><small>{ts("privacy.readReceipts.hint")}</small></span>
                  <input type="checkbox" checked={safetySettings.enableReadReceipts} onChange={(event) => updateSafetySettings({ enableReadReceipts: event.target.checked })} />
                </label>
              </section>

              <section className="privacy-settings-section" id="privacy-visibility">
                <h3 className="privacy-settings-section-title">{ts("privacy.visibility.title")}</h3>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.profileAudience.label")}</strong><small>{ts("privacy.profileAudience.hint")}</small></span><select value={profilePrivacy.visibility} onChange={(event) => updateProfilePrivacy({ visibility: event.target.value as ProfilePrivacySettings["visibility"] })}><option value="everyone">{ts("privacy.option.everyone")}</option><option value="shared_communities">{ts("privacy.option.sharedCommunities")}</option><option value="friends">{ts("privacy.option.friendsOnly")}</option></select></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showLocation.label")}</strong><small>{ts("privacy.showLocation.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showLocation} onChange={(event) => updateProfilePrivacy({ showLocation: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showTimezone.label")}</strong><small>{ts("privacy.showTimezone.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showTimezone} onChange={(event) => updateProfilePrivacy({ showTimezone: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showActivity.label")}</strong><small>{ts("privacy.showActivity.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showActivity} onChange={(event) => updateProfilePrivacy({ showActivity: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showMedia.label")}</strong><small>{ts("privacy.showMedia.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showMedia} onChange={(event) => updateProfilePrivacy({ showMedia: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showCommunities.label")}</strong><small>{ts("privacy.showCommunities.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showCommunities} onChange={(event) => updateProfilePrivacy({ showCommunities: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showFriends.label")}</strong><small>{ts("privacy.showFriends.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showFriends} onChange={(event) => updateProfilePrivacy({ showFriends: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showFollows.label")}</strong><small>{ts("privacy.showFollows.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showFollows} onChange={(event) => updateProfilePrivacy({ showFollows: event.target.checked })} /></label>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.showAudio.label")}</strong><small>{ts("privacy.showAudio.hint")}</small></span><input type="checkbox" checked={profilePrivacy.showAudio} onChange={(event) => updateProfilePrivacy({ showAudio: event.target.checked })} /></label>
              </section>

              <section className="privacy-settings-section" id="privacy-overview">
                <h3 className="privacy-settings-section-title">{ts("privacy.overview.title")}</h3>
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label={ts("privacy.safetySummary.aria")}>
                  <span>{ts("privacy.safetySummary.title")}</span>
                  <strong>{userSafetyCenterService.getPrivacySummary(blockedUsers.length)}</strong>
                  <small>{ts("privacy.safetySummary.hint")}</small>
                </div>
                <div className="settings-status-card settings-feature-card" aria-label={ts("privacy.publicVisibility.aria")}>
                  <span>{ts("privacy.publicVisibility.title")}</span>
                  <strong>{profileVisibilitySummary()}</strong>
                  <small>{ts("privacy.publicVisibility.hint")}</small>
                </div>
                <div className="security-card-grid" aria-label={ts("privacy.metrics.aria")}>
                  <button type="button" className="security-card security-card--action" onClick={() => scrollToSettingsSection("privacy-blocking")}>
                    <span>{ts("privacy.metrics.blockedUsers")}</span>
                    <strong>{blockedUsers.length}</strong>
                    <small>{ts("privacy.metrics.blockedHint")}</small>
                  </button>
                  <button type="button" className="security-card security-card--action" onClick={() => scrollToSettingsSection("privacy-reach")}>
                    <span>{ts("privacy.metrics.onlineStatus")}</span>
                    <strong>{profilePrivacy.showOnlineStatus ? ts("common.visible") : ts("common.hidden")}</strong>
                    <small>{ts("privacy.metrics.onlineHint")}</small>
                  </button>
                  <button type="button" className="security-card security-card--action" onClick={() => scrollToSettingsSection("privacy-reach")}>
                    <span>{ts("privacy.metrics.readReceipts")}</span>
                    <strong>{safetySettings.enableReadReceipts ? ts("common.enabled") : ts("common.disabled")}</strong>
                    <small>{ts("privacy.metrics.readReceiptsHint")}</small>
                  </button>
                  <button type="button" className="security-card security-card--action" onClick={() => scrollToSettingsSection("privacy-data")}>
                    <span>{ts("privacy.metrics.accountData")}</span>
                    <strong>{dataExportSummary()}</strong>
                    <small>{accountDeletionStatus.requested ? ts("privacy.deletionPending") : ts("privacy.noDeletionRequest")}</small>
                  </button>
                </div>
              </section>

              <section className="privacy-settings-section" id="privacy-blocking">
                <h3 className="privacy-settings-section-title">{ts("privacy.blocking.title")}</h3>
                <div className="settings-status-card settings-feature-card" aria-label={ts("privacy.blockedList.aria")}>
                  <span>{ts("privacy.blockedUsers.title")}</span>
                  <strong>{blockedUsers.length ? ts("privacy.blockedManageLocally") : ts("privacy.noBlockedUsers")}</strong>
                  <small>{ts("privacy.blockedListHint")}</small>
                  <div className="privacy-list">
                    {blockedUsers.length ? blockedUsers.map((blockedUser) => (
                      <article key={blockedUser.userId} className="privacy-list-item">
                        <div>
                          <strong><ProfileDisplayName userId={blockedUser.userId} fallback={blockedUser.displayName} /></strong>
                          <small>@<ProfileUsername userId={blockedUser.userId} fallback={blockedUser.username} /> · {ts("privacy.blockedSuffix", { when: dateTimeService.formatMessageTime(blockedUser.blockedAt) })}</small>
                        </div>
                        <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void unblockUser(blockedUser.userId, getLiveBlockedDisplayName(blockedUser.userId, blockedUser.displayName), getLiveBlockedUsername(blockedUser.userId, blockedUser.username))}>{ts("common.unblock")}</button>
                      </article>
                    )) : (
                      <article className="privacy-list-item privacy-list-item--empty">
                        <div>
                          <strong>{ts("privacy.blockListClear.title")}</strong>
                          <small>{ts("privacy.blockListClear.hint")}</small>
                        </div>
                      </article>
                    )}
                  </div>
                </div>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.muteAll.label")}</strong><small>{ts("privacy.muteAll.hint")}</small></span><input type="checkbox" checked={notificationSettings.muted} onChange={(event) => updateNotifications({ muted: event.target.checked })} /></label>
                <div className="settings-status-card settings-feature-card" aria-label={ts("privacy.mutedScopes.aria")}>
                  <span>{ts("privacy.mutedScopes.title")}</span>
                  <strong>{notificationPolicyState.mutedCommunityIds.length + notificationPolicyState.mutedChannelIds.length ? ts("privacy.mutedScopesManage") : ts("privacy.noMutedScopesSummary")}</strong>
                  <small>{ts("privacy.mutedScopesHint")}</small>
                  <div className="privacy-list">
                    {notificationPolicyState.mutedCommunityIds.map((communityId) => {
                      const community = communities.find((candidate) => candidate.id === communityId);
                      return (
                        <article key={`community-${communityId}`} className="privacy-list-item">
                          <div><strong>{community?.name ?? ts("privacy.unavailableCommunity")}</strong><small>{ts("privacy.communityMute")}</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setCommunityMuted(communityId, false))}>{ts("common.unmute")}</button>
                        </article>
                      );
                    })}
                    {notificationPolicyState.mutedChannelIds.map((channelId) => {
                      const community = communities.find((candidate) => candidate.categories.some((category) => category.channels.some((channel) => channel.id === channelId)));
                      const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === channelId);
                      return (
                        <article key={`channel-${channelId}`} className="privacy-list-item">
                          <div><strong>#{channel?.name ?? ts("privacy.unavailableChannel")}</strong><small>{ts("privacy.channelMuteSuffix", { community: community?.name ?? ts("privacy.unavailableCommunity") })}</small></div>
                          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setNotificationPolicyState(notificationPolicyStateService.setChannelMuted(channelId, false))}>{ts("common.unmute")}</button>
                        </article>
                      );
                    })}
                    {!notificationPolicyState.mutedCommunityIds.length && !notificationPolicyState.mutedChannelIds.length ? (
                      <article className="privacy-list-item privacy-list-item--empty">
                        <div><strong>{ts("privacy.noMutedScopes.title")}</strong><small>{ts("privacy.noMutedScopes.hint")}</small></div>
                      </article>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="privacy-settings-section" id="privacy-data">
                <h3 className="privacy-settings-section-title">{ts("privacy.data.title")}</h3>
                <label className="settings-toggle-row"><span><strong>{ts("privacy.analytics.label")}</strong><small>{ts("privacy.analytics.hint")}</small></span><input type="checkbox" checked={analyticsEnabled} onChange={(event) => { const enabled = analyticsService.setEnabled(event.target.checked); setAnalyticsEnabled(enabled); pushToast(enabled ? ts("toast.analyticsEnabled") : ts("toast.analyticsDisabled"), "success"); }} /></label>
                <div className="settings-status-card settings-feature-card retention-user-notice" aria-label={ts("privacy.retention.aria")}>
                  <span>{ts("privacy.retention.title")}</span>
                  <strong>{ts("privacy.retention.strong")}</strong>
                  <small>{ts("privacy.retention.body1")}</small>
                  <small>{ts("privacy.retention.body2")}</small>
                </div>
                <div className="settings-status-card settings-feature-card" aria-label={ts("privacy.safetyTips.aria")}>
                  <span>{ts("privacy.safetyTips.title")}</span>
                  <strong>{ts("privacy.safetyTips.strong")}</strong>
                  <small>{ts("privacy.safetyTips.hint")}</small>
                </div>
              </section>

              <section className="privacy-settings-section privacy-settings-section--compact privacy-settings-actions--dock" aria-label={ts("privacy.actions.aria")}>
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" onClick={() => void openAccountCenter(`${accountCenterUrls.origin}/account/data`)}>{dataExportStatus.status === "processing" ? ts("privacy.exportInAccountCenter") : ts("privacy.requestExport")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void openAccountCenter(`${accountCenterUrls.origin}/account/delete`)}>{ts("privacy.accountDeletion")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { setActive("Advanced"); pushToast(ts("toast.reportProblemHint"), "info"); }}>{ts("privacy.reportProblem")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => updateSafetySettings(userSafetyCenterService.resetSettings())}>{ts("privacy.resetSafety")}</button>
                </div>
              </section>
            </div>
          ) : active === "Profile" ? (
            <div className="profile-settings-stack">
              <p className="settings-section-description">{ts("profile.description")}</p>
              {profileHydrating ? <p className="settings-section-description" aria-live="polite">{ts("profile.loading")}</p> : null}

              <section className="profile-settings-section">
                <header className="profile-settings-section-head">
                  <h3 className="profile-settings-section-title">{ts("profile.photos.title")}</h3>
                  <p>{ts("profile.photos.intro")}</p>
                </header>
                <ProfileMediaEditor
                  displayName={profileDraft.displayName || currentUsername}
                  avatarUrl={profileDraft.avatarUrl}
                  coverUrl={profileDraft.coverUrl}
                  onProfileUpdated={(profile) => applyProfileSummary(profile, { mediaOnly: true })}
                  onNotice={pushToast}
                  language={settingsLang}
                />
              </section>

              <section className="profile-settings-section">
                <header className="profile-settings-section-head">
                  <h3 className="profile-settings-section-title">{ts("profile.identity.title")}</h3>
                  <p>{ts("profile.public.intro")}</p>
                </header>
                <div className="profile-settings-form">
                  <label className="profile-settings-field">
                    <span>{ts("profile.username")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.username}
                      minLength={3}
                      maxLength={32}
                      pattern="[a-z0-9._-]+"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value.toLowerCase() })}
                      placeholder={ts("profile.placeholder.username")}
                    />
                    <small>{ts("profile.usernameHint")}</small>
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.displayName")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.displayName}
                      maxLength={80}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })}
                      placeholder={ts("profile.placeholder.displayName")}
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.bio")}</span>
                    <textarea
                      className="advanced-settings-input"
                      value={profileDraft.bio}
                      maxLength={500}
                      rows={4}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })}
                      placeholder={ts("profile.placeholder.bio")}
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.location")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.location}
                      maxLength={120}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })}
                      placeholder={ts("profile.placeholder.location")}
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.timezone")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.timezone}
                      maxLength={80}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, timezone: event.target.value })}
                      placeholder={ts("profile.placeholder.timezone")}
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.preferredLanguage")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.preferredLanguage}
                      maxLength={48}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, preferredLanguage: event.target.value })}
                      placeholder={ts("profile.placeholder.preferredLanguage")}
                    />
                  </label>
                  <label className="profile-settings-field">
                    <span>{ts("profile.tags")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.tags.join(", ")}
                      disabled={profileHydrating}
                      onChange={(event) => setProfileDraft({
                        ...profileDraft,
                        tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
                      })}
                      placeholder={ts("profile.placeholder.tags")}
                    />
                    <small>{ts("profile.tagsHint")}</small>
                  </label>
                </div>
              </section>

              <section className="profile-settings-section">
                <header className="profile-settings-section-head">
                  <h3 className="profile-settings-section-title">{ts("profile.presence.title")}</h3>
                  <p>{ts("profile.presence.intro")}</p>
                </header>
                <div className="profile-settings-form">
                  <div className="profile-settings-field">
                    <span>{ts("profile.presenceField")}</span>
                    <div className="profile-presence-segment" role="group" aria-label={ts("presence.aria")}>
                      {(["online", "idle", "busy", "offline"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`profile-presence-option${profileDraft.status === status ? " is-active" : ""}`}
                          aria-pressed={profileDraft.status === status}
                          onClick={() => setProfileDraft({ ...profileDraft, status })}
                        >
                          {ts(
                            status === "online"
                              ? "presence.online"
                              : status === "idle"
                                ? "presence.idle"
                                : status === "busy"
                                  ? "presence.busy"
                                  : "presence.offline",
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="profile-settings-field">
                    <span>{ts("profile.statusMessage")}</span>
                    <input
                      className="advanced-settings-input"
                      value={profileDraft.statusText}
                      maxLength={120}
                      disabled={autoActivityEnabled || profileHydrating}
                      onChange={(event) => setProfileDraft({ ...profileDraft, statusText: event.target.value })}
                      placeholder={ts("profile.placeholder.statusMessage")}
                    />
                    <small>{autoActivityEnabled ? ts("profile.autoActivityHint") : ts("profile.saveStatusHint")}</small>
                  </label>
                </div>
              </section>

              <section className="profile-settings-section profile-settings-section--compact profile-settings-actions" aria-label={ts("profile.saveProfile")}>
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" disabled={profileSaveDisabled} onClick={() => void saveProfileSettings()}>{profileSaving ? ts("profile.saving") : profileHydrating ? ts("profile.loadingProfile") : ts("profile.saveProfile")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={profileSaving || profileHydrating} onClick={resetProfileSettings}>{ts("profile.discardChanges")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={profileSaving} onClick={() => setActive("Privacy & Safety")}>{ts("profile.openPrivacy")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void openAccountCenter(`${accountCenterUrls.origin}/account/profile`)}>{ts("profile.openOnWeb")}</button>
                </div>
              </section>

              <ProfileVerificationRequestCard />
            </div>
          ) : active === "Notifications" ? (
            <div className="notification-settings-stack">
              <p className="settings-section-description">{ts("notifications.description")}</p>

              <nav className="notification-settings-jump" aria-label={ts("notifications.categories.aria")}>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("notifications-runtime")}>{ts("notifications.jump.runtime")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("notifications-activity")}>Activity</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("notifications-quiet")}>{ts("notifications.quiet.title")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("notifications-email")}>Email</button>
              </nav>

              <section className="notification-settings-section" id="notifications-runtime">
                <h3 className="notification-settings-section-title">{ts("notifications.runtime.title")}</h3>
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label={ts("notifications.runtime.aria")}>
                  <span>{ts("notifications.runtimeSupport")}</span>
                  <strong>{notificationStatus.nativeBridgeAvailable ? ts("notifications.runtime.systemControlled") : notificationStatus.supported ? ts("notifications.runtime.available") : ts("notifications.runtime.unavailable")}</strong>
                  <small>{notificationStatus.nativeBridgeAvailable ? ts("notifications.runtime.systemControlledHint") : `Permission: ${notificationStatus.permission}. Account preferences synchronize when Supabase mode is available.`}</small>
                  {notificationStatus.permission === "denied" ? (
                    <small role="status">{translateSettings("notifications.permissionDenied", appearanceSettings.language)}</small>
                  ) : null}
                  <small role="note">{translateSettings("notifications.securityLocked", appearanceSettings.language)}</small>
                  <div className="settings-actions-row">
                    {notificationStatus.requiresPermission ? <button type="button" className="settings-inline-action" onClick={() => void requestNotificationPermission()}>Allow desktop notifications</button> : null}
                    <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!notificationSettings.enabled || !notificationSettings.nativeDesktopEnabled || !(notificationStatus.capability === "native-available" || notificationStatus.capability === "browser-granted")} onClick={() => void testNotification()}>{ts("notifications.sendTest")}</button>
                  </div>
                </div>
                <p className="settings-nav-group-label">{translateSettings("notifications.deviceGroup", appearanceSettings.language)}</p>
                <label className="settings-toggle-row">
                  <span><strong>{translateSettings("notifications.enableAll", appearanceSettings.language)}</strong><small>{ts("notifications.masterHint")}</small></span>
                  <input type="checkbox" checked={notificationSettings.enabled} onChange={(event) => updateNotifications({ enabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{translateSettings("notifications.nativeDesktop", appearanceSettings.language)}</strong><small>{ts("notifications.nativeHint")}</small></span>
                  <input type="checkbox" disabled={!notificationSettings.enabled || !notificationStatus.supported} checked={notificationSettings.nativeDesktopEnabled} onChange={(event) => updateNotifications({ nativeDesktopEnabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{translateSettings("notifications.sound", appearanceSettings.language)}</strong><small>{ts("notifications.soundHint")}</small></span>
                  <input type="checkbox" disabled={!notificationSettings.enabled || !notificationSettings.nativeDesktopEnabled || !notificationStatus.supported} checked={notificationSettings.soundEnabled} onChange={(event) => updateNotifications({ soundEnabled: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{translateSettings("notifications.dnd", appearanceSettings.language)}</strong><small>{ts("notifications.dndHint")}</small></span>
                  <input type="checkbox" checked={notificationPolicyState.doNotDisturb} onChange={(event) => setNotificationPolicyState(notificationPolicyStateService.setDoNotDisturb(event.target.checked))} />
                </label>
              </section>

              <section className="notification-settings-section" id="notifications-activity">
                <h3 className="notification-settings-section-title">{translateSettings("notifications.accountGroup", appearanceSettings.language)}</h3>
                <div className="settings-status-card settings-feature-card" aria-label={ts("notifications.categories.aria")}>
                  <span>{ts("notifications.categories.title")}</span>
                  <strong>{ts("notifications.categories.strong")}</strong>
                  <small>{ts("notifications.categories.hint")}</small>
                </div>
                {notificationPreferenceRows.map((preference) => (
                  <label className="settings-toggle-row" key={preference.key}>
                    <span><strong>{ts(preference.labelKey)}</strong><small>{ts(preference.descriptionKey)}</small></span>
                    <input type="checkbox" disabled={!notificationSettings.enabled} checked={notificationSettings[preference.key]} onChange={(event) => updateNotifications({ [preference.key]: event.target.checked })} />
                  </label>
                ))}
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.pref.messagePreview.label")}</strong><small>{ts("notifications.pref.messagePreview.description")}</small></span>
                  <input type="checkbox" disabled={!notificationSettings.enabled || !notificationSettings.directMessages} checked={notificationSettings.showMessagePreview} onChange={(event) => updateNotifications({ showMessagePreview: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.mentionsOnly.label")}</strong><small>{ts("notifications.mentionsOnly.hint")}</small></span>
                  <input type="checkbox" checked={notificationSettings.mentionsOnly} onChange={(event) => updateNotifications({ mentionsOnly: event.target.checked })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.digest.label")}</strong><small>{ts("notifications.digest.hint", { mode: notificationDigestModeLabel() })}</small></span>
                  <select value={notificationSettings.digestMode} onChange={(event) => updateNotifications({ digestMode: event.target.value as typeof notificationSettings.digestMode })}>
                    <option value="off">{ts("notifications.digest.off")}</option>
                    <option value="hourly_placeholder">{ts("notifications.digest.hourly")}</option>
                    <option value="daily_placeholder">{ts("notifications.digest.daily")}</option>
                  </select>
                </label>
              </section>

              <section className="notification-settings-section" id="notifications-quiet">
                <h3 className="notification-settings-section-title">{ts("notifications.quiet.title")}</h3>
                <div className="settings-status-card settings-feature-card" aria-label={ts("notifications.quiet.aria")}>
                  <span>{ts("notifications.schedule")}</span>
                  <strong>{notificationSettings.quietHours.enabled ? `${notificationSettings.quietHours.startTime} – ${notificationSettings.quietHours.endTime}` : "Disabled"}</strong>
                  <small>{ts("notifications.quietTimezoneHint")}</small>
                </div>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.enableQuiet.label")}</strong><small>{ts("notifications.enableQuiet.hint")}</small></span>
                  <input type="checkbox" checked={notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, enabled: event.target.checked } })} />
                </label>
                <div className="notification-settings-time-grid">
                  <label className="notification-settings-time-field">
                    <span>{ts("notifications.startTime")}</span>
                    <input className="notification-settings-time-input" type="time" value={notificationSettings.quietHours.startTime} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, startTime: event.target.value } })} />
                    <small>{ts("notifications.startTimeHint")}</small>
                  </label>
                  <label className="notification-settings-time-field">
                    <span>{ts("notifications.endTime")}</span>
                    <input className="notification-settings-time-input" type="time" value={notificationSettings.quietHours.endTime} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, endTime: event.target.value } })} />
                    <small>{ts("notifications.endTimeHint")}</small>
                  </label>
                </div>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.applyTo.label")}</strong><small>{ts("notifications.applyTo.hint")}</small></span>
                  <select value={notificationSettings.quietHours.applyTo} disabled={!notificationSettings.quietHours.enabled} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, applyTo: event.target.value as typeof notificationSettings.quietHours.applyTo } })}>
                    <option value="all_notifications">{ts("notifications.applyTo.all")}</option>
                    <option value="normal_messages_only">{ts("notifications.applyTo.normalOnly")}</option>
                    <option value="sounds_only">{ts("notifications.applyTo.soundsOnly")}</option>
                  </select>
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.allowMentionsQuiet.label")}</strong><small>{ts("notifications.allowMentionsQuiet.hint")}</small></span>
                  <input type="checkbox" disabled={!notificationSettings.quietHours.enabled} checked={notificationSettings.quietHours.allowMentions} onChange={(event) => updateNotifications({ quietHours: { ...notificationSettings.quietHours, allowMentions: event.target.checked } })} />
                </label>
                <label className="settings-toggle-row">
                  <span><strong>{ts("notifications.allowMentionsMuted.label")}</strong><small>{ts("notifications.allowMentionsMuted.hint")}</small></span>
                  <input type="checkbox" checked={notificationSettings.allowMentionsFromMutedScopes} onChange={(event) => updateNotifications({ allowMentionsFromMutedScopes: event.target.checked })} />
                </label>
              </section>

              <EmailPreferencesPanel language={settingsLang} />

              <section className="notification-settings-section" id="notifications-muted">
                <h3 className="notification-settings-section-title">{ts("notifications.muted.title")}</h3>
                <div className="settings-status-card settings-feature-card" aria-label={ts("notifications.muted.aria")}>
                  <span>{ts("notifications.muted.title")}</span>
                  <strong>{notificationPolicyState.mutedCommunityIds.length + notificationPolicyState.mutedChannelIds.length ? "Muted communities and channels" : "No muted communities or channels"}</strong>
                  <small>{ts("notifications.mutedHint")}</small>
                  <div className="privacy-list">
                    {notificationPolicyState.mutedCommunityIds.map((communityId) => {
                      const community = communities.find((candidate) => candidate.id === communityId);
                      return (
                        <article key={`notifications-community-${communityId}`} className="privacy-list-item">
                          <div><strong>{community?.name ?? "Unavailable community"}</strong><small>{ts("privacy.communityMute")}</small></div>
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
                        <div><strong>{ts("privacy.noMutedScopes.title")}</strong><small>{ts("privacy.noMutedScopes.hint")}</small></div>
                      </article>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          ) : active === "Voice & Video" ? (
            <div className="voice-settings-stack">
              <p className="settings-section-description">{ts("voice.section.description")}</p>

              <nav className="voice-settings-jump" aria-label={ts("voice.jump.aria")}>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("voice-settings-live")}>{ts("voice.live.title")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("voice-settings-microphone")}>{ts("voice.live.microphone")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("voice-settings-output")}>{ts("voice.jump.output")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("voice-settings-noise")}>{ts("voice.jump.noise")}</button>
              </nav>

              <section className="voice-settings-section" id="voice-settings-live">
                <h3 className="voice-settings-section-title">{ts("voice.live.title")}</h3>
                <div className="security-card-grid" aria-label={ts("voice.live.aria")}>
                  <article className="security-card"><span>{ts("voice.live.connection")}</span><strong>{voiceSettingsSnapshot.status.replace(/_/g, " ")}</strong><small>{voiceSettingsSnapshot.roomName ? ts("voice.live.roomPrefix", { room: voiceSettingsSnapshot.roomName }) : ts("voice.live.joinHint")}</small></article>
                  <article className="security-card"><span>{ts("voice.live.microphone")}</span><strong>{voiceSettingsSnapshot.muted ? ts("voice.live.muted") : ts("voice.live.unmuted")}</strong><small>{ts("voice.live.shortcutMic")}</small></article>
                  <article className="security-card"><span>{ts("voice.live.incoming")}</span><strong>{voiceSettingsSnapshot.deafened ? ts("voice.live.deafened") : ts("voice.live.listening")}</strong><small>{ts("voice.live.shortcutDeafen")}</small></article>
                  <article className="security-card"><span>{ts("voice.live.screenShare")}</span><strong>{voiceSettingsSnapshot.screenSharing ? ts("voice.live.sharing") : ts("voice.live.notSharing")}</strong><small>{ts("voice.live.sourceHint")}</small></article>
                </div>
                <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action" disabled={voiceSettingsSnapshot.status !== "connected"} onClick={() => void voiceService.setMuted(!voiceSettingsSnapshot.muted)}>{voiceSettingsSnapshot.muted ? ts("voice.live.unmuteMic") : ts("voice.live.muteMic")}</button>
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={voiceSettingsSnapshot.status !== "connected"} onClick={() => { const result = voiceService.setDeafened(!voiceSettingsSnapshot.deafened); if (!result.ok) pushToast(result.error.message, "error"); }}>{voiceSettingsSnapshot.deafened ? ts("voice.live.undeafen") : ts("voice.live.deafen")}</button>
                </div>
                {voiceSettingsSnapshot.status !== "connected" ? (
                  <small className="voice-settings-live-hint" role="status">{ts("voice.live.hintDisconnected")}</small>
                ) : null}
              </section>

              <VoiceDeviceSelection language={settingsLang} />
            </div>
          ) : active === "Companion" ? (
            <div className="advanced-settings-stack">
              <p className="settings-section-description">{ts("companion.description")}</p>
              {!companionPreferences ? (
                <div className="settings-status-card settings-feature-card" aria-label={ts("companion.loading.aria")}>
                  <span>Companion</span>
                  <strong>{companionSaveError || "Loading preferences…"}</strong>
                  <small>{ts("companion.loading.hint")}</small>
                </div>
              ) : (
                <>
                  <section className="advanced-settings-section">
                    <h3 className="advanced-settings-section-title">{ts("advanced.jump.startup")}</h3>
                    <div className="settings-status-card settings-feature-card" aria-label={ts("companion.startup.aria")}>
                      <span>{ts("companion.openAs")}</span>
                      <strong>{companionPreferences.startupMode === "companion" ? "Companion Mode" : "Main window"}</strong>
                      <small>{ts("companion.startupHint")}</small>
                      <div className="settings-actions-row">
                        <button type="button" className={`settings-inline-action${companionPreferences.startupMode === "main" ? "" : " settings-inline-action--ghost"}`} disabled={companionBusy} onClick={() => void patchCompanion({ startupMode: "main" })}>{ts("companion.mainMode")}</button>
                        <button type="button" className={`settings-inline-action${companionPreferences.startupMode === "companion" ? "" : " settings-inline-action--ghost"}`} disabled={companionBusy} onClick={() => void patchCompanion({ startupMode: "companion" })}>Companion</button>
                      </div>
                    </div>
                  </section>
                  <section className="advanced-settings-section">
                    <h3 className="advanced-settings-section-title">Behavior</h3>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.alwaysOnTop.label")}</strong><small>{ts("companion.alwaysOnTop.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.alwaysOnTop)} disabled={companionBusy} onChange={(event) => void patchCompanion({ alwaysOnTop: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.smartCollapse.label")}</strong><small>{ts("companion.smartCollapse.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.smartCollapse)} disabled={companionBusy} onChange={(event) => void patchCompanion({ smartCollapse: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.dockAutoHide.label")}</strong><small>{ts("companion.dockAutoHide.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.dockAutoHide)} disabled={companionBusy} onChange={(event) => void patchCompanion({ dockAutoHide: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.gamingAutoDetect.label")}</strong><small>{ts("companion.gamingAutoDetect.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.gamingAutoDetect)} disabled={companionBusy} onChange={(event) => void patchCompanion({ gamingAutoDetect: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.notifications.label")}</strong><small>{ts("companion.notifications.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.showNotifications)} disabled={companionBusy} onChange={(event) => void patchCompanion({ showNotifications: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.closeToTray.label")}</strong><small>{ts("companion.closeToTray.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.closeToTray)} disabled={companionBusy} onChange={(event) => void patchCompanion({ closeToTray: event.target.checked })} /></label>
                    <label className="settings-toggle-row"><span><strong>{ts("companion.compactDensity.label")}</strong><small>{ts("companion.compactDensity.hint")}</small></span><input type="checkbox" checked={Boolean(companionPreferences.compactDensity)} disabled={companionBusy} onChange={(event) => void patchCompanion({ compactDensity: event.target.checked })} /></label>
                  </section>
                  <section className="advanced-settings-section">
                    <h3 className="advanced-settings-section-title">Appearance</h3>
                    <div className="settings-status-card settings-feature-card" aria-label={ts("companion.windowOpacity.aria")}>
                      <span>{ts("companion.windowOpacity")}</span>
                      <strong>{Math.round((companionPreferences.windowOpacity ?? 1) * 100)}%</strong>
                      <input type="range" min={85} max={100} step={1} value={Math.round((companionPreferences.windowOpacity ?? 1) * 100)} aria-label={ts("companion.windowOpacity.aria")} disabled={companionBusy} onChange={(event) => void patchCompanion({ windowOpacity: Number(event.target.value) / 100 })} />
                    </div>
                    <div className="settings-status-card settings-feature-card" aria-label={ts("companion.dockEdge.aria")}>
                      <span>{ts("companion.dockEdge")}</span>
                      <strong>{companionPreferences.dockEdge}</strong>
                      <div className="settings-actions-row">
                        {(["left", "right", "top", "bottom"] as CompanionDockEdge[]).map((edge) => (
                          <button key={edge} type="button" className={`settings-inline-action${companionPreferences.dockEdge === edge ? "" : " settings-inline-action--ghost"}`} disabled={companionBusy} onClick={() => void patchCompanion({ dockEdge: edge })}>{edge}</button>
                        ))}
                      </div>
                    </div>
                    <div className="settings-status-card settings-feature-card" aria-label={ts("companion.theme.aria")}>
                      <span>{ts("companion.theme")}</span>
                      <strong>{companionPreferences.theme}</strong>
                      <div className="settings-actions-row">
                        {(["system", "light", "dark"] as const).map((theme) => (
                          <button key={theme} type="button" className={`settings-inline-action${companionPreferences.theme === theme ? "" : " settings-inline-action--ghost"}`} disabled={companionBusy} onClick={() => void patchCompanion({ theme })}>{theme}</button>
                        ))}
                      </div>
                    </div>
                  </section>
                  <section className="advanced-settings-section">
                    <h3 className="advanced-settings-section-title">Shortcuts</h3>
                    <div className="security-card-grid" aria-label={ts("companion.shortcuts.aria")}>
                      <article className="security-card"><span>{ts("companion.shortcut.open")}</span><strong>Ctrl + Shift + C</strong><small>{ts("companion.shortcut.openHint")}</small></article>
                      <article className="security-card"><span>{ts("companion.shortcut.quickReply")}</span><strong>Ctrl + Shift + Y</strong><small>{ts("companion.shortcut.quickReplyHint")}</small></article>
                      <article className="security-card"><span>{ts("voice.live.muteMic")}</span><strong>Ctrl + Shift + M</strong><small>{ts("companion.shortcut.muteMicHint")}</small></article>
                    </div>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action" onClick={() => { void window.picomDesktop?.companion?.openWindow?.({ type: "home" }); pushToast(ts("toast.companionHomeRequested"), "info"); }}>{ts("companion.openCompanion")}</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { void window.picomDesktop?.companion?.openWindow?.({ type: "gaming" }); pushToast(ts("toast.gamingOverlayRequested"), "info"); }}>{ts("companion.openGaming")}</button>
                    </div>
                  </section>
                  {companionSaveError ? <p className="settings-section-description" role="alert">{companionSaveError}</p> : null}
                </>
              )}
            </div>
          ) : active === "Keyboard Shortcuts" ? (
            <KeyboardShortcutsSection />
          ) : active === "Windows & Startup" ? (
            <WindowsStartupSection language={appearanceSettings.language} pushToast={pushToast} />
          ) : active === "Storage" ? (
            <StorageCacheSection language={appearanceSettings.language} pushToast={pushToast} />
          ) : active === "Update" ? (
            <UpdateSettingsSection language={settingsLang} onOpenAdvanced={() => setActive("Advanced")} onNotice={pushToast} />
          ) : active === "Diagnostics" ? (
            <div className="diagnostics-settings-stack">
              <p className="settings-section-description">{ts("diagnostics.shell.description")}</p>
              <nav className="diagnostics-settings-jump" aria-label={ts("diagnostics.shell.jump.aria")}>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("diagnostics-support")}>{ts("diagnostics.shell.jump.support")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("diagnostics-snapshot")}>{ts("diagnostics.shell.jump.snapshot")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("diagnostics-logs")}>{ts("diagnostics.shell.jump.logs")}</button>
              </nav>
              <FeedbackSection language={settingsLang} onNotice={pushToast} />
              <DiagnosticsSection language={settingsLang} onNotice={pushToast} />
              <LogsViewer language={settingsLang} onNotice={pushToast} />
            </div>
          ) : active === "Admin Operations" ? (
            onOpenPanel ? (
              <AdminOperationsPanelRedirect onOpenPanel={() => { onClose(); onOpenPanel(); }} />
            ) : (
              <AdminOperationsPanelRedirect onOpenPanel={onClose} />
            )
          ) : active === "Legal" ? (
            <LegalSettingsSection language={settingsLang} onOpenDocument={setOpenLegalDocument} />
          ) : active === "Advanced" ? (
            <div className="advanced-settings-stack">
              <p className="settings-section-description">{ts("advanced.description")}</p>
              <nav className="advanced-settings-jump" aria-label={ts("advanced.jump.aria")}>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("advanced-runtime")}>{ts("advanced.jump.runtime")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("advanced-recovery")}>{ts("advanced.jump.recovery")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("advanced-updates")}>{ts("advanced.jump.updates")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("advanced-startup")}>{ts("advanced.jump.startup")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => scrollToSettingsSection("advanced-cache")}>{ts("advanced.jump.cache")}</button>
              </nav>

              <section className="advanced-settings-section" id="advanced-runtime">
                <h3 className="advanced-settings-section-title">{ts("advanced.runtime.title")}</h3>
                {developerPortalAvailable ? <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.devPortal.aria")}><span>{ts("advanced.devPortal.title")}</span><strong>{ts("advanced.devPortal.strong")}</strong><small>{ts("advanced.devPortal.hint")}</small><button type="button" className="settings-inline-action" onClick={() => setDeveloperPortalOpen(true)}>{ts("advanced.devPortal.open")}</button></div> : null}
                <div className="settings-status-card settings-feature-card settings-feature-card--highlight about-picom-card" aria-label={ts("advanced.about.aria")}>
                  <span>
                    {ts("advanced.about.title")}
                    <span className="picom-beta-badge">
                      {appConfig.build.commitShort === "local" ? "Beta · Local development" : "Beta · Frontend preview"}
                    </span>
                  </span>
                  <strong>{appConfig.name} {appConfig.version} ({appConfig.releaseChannel})</strong>
                  <small>
                    {appConfig.environment === "development" || appConfig.build.commitShort === "local"
                      ? "Local desktop preview build. Packaged release metadata is injected at CI/build time."
                      : "Desktop build metadata for this Picom package."}
                    {" "}Channel {appConfig.releaseChannel} · scope {appConfig.releaseScope} · {appConfig.identifier}.
                  </small>
                  <dl className="about-picom-meta">
                    <div>
                      <dt>Build</dt>
                      <dd title={appConfig.build.date}>{appConfig.build.date === "development" ? "Local / unstamped" : appConfig.build.date}</dd>
                    </div>
                    <div>
                      <dt>Commit</dt>
                      <dd title={appConfig.build.commit}>{appConfig.build.commitShort === "local" ? "Local workspace" : appConfig.build.commitShort}</dd>
                    </div>
                    <div>
                      <dt>{ts("advanced.jump.runtime")}</dt>
                      <dd>{typeof window !== "undefined" && window.picomDesktop ? "Electron desktop" : "Browser preview"}</dd>
                    </div>
                    <div>
                      <dt>{ts("advanced.about.apiCompat")}</dt>
                      <dd title={appConfig.build.backendApiCompatibilityVersion}>
                        {appConfig.build.backendApiCompatibilityVersion === "mvp-placeholder"
                          ? "Desktop MVP (placeholder)"
                          : appConfig.build.backendApiCompatibilityVersion}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="security-card-grid" aria-label={ts("advanced.runtimeGrid.aria")}>
                  <article className="security-card"><span>Release</span><strong>{appConfig.releaseChannel}</strong><small>{appConfig.version} / {appConfig.build.commitShort} / {appConfig.build.date}</small></article>
                  <article className="security-card"><span>{ts("advanced.card.dataSource")}</span><strong>{appConfig.dataSource}</strong><small>{appConfig.runtimeTarget} on {navigator.platform || "unknown platform"}</small></article>
                  <article className="security-card"><span>{ts("advanced.card.localData")}</span><strong>Manifest v{localDataMigrationStatus.manifestSchemaVersion} / settings v{localDataMigrationStatus.settingsSchemaVersion}</strong><small>{localDataMigrationStatus.lastMigrationOk === false ? "Last migration needs Safe Mode review" : localDataMigrationStatus.lastMigratedAt ? `Migrated ${dateTimeService.formatFullTimestamp(localDataMigrationStatus.lastMigratedAt)}` : "Migration manifest will be created at startup"}</small></article>
                  <article className="security-card"><span>{ts("advanced.card.recoveryBackups")}</span><strong>{localDataMigrationStatus.retainedBackupCount}</strong><small>{ts("advanced.card.localDataHint")}</small></article>
                </div>
              </section>

              <section className="advanced-settings-section" id="advanced-recovery">
                <h3 className="advanced-settings-section-title">{ts("advanced.recovery.title")}</h3>
                <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.safeMode.aria")}>
                  <span>{ts("advanced.safeMode.title")}</span><strong>{safeModeState.active ? `Active: ${safeModeState.reason ?? "manual"}` : "Available for troubleshooting"}</strong><small>{ts("advanced.safeMode.hint")}</small>
                  <div className="settings-actions-row"><button type="button" className="settings-inline-action" onClick={restartInSafeMode}>{ts("advanced.restartSafeMode")}</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={resetLayoutState}>{ts("advanced.resetLayout")}</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={resetLocalSettings}>{ts("advanced.resetLocalSettings")}</button></div>
                </div>
                {import.meta.env.DEV ? <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { trayService.simulate("settings"); pushToast(ts("toast.traySimulated"), "info"); }}>Simulate tray settings</button> : null}
                <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.nativeMenu.aria")}>
                  <span>{ts("advanced.nativeMenu.title")}</span>
                  <strong>{ts("advanced.nativeMenu.strong")}</strong>
                  <small>{ts("advanced.nativeMenu.hint")}</small>
                </div>
                {import.meta.env.DEV ? <div className="settings-actions-row">
                  <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => menuService.triggerPlaceholderAction("open-command-palette")}>Simulate menu palette</button>
                  <button
                    type="button"
                    className="settings-inline-action settings-inline-action--ghost"
                    aria-label={ts("advanced.resetFirstLaunch.aria")}
                    onClick={() => {
                      if (!window.confirm(ts("confirm.resetFirstLaunch"))) return;
                      settingsService.resetFirstLaunchSetup();
                      pushToast(ts("toast.firstLaunchReset"), "success");
                    }}
                  >
                    Reset first-launch setup
                  </button>
                </div> : null}
                <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.systemStatus.aria")}>
                  <span>{ts("advanced.systemStatus.title")}</span>
                  <strong>{systemStatusOpen ? (maintenanceSnapshot.status === "operational" ? "Panel open · operational" : maintenanceSnapshot.status === "degraded" ? "Panel open · degraded" : "Panel open · maintenance") : "In-app health check"}</strong>
                  <small>{ts("advanced.systemStatus.hint")}</small>
                  <div className="settings-actions-row">
                    <button type="button" className="settings-inline-action" onClick={() => void openSystemStatus()}>{systemStatusOpen ? "Refresh system status" : "Open system status"}</button>
                    {systemStatusOpen ? <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSystemStatusOpen(false)}>Hide</button> : null}
                  </div>
                </div>
                {systemStatusOpen ? (
                  <div className="settings-status-card settings-feature-card system-status-panel" aria-label={ts("advanced.liveStatus.aria")} aria-live="polite">
                    <span>{ts("advanced.systemStatus.title")}</span>
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
                      <div><dt>{ts("advanced.status.row.lastChecked")}</dt><dd>{maintenanceSnapshot.checkedAt ? new Date(maintenanceSnapshot.checkedAt).toLocaleString() : "—"}</dd></div>
                    </dl>
                    <div className="settings-actions-row">
                      <button type="button" className="settings-inline-action" disabled={systemStatusChecking} onClick={() => void refreshSystemStatus()}>{systemStatusChecking ? "Checking…" : "Refresh"}</button>
                      <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setSystemStatusOpen(false)}>Hide</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="advanced-settings-section" id="advanced-updates">
                <h3 className="advanced-settings-section-title">{ts("advanced.updates.title")}</h3>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.desktopUpdates.aria")}>
                <span>{ts("advanced.desktopUpdates.title")}</span>
                <strong>{(updateState.status ?? "idle").split("_").join(" ")}</strong>
                <small>{updateState.message}</small>
                <small>Version {updateState.appVersion} on {updateState.releaseChannel}. Full update controls live in the Update settings section.</small>
                <button type="button" className="settings-inline-action" onClick={() => setActive("Update")}>{ts("advanced.openUpdateSettings")}</button>
              </div>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.supportDiagnostics.aria")}>
                <span>{ts("advanced.supportDiagnostics.title")}</span>
                <strong>{ts("advanced.supportDiagnostics.strong")}</strong>
                <small>{ts("advanced.supportDiagnostics.hint")}</small>
                <button type="button" className="settings-inline-action" onClick={() => setActive("Diagnostics")}>{ts("advanced.openDiagnostics")}</button>
              </div>
              <label className="settings-toggle-row"><span><strong>{ts("advanced.crashReports.label")}</strong><small>{ts("advanced.crashReports.hint")}</small></span><input type="checkbox" checked={crashReportingEnabled} onChange={(event) => { const enabled = crashReporterService.setEnabled(event.target.checked); setCrashReportingEnabled(enabled); pushToast(enabled ? ts("toast.crashReportingEnabled") : ts("toast.crashReportingDisabled"), "success"); }} /></label>
              {import.meta.env.DEV ? <div className="settings-actions-row"><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { const record = crashReporterService.captureException(new Error("Picom development crash report test"), { source: "settings-test", authorization: "Bearer redaction-test" }); pushToast(record ? ts("toast.crashTestCaptured") : ts("toast.crashTestEnableFirst"), record ? "success" : "info"); }}>Capture test error safely</button><button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => { const status = crashReporterService.getStatus(); pushToast(ts("toast.crashQueueStatus", { count: status.queuedLocalRecords }), "info"); }}>Show crash report status</button></div> : null}
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.statusPage.aria")}>
                <span>{ts("advanced.statusPage.title")}</span>
                <strong>{statusPageService.isConfigured() ? statusPageService.getDisplayDomain() : "Not configured"}</strong>
                <small>Optional VITE_STATUS_PAGE_URL can point to a public non-sensitive status page when one is configured.</small>
              </div>
              </section>

              <section className="advanced-settings-section" id="advanced-startup">
                <h3 className="advanced-settings-section-title">{ts("advanced.startup.title")}</h3>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.launchStartup.aria")}>
                <span>{ts("advanced.launchStartup.title")}</span>
                <strong>{startupSettings.launchOnStartup ? ts("common.enabled") : ts("common.disabled")}</strong>
                <small>{ts("advanced.launchStartup.hint", { mode: startupSettings.mode })}</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.launchPicom.label")}</strong>
                  <small>{ts("advanced.launchPicom.hint")}</small>
                </span>
                <input type="checkbox" checked={startupSettings.launchOnStartup} disabled={startupSettings.mode !== "native_ready"} onChange={(event) => void updateLaunchOnStartup(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.startMinimized.label")}</strong>
                  <small>{ts("advanced.startMinimized.hint")}</small>
                </span>
                <input type="checkbox" checked={startupSettings.startMinimizedToTray} disabled={startupSettings.mode !== "native_ready" || !startupSettings.launchOnStartup} onChange={(event) => void updateStartMinimizedToTray(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.closeToTray.label")}</strong>
                  <small>{ts("advanced.closeToTray.hint")}</small>
                </span>
                <input type="checkbox" checked={closeToTrayEnabled} onChange={(event) => void updateCloseToTray(event.target.checked)} />
              </label>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.appLock.aria")}>
                <span>{ts("advanced.appLock.title")}</span>
                <strong>Ctrl + Shift + L</strong>
                <small>{ts("advanced.appLock.hint")}</small>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setActive("Keyboard Shortcuts")}>{ts("advanced.openKeyboardShortcuts")}</button>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.inactivityLock.label")}</strong>
                  <small>{ts("advanced.inactivityLock.hint")}</small>
                </span>
                <input type="checkbox" checked={appLockSettings.lockAfterInactivityEnabled} onChange={(event) => updateLockAfterInactivity(event.target.checked)} disabled aria-disabled="true" />
              </label>
              </section>

              <section className="advanced-settings-section" id="advanced-cache">
                <h3 className="advanced-settings-section-title">{ts("advanced.cache.title")}</h3>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.cache.aria")}>
                <span>{ts("advanced.cache.titleCard")}</span>
                <strong>{cacheSummary ? `${cacheSummary.imageCacheEntries}/${cacheSummary.imageCacheMaxEntries} image cache entries` : "Loading cache summary"}</strong>
                <small>
                  Storage estimate: {formatCacheSize(cacheSummary?.estimatedUsageBytes ?? null)}
                  {cacheSummary?.estimatedQuotaBytes ? ` of ${formatCacheSize(cacheSummary.estimatedQuotaBytes)}` : ""}.
                  Auth sessions and drafts are preserved.
                </small>
              </div>
              <div className="security-card-grid" aria-label={ts("advanced.cache.grid.aria")}>
                <article className="security-card">
                  <span>Images</span>
                  <strong>{cacheSummary?.imageCacheEntries ?? 0}</strong>
                  <small>{ts("advanced.cache.imagesHint")}</small>
                </article>
                <article className="security-card">
                  <span>{ts("diagnostics.shell.jump.logs")}</span>
                  <strong>{cacheSummary?.recentLogEntries ?? 0}</strong>
                  <small>{ts("advanced.cache.logsHint")}</small>
                </article>
                <article className="security-card">
                  <span>Messages</span>
                  <strong>{cacheSummary?.messageCacheStatus.replace(/_/g, " ") ?? "not persisted"}</strong>
                  <small>Picom does not persist a separate message cache; server messages and local drafts are untouched.</small>
                </article>
                <article className="security-card">
                  <span>{ts("advanced.cache.offline")}</span>
                  <strong>{cacheSummary ? `${cacheSummary.pendingQueuedMessages} queued` : "memory only"}</strong>
                  <small>{ts("advanced.cache.offlineHint")}</small>
                </article>
              </div>
              <div className="settings-actions-row">
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void refreshCacheSummary()}>{ts("advanced.refreshCacheSummary")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void runCacheAction(() => cacheManagementService.clearImageCache(), "Clear Picom's in-memory image metadata cache? Images will load again when needed.")}>{ts("advanced.clearImageCache")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void runCacheAction(() => cacheManagementService.clearLogs(), "Clear recent redacted logs from this Picom session?")}>{ts("advanced.clearLogs")}</button>
                <button type="button" className="settings-inline-action" onClick={() => void runCacheAction(() => cacheManagementService.clearAllNonEssentialCache(), "Clear all non-essential image metadata and redacted logs? Auth sessions, drafts, queued messages, and server data are preserved.")}>{ts("advanced.clearAllCache")}</button>
              </div>
              <div className="settings-status-card settings-feature-card" aria-label={ts("advanced.betaSupport.aria")}>
                <span>{ts("advanced.betaSupport.title")}</span>
                <strong>{ts("advanced.betaSupport.strong")}</strong>
                <small>{ts("advanced.betaSupport.hint")}</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.feedback.issueType")}</strong>
                  <small>{ts("advanced.feedback.issueTypeHint")}</small>
                </span>
                <select value={feedbackIssueType} onChange={(event) => setFeedbackIssueType(event.target.value as FeedbackIssueType)} aria-label={ts("advanced.feedback.issueTypeAria")}>
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
              <input className="advanced-settings-input" value={feedbackTitle} onChange={(event) => setFeedbackTitle(event.target.value)} placeholder={ts("advanced.feedback.titlePlaceholder")} aria-label={ts("advanced.feedback.titleAria")} />
              <textarea className="advanced-settings-textarea" value={feedbackDescription} onChange={(event) => setFeedbackDescription(event.target.value)} placeholder={ts("advanced.feedback.descPlaceholder")} aria-label={ts("advanced.feedback.descAria")} rows={3} />
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.feedback.includeDiagnostics")}</strong>
                  <small>{ts("advanced.feedback.includeDiagnosticsHint")}</small>
                </span>
                <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>{ts("advanced.feedback.includeLogs")}</strong>
                  <small>{ts("advanced.feedback.includeLogsHint")}</small>
                </span>
                <input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)} />
              </label>
              <div className="settings-actions-row">
                <button type="button" className="settings-inline-action" onClick={() => void copyFeedbackReport()}>{ts("advanced.copyFeedbackReport")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void exportDiagnostics()}>{ts("advanced.exportDiagnosticsJson")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setActive("Diagnostics")}>{ts("advanced.openDiagnosticsFeedback")}</button>
              </div>
              </section>
            </div>
          ) : (
            <div className="placeholder-panel">
              <strong>{ts("settings.sectionUnavailable")}</strong>
              <p>
                {settingsSections.includes(active)
                  ? ts("settings.sectionUnavailableDetail", { section: sectionLabel(active) })
                  : ts("settings.sectionUnavailableGeneric")}
              </p>
              <div className="settings-actions-row">
                <button type="button" className="settings-inline-action" onClick={() => setActive("Account")}>{ts("common.openAccount")}</button>
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setActive("Diagnostics")}>{ts("common.openDiagnostics")}</button>
              </div>
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
