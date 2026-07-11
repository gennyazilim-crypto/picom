import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { currentUserId, mockCommunities } from "./data/mockCommunities";
import { currentUserFollowedUserIds, mockPopularUserIds } from "./data/mockFollows";
import { mockMentionItems } from "./data/mockMentions";
import { getMockProfileForMember } from "./data/mockProfiles";
import { mockDirectConversations } from "./data/mockDirectMessages";
import { mockFriendState } from "./data/mockFriends";
import { mockUpcomingEvents } from "./data/mockEvents";
import { communityEventService, type CreateCommunityEventInput, type UpdateCommunityEventInput } from "./services/communityEventService";
import { mockFollowedUserStories } from "./data/mockStories";
import { mockFollowSuggestions } from "./data/mockFollowSuggestions";
import type { Attachment, ChannelCategory, Community, Member, Message } from "./types/community";
import type { DirectConversation, DirectMessage, DirectMessageAttachment, DirectSharedMediaItem } from "./types/directMessages";
import type { FriendState, FriendViewTab } from "./types/friends";
import { friendPresenceService } from "./services/friends/friendPresenceService";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "./types/mentions";
import type { ProfileActivityItem, UserProfile } from "./types/profile";
import type { FollowedUserStory } from "./types/stories";
import type { CommunityAccess } from "./types/communityAccess";
import type { OnboardingCompletion } from "./types/onboarding";
import { AppIcon } from "./components/AppIcon";
import { mvpUiIconMap } from "./components/iconRegistry";
import { DesktopAppShell } from "./components/DesktopAppShell";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { ServerRail } from "./components/ServerRail";
import { CommunitySidebar } from "./components/CommunitySidebar";
import { ChatMain } from "./components/ChatMain";
import { MemberSidebar } from "./components/MemberSidebar";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { UserProfilePopover } from "./components/UserProfilePopover";
import { DesktopContextMenu } from "./components/DesktopContextMenu";
import { TermsReacceptPrompt } from "./components/legal/TermsReacceptPrompt";
import { ToastStack } from "./components/ToastStack";
import { GlobalAudioMiniPlayer } from "./components/audio/GlobalAudioMiniPlayer";
import { podcastService } from "./services/audio/podcastService";
import { LoginScreen } from "./components/LoginScreen";
import { RegisterScreen } from "./components/RegisterScreen";
import { FirstLaunchSetup } from "./components/firstLaunch/FirstLaunchSetup";
import { MaintenanceStatusBanner, MaintenanceStatusView } from "./components/MaintenanceStatusView";
import { CreateCommunityModal, type CreateCommunityFormValue, type CreateCommunitySubmitResult } from "./components/CreateCommunityModal";
import { CreateChannelModal, type CreateChannelFormValue } from "./components/CreateChannelModal";
import { DeleteChannelModal, EditChannelModal, type EditChannelFormValue } from "./components/ChannelManagementModals";
import { MemberModerationModal } from "./components/MemberModerationModal";
import type { Channel } from "./types/community";
import type { MemberModerationAction } from "./types/memberModeration";
import { AppLockScreen } from "./components/AppLockScreen";
import { MentionRightPanel } from "./components/MentionRightPanel";
import { useDirectMessageRealtime } from "./hooks/useDirectMessageRealtime";
import type { DirectReactionRow } from "./services/directMessages/directRealtimeService";
import { directMessageService } from "./services/directMessages/directMessageService";
import { directAttachmentUploadService } from "./services/directMessages/directAttachmentUploadService";
import { relationshipService } from "./services/relationshipService";
import { mentionFeedService } from "./services/mentionFeedService";
import { storyService } from "./services/storyService";
import { feedUiStateService } from "./services/feed/feedUiStateService";
import { feedMentionCacheService } from "./services/feed/feedMentionCacheService";
import { feedRealtimeService } from "./services/feed/feedRealtimeService";
import { feedQueryService } from "./services/feed/feedQueryService";
import { profileVerificationService } from "./services/profileVerificationService";
import { defaultProfilePrivacyProjection,profilePrivacyService,restrictedProfilePrivacyProjection } from "./services/profilePrivacyService";
import { profileActivityService } from "./services/profileActivityService";
import type { ProfilePrivacyProjection } from "./types/profilePrivacy";
import type { VerificationBadge, VerificationSummary } from "./types/verification";
import { getCommunityVerificationSummary, getUserVerificationSummary } from "./utils/verificationHelpers";
import { VerifiedBadge } from "./components/VerifiedBadge";
import { rankFollowSuggestions } from "./utils/followSuggestionRanking";
import { advancedSearchService, type AdvancedSearchResult } from "./services/advancedSearchService";
import { termsAcceptanceService } from "./services/termsAcceptanceService";
import { savedMessageService, type SavedMessageRecord } from "./services/savedMessageService";
import { SafeModeBanner } from "./components/SafeModeBanner";
import { CrashRecoveryDialog } from "./components/CrashRecoveryDialog";
import { NotificationPermissionPrompt } from "./components/NotificationPermissionPrompt";
import { NotificationCenterPopover } from "./components/NotificationCenterPopover";
import { notificationCenterService, type NotificationCenterItem } from "./services/notificationCenterService";
import { notificationPolicyStateService } from "./services/notificationPolicyStateService";
import { clipboardService } from "./services/clipboardService";
import { deepLinkService, type DeepLinkAction } from "./services/deepLinkService";
import { diagnosticsService } from "./services/diagnosticsService";
import { feedbackService } from "./services/feedbackService";
import { loggingService } from "./services/loggingService";
import { menuService, type MenuActionPayload } from "./services/menuService";
import { dataSourceService } from "./services/dataSourceService";
import { settingsService, type AppearanceSettings, type ThemeMode } from "./services/settingsService";
import { appearanceService } from "./services/appearanceService";
import { shortcutService } from "./services/shortcutService";
import { trayService, type TrayStatus } from "./services/trayService";
import { maintenanceStatusService } from "./services/maintenanceStatusService";
import { crashRecoveryService, type CrashRecoveryRecord } from "./services/crashRecoveryService";
import { safeModeService, type SafeModeState } from "./services/safeModeService";
import { statusPageService } from "./services/statusPageService";
import { authService } from "./services/authService";
import { appConfig } from "./config/appConfig";
import { socialAuthService } from "./services/auth/socialAuthService";
import { onboardingService } from "./services/onboarding/onboardingService";
import { communityService } from "./services/communityService";
import { communityNavigationService, type CommunityShellView } from "./services/community/communityNavigationService";
import { resolveCommunityJoinLanding } from "./services/community/communityJoinRoutingService";
import type { CommunityInvitePreview, InviteAcceptanceStatus } from "./services/community/communityInviteService";
import { communityMembershipService } from "./services/community/communityMembershipService";
import { channelService } from "./services/channelService";
import { channelCategoryService } from "./services/channelCategoryService";
import { privateChannelPermissionService } from "./services/privateChannelPermissionService";
import { membersService } from "./services/membersService";
import { messageService, type MessageSummary } from "./services/messageService";
import { reactionService } from "./services/reactionService";
import { messageSendQueueService } from "./services/messageSendQueueService";
import { messageHistoryExportService } from "./services/messageHistoryExportService";
import { messageModerationFilterService } from "./services/messageModerationFilterService";
import { offlineSyncConflictService } from "./services/offlineSyncConflictService";
import { ReportModal, type ReportModalTarget } from "./components/ReportModal";
import { InvitePeopleModal } from "./components/CommunityInviteModals";
import { CreatePollModal } from "./components/CreatePollModal";
import type { CreatePollDraft } from "./types/polls";
import { pollService } from "./services/pollService";
import { threadService } from "./services/threadService";
import type { ThreadRecord } from "./types/threads";
import { ThreadPanel } from "./components/ThreadPanel";
import { analyticsService } from "./services/analyticsService";
import { crashReporterService } from "./services/crashReporterService";
import { userBlockingService } from "./services/userBlockingService";
import { userSafetyCenterService } from "./services/userSafetyCenterService";
import { notificationService } from "./services/notificationService";
import type { VoiceServiceSnapshot } from "./services/voiceService";
import type { ActiveVoiceRoomSummary } from "./types/voiceDiscovery";
import { activeVoiceRoomDiscoveryService } from "./services/activeVoiceRoomDiscoveryService";
import {
  notificationPermissionOnboardingService,
  type NotificationPermissionOnboardingTrigger,
  type NotificationPermissionPrompt as NotificationPermissionPromptData,
} from "./services/notificationPermissionOnboardingService";
import { useMvpAppState } from "./state/useMvpAppState";
import { useLocalMessageState } from "./state/useLocalMessageState";
import { useOverlayState, type OverlayMenuItem as MenuItem } from "./state/useOverlayState";
import { useMemberSidebarState } from "./state/useMemberSidebarState";
import { useProtectedDesktopSession } from "./hooks/useProtectedDesktopSession";
import { useSupabaseMessageRealtime } from "./hooks/useSupabaseMessageRealtime";
import { useSupabasePresenceChannel } from "./hooks/useSupabasePresenceChannel";
import { useSupabaseTypingBroadcast } from "./hooks/useSupabaseTypingBroadcast";
import { readStateService } from "./services/supabase/readStateService";
import { createCommunityFromSummary } from "./utils/communityFactory";
import { messageMentionsUser } from "./utils/mentionUtils";
import { canManageChannels, canSendMessage, canViewChannel, filterCommunityForAccess, getCommunityAccess, getVisibleChannelsForCurrentUser } from "./services/permissions/communityPermissions";
import { canModerateCommunityMember } from "./services/permissions/communityPermissions";
import { memberManagementService } from "./services/memberManagementService";

const SettingsModal = lazy(() => import("./components/SettingsModal").then((module) => ({ default: module.SettingsModal })));
const OnboardingFlow = lazy(() => import("./components/onboarding/OnboardingFlow").then((module) => ({ default: module.OnboardingFlow })));
const MentionFeedMain = lazy(() => import("./components/MentionFeedMain").then((module) => ({ default: module.MentionFeedMain })));
const ProfileView = lazy(() => import("./components/ProfileView").then((module) => ({ default: module.ProfileView })));
const DirectMessagesView = lazy(() => import("./components/DirectMessagesView").then((module) => ({ default: module.DirectMessagesView })));
const RadioCommunityShell = lazy(() => import("./components/audio/RadioCommunityShell").then((module) => ({ default: module.RadioCommunityShell })));
const PodcastCommunityShell = lazy(() => import("./components/audio/PodcastCommunityShell").then((module) => ({ default: module.PodcastCommunityShell })));
const SavedMessagesView = lazy(() => import("./components/SavedMessagesView").then((module) => ({ default: module.SavedMessagesView })));
const DiscoveryView = lazy(() => import("./components/DiscoveryView").then((module) => ({ default: module.DiscoveryView })));
const FriendsView = lazy(() => import("./components/FriendsView").then((module) => ({ default: module.FriendsView })));
const VoiceRoomView = lazy(() => import("./components/VoiceRoomView").then((module) => ({ default: module.VoiceRoomView })));

const overlayIcons = mvpUiIconMap.overlays;

const fallbackCurrentUser: Member = {
  id: "local-current-user",
  userId: currentUserId,
  displayName: "Picom Pilot",
  username: "picom.pilot",
  avatarSeed: "picom-pilot",
  status: "online",
  statusText: "Viewing Picom",
  roleId: "member",
  bio: "Local Picom desktop user.",
};

function getLocalMentionCount(body: string, currentUser: Member): number {
  return messageMentionsUser(body, currentUser.username, currentUser.displayName) ? 1 : 0;
}

const trayPresenceLabels: Record<TrayStatus, string> = {
  online: "Online now",
  idle: "Idle now",
  dnd: "Do not disturb",
  invisible: "Invisible",
};

function mapTrayStatusToMemberStatus(status: TrayStatus): Member["status"] {
  return status === "invisible" ? "offline" : status;
}

type PaletteResult = {
  id: string;
  group: string;
  label: string;
  detail: string;
  verification?: VerificationSummary;
  run: () => void;
};

type ActiveView = CommunityShellView | "mentionFeed" | "profile" | "directMessages" | "friends" | "savedMessages" | "discovery";

function communityViewForKind(kind: Community["kind"]): ActiveView {
  return communityNavigationService.getShellView(kind);
}

const initialVoiceSnapshot: VoiceServiceSnapshot = {
  status: "idle",
  roomName: null,
  muted: false,
  deafened: false,
  screenSharing: false,
  screenShares: [],
  participants: [],
  error: null,
  errorCode: null,
};

function DeferredViewBoundary({ children, label = "Opening Picom view" }: { children: ReactNode; label?: string }) {
  return (
    <Suspense fallback={<main className="deferred-view-fallback" role="status"><span><AppIcon name="home" size="lg" /></span><strong>{label}</strong></main>}>
      {children}
    </Suspense>
  );
}

type CommandPaletteProps = {
  communities: Community[];
  query: string;
  setQuery: (value: string) => void;
  results: PaletteResult[];
  selectedIndex: number;
  setSelectedIndex: (value: number) => void;
  loading: boolean;
  onClose: () => void;
};

function CommandPalette({
  communities,
  query,
  setQuery,
  results,
  selectedIndex,
  setSelectedIndex,
  loading,
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (results.length) setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (results.length) setSelectedIndex(Math.max(0, selectedIndex - 1));
      }

      if (event.key === "Home") {
        event.preventDefault();
        if (results.length) setSelectedIndex(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        if (results.length) setSelectedIndex(results.length - 1);
      }

      if (event.key === "Enter") {
        event.preventDefault();
        results[selectedIndex]?.run();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, results, selectedIndex, setSelectedIndex]);

  const groups = Array.from(new Set(results.map((result) => result.group)));

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Search and command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input">
          <AppIcon name={overlayIcons.search} />
          <input
            ref={inputRef}
            value={query}
            aria-controls="command-palette-results"
            aria-activedescendant={results[selectedIndex] ? `command-result-${results[selectedIndex].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search communities, channels, messages, profiles, commands..."
          />
        </div>

        <div id="command-palette-results" className="command-results" role="listbox" aria-busy={loading}>
          {loading ? <div className="command-search-state"><AppIcon name="search" size="sm" /><span>Searching accessible Picom content...</span></div> : null}
          {groups.map((group) => (
            <div className="command-group" key={group}>
              <header>{group}</header>
              {results
                .filter((result) => result.group === group)
                .map((result) => {
                  const index = results.indexOf(result);

                  return (
                    <button
                      key={result.id}
                      id={`command-result-${result.id}`}
                      role="option"
                      aria-selected={index === selectedIndex}
                      className={index === selectedIndex ? "active" : ""}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={result.run}
                    >
                      <strong className="command-result-label"><span>{result.label}</span><VerifiedBadge verification={result.verification} size="xs" /></strong>
                      <span>{result.detail}</span>
                    </button>
                  );
                })}
            </div>
          ))}

          {!loading && !results.length ? <div className="empty-state compact"><strong>No matching results</strong><span>Try a community, channel, message, profile, or command name.</span></div> : null}
        </div>

        <footer><span>{communities.length} communities indexed locally</span><span>Arrow keys navigate / Enter opens / Esc closes</span></footer>
      </section>
    </div>
  );
}

export function App() {
  const startupSafeMode = safeModeService.getStartupState();
  const saved = startupSafeMode.active ? settingsService.getDefaultSettings() : settingsService.getSettings();
  const [crashRecoveryRecord, setCrashRecoveryRecord] = useState<CrashRecoveryRecord | null>(() => {
    const record = crashRecoveryService.recordStartupOpened();
    return record && crashRecoveryService.shouldShowRecoveryDialog() ? record : null;
  });
  const [safeMode, setSafeMode] = useState<SafeModeState>(startupSafeMode);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(saved.appearanceSettings);
  const [theme, setTheme] = useState<ThemeMode>(() => startupSafeMode.active ? "light" : appearanceService.resolveTheme(saved.appearanceSettings.themeMode));
  const [firstLaunchSetupCompleted, setFirstLaunchSetupCompleted] = useState(saved.firstLaunchSetupCompleted);
  const [accessibilitySettings, setAccessibilitySettings] = useState(saved.accessibilitySettings);
  const [maintenanceStatus, setMaintenanceStatus] = useState(() => maintenanceStatusService.getSnapshot());
  const [profileSettings, setProfileSettings] = useState(saved.profileSettings);
  const applyManualTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    setAppearanceSettings(settingsService.updateAppearanceSettings({ themeMode: nextTheme }).appearanceSettings);
  };
  const toggleTheme = () => applyManualTheme(theme === "light" ? "dark" : "light");
  const [trayPresenceStatus, setTrayPresenceStatus] = useState<TrayStatus>("online");
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [passwordRecoveryMessage, setPasswordRecoveryMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("community");
  const [isActiveMessageListNearBottom, setIsActiveMessageListNearBottom] = useState(true);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>(mockMentionItems);
  const [storyItems, setStoryItems] = useState<FollowedUserStory[]>(() => feedUiStateService.applySeenState(mockFollowedUserStories));
  const [mentionTab, setMentionTab] = useState<MentionFeedTab>(() => feedUiStateService.getSelection().tab);
  const [mentionQuickFilter, setMentionQuickFilter] = useState<MentionQuickFilter | null>(() => feedUiStateService.getSelection().filter);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(currentUserFollowedUserIds);
  const followMutationInFlightRef = useRef(new Set<string>());
  const [activeProfileUserId, setActiveProfileUserId] = useState<string | null>(null);
  const [profileVerificationBadges, setProfileVerificationBadges] = useState<VerificationBadge[]>([]);
  const [profilePrivacyProjection,setProfilePrivacyProjection]=useState<ProfilePrivacyProjection>(defaultProfilePrivacyProjection);
  const [profilePrivacySubjectId,setProfilePrivacySubjectId]=useState<string|null>(null);
  const [remoteUserProfile,setRemoteUserProfile]=useState<UserProfile|null>(null);
  const [remoteProfileSubjectId,setRemoteProfileSubjectId]=useState<string|null>(null);
  const [remoteProfileLoadState,setRemoteProfileLoadState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [remoteProfileLoadError,setRemoteProfileLoadError]=useState<string|null>(null);
  const [profileReloadVersion,setProfileReloadVersion]=useState(0);
  const [previousViewBeforeProfile, setPreviousViewBeforeProfile] = useState<ActiveView | null>(null);
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>(mockDirectConversations);
  const [activeDirectConversationId, setActiveDirectConversationId] = useState(mockDirectConversations[0]?.id ?? "");
  const [friendState, setFriendState] = useState<FriendState>(mockFriendState);
  const [profileRelationshipBusyUserId, setProfileRelationshipBusyUserId] = useState<string | null>(null);
  const [friendsViewTab, setFriendsViewTab] = useState<FriendViewTab>("all");
  const [savedMessages, setSavedMessages] = useState<SavedMessageRecord[]>(() => savedMessageService.listSavedMessages());
  useEffect(() => { let active = true; const refresh = () => { void savedMessageService.getSavedMessages().then((items) => { if (active) setSavedMessages(items); }); }; refresh(); const unsubscribe = savedMessageService.subscribe(refresh); return () => { active = false; unsubscribe(); }; }, []);
  const [communityEvents, setCommunityEvents] = useState(mockUpcomingEvents);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceServiceSnapshot>(initialVoiceSnapshot);
  const [userSafetySettings, setUserSafetySettings] = useState(() => userSafetyCenterService.getSettings());
  const [blockedUserVersion, setBlockedUserVersion] = useState(0);
  useEffect(() => userBlockingService.subscribe(() => setBlockedUserVersion((version) => version + 1)), []);
  const [notificationPolicyState, setNotificationPolicyState] = useState(() => notificationPolicyStateService.getSnapshot());
  const [paletteEntityResults, setPaletteEntityResults] = useState<AdvancedSearchResult[]>([]);
  const [paletteSearchLoading, setPaletteSearchLoading] = useState(false);
  useEffect(() => notificationPolicyStateService.subscribe(setNotificationPolicyState), []);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationCenterItems, setNotificationCenterItems] = useState(() => notificationCenterService.list());
  const [notificationPermissionPrompt, setNotificationPermissionPrompt] = useState<NotificationPermissionPromptData | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportModalTarget | null>(null);
  const [memberModerationTarget, setMemberModerationTarget] = useState<{ member: Member; action: MemberModerationAction } | null>(null);
  const [composerInviteOpen, setComposerInviteOpen] = useState(false);
  const [pollCreateOpen, setPollCreateOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<{ thread: ThreadRecord; parentMessage: Message } | null>(null);
  const [onboardingPhase, setOnboardingPhase] = useState<"checking" | "required" | "complete">("checking");
  const {
    communities,
    appendLocalMessage,
    upsertLocalMessage,
    updateLocalMessage,
    removeLocalMessage,
    setLocalMessageDeliveryStatus,
    editLocalMessage,
    deleteLocalMessage,
    toggleLocalReaction,
    setLocalReactionSummary,
    markChannelUnread,
    clearChannelUnread,
    setCommunityUnreadState,
    addCommunity,
    addCategory,
    renameCategory,
    deleteCategory,
    moveChannel,
    addChannel,
    replaceCommunities,
    replaceCommunityCategories,
    replaceChannelMessages,
    replaceCommunityMembers,
  } = useLocalMessageState(mockCommunities);
  const {
    activeCommunityId,
    activeCommunity,
    channels,
    activeChannel,
    setActiveChannelId,
    switchCommunity,
    selectChannelByOffset,
  } = useMvpAppState(communities);
  const activeVoiceRooms = useMemo(
    () => activeVoiceRoomDiscoveryService.getVisibleRooms({ communities, currentUserId, voiceSnapshot }),
    [communities, voiceSnapshot],
  );
  const {
    settingsOpen,
    paletteOpen,
    paletteQuery,
    paletteIndex,
    menu,
    profile,
    preview,
    toasts,
    setPaletteQuery,
    setPaletteIndex,
    openSettings,
    closeSettings,
    openPalette,
    closePalette,
    openContextMenu,
    closeMenu,
    openProfile: showProfile,
    closeProfile,
    openPreview,
    closePreview,
    closeTransientOverlays,
    dismissToast,
    pushToast,
  } = useOverlayState();
  const externalBlockingOverlayOpen = Boolean(
    createCommunityOpen
    || createChannelCategoryId
    || editingChannel
    || deletingChannel
    || reportTarget
    || memberModerationTarget
    || composerInviteOpen
    || pollCreateOpen
    || crashRecoveryRecord
    || isAppLocked,
  );
  useEffect(() => {
    if (externalBlockingOverlayOpen) closeTransientOverlays();
  }, [closeTransientOverlays, externalBlockingOverlayOpen]);
  const {
    ready: authReady,
    loading: authLoading,
    error: authError,
    session: authSession,
    signIn: handleLogin,
    register: handleRegister,
    clearError: clearAuthError,
    signOut: handleLogout,
  } = useProtectedDesktopSession(pushToast);
  const directMessageUserId = dataSourceService.getStatus().isSupabase ? authSession?.user?.id ?? currentUserId : currentUserId;
  useEffect(() => { if (!authSession || !dataSourceService.getStatus().isSupabase) return; let active = true; void directMessageService.loadDirectConversations().then((result) => { if (!active) return; if (result.ok) { setDirectConversations((current) => result.data.map((summary) => { const existing = current.find((item) => item.id === summary.id); return { ...summary, messages: existing?.messages ?? [], sharedMedia: existing?.sharedMedia }; })); setActiveDirectConversationId((current) => result.data.some((item) => item.id === current) ? current : result.data[0]?.id ?? ""); } else pushToast(result.error.message, "error"); }); return () => { active = false; }; }, [authSession?.user?.id, pushToast]);
  useEffect(() => { if (!authSession || !activeDirectConversationId || !dataSourceService.getStatus().isSupabase) return; let active = true; void Promise.all([directMessageService.getDirectMessages(activeDirectConversationId), directMessageService.getDirectSharedMedia(activeDirectConversationId, { limit: 24 })]).then(([messages, media]) => { if (!active) return; if (!messages.ok) { pushToast(messages.error.message, "error"); return; } setDirectConversations((current) => current.map((conversation) => conversation.id === activeDirectConversationId ? { ...conversation, messages: messages.data, sharedMedia: media.ok ? media.data.items : conversation.sharedMedia } : conversation)); }); return () => { active = false; }; }, [activeDirectConversationId, authSession?.user?.id, pushToast]);
  useEffect(() => {
    if (safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    void Promise.all([mentionFeedService.listPage({ limit: 60 }), relationshipService.getFollowing(), storyService.listPage({ limit: 40 })]).then(([feed, following, stories]) => {
      if (!active) return;
      if (feed.ok) setMentionItems(feedMentionCacheService.replace(feed.data.items));
      else pushToast(feed.error.message, "error");
      if (following.ok) setFollowedUserIds(following.data);
      if (stories.ok) setStoryItems(stories.data.items);
      else pushToast(stories.error.message, "error");
    });
    return () => { active = false; };
  }, [authSession?.user?.id, pushToast]);
  useEffect(() => {
    const userId = authSession?.user?.id;
    if (safeMode.active || !userId || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let refreshInFlight: Promise<void> | null = null;
    feedMentionCacheService.reset(userId);
    const refresh = (reason: "change" | "reconnect") => {
      if (refreshInFlight) return refreshInFlight;
      refreshInFlight = mentionFeedService.listPage({ limit: 60 }).then((result) => {
        if (!active) return;
        if (result.ok) setMentionItems((current) => feedMentionCacheService.replace(result.data.items, current));
        loggingService.logInfo("Feed realtime refresh completed", { reason, ok: result.ok, cacheSize: feedMentionCacheService.diagnostics().size }, "mention-feed");
      }).finally(() => { refreshInFlight = null; });
      return refreshInFlight;
    };
    void feedRealtimeService.subscribe({
      onInvalidate: (event) => {
        feedQueryService.invalidateCache();
        if (event.eventType === "DELETE" && event.sourceId && (event.table === "messages" || event.table === "content_mentions")) {
          setMentionItems((current) => feedMentionCacheService.removeSource(event.sourceId!, current));
        }
        void refresh(event.reason);
      },
      onStatus: (status) => loggingService.logInfo("Feed realtime status", { status }, "mention-feed"),
      onError: (message) => loggingService.logInfo("Feed realtime unavailable", { reason: message }, "mention-feed"),
    }).then((cleanup) => { if (!active) cleanup(); else unsubscribe = cleanup; });
    return () => { active = false; unsubscribe?.(); };
  }, [authSession?.user?.id, safeMode.active]);
  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const refreshFollowing = () => {
      void relationshipService.getFollowing().then((result) => { if (active && result.ok) setFollowedUserIds(result.data); });
    };
    void relationshipService.subscribeToFollowing(refreshFollowing).then((cleanup) => {
      if (!active) cleanup(); else unsubscribe = cleanup;
    });
    return () => { active = false; unsubscribe?.(); };
  }, [authSession?.user?.id]);
  const refreshFriendState = useCallback(async () => {
    const result = await relationshipService.getFriendState();
    if (result.ok) setFriendState(result.data);
    else pushToast(result.error, "error");
  }, [pushToast]);
  useEffect(() => {
    if (dataSourceService.getStatus().isSupabase && !authSession) return;
    let active = true;
    let unsubscribeNotifications: (() => void) | undefined;
    let unsubscribeState: (() => void) | undefined;
    void refreshFriendState();
    if (dataSourceService.getStatus().isSupabase) void userSafetyCenterService.refreshRemotePrivacy();
    void relationshipService.subscribeToFriendState((state) => {
      if (active) setFriendState(state);
    }).then((cleanup) => { if (!active) cleanup(); else unsubscribeState = cleanup; });
    void relationshipService.subscribeToFriendNotifications((notification) => {
      if (!active) return;
      void relationshipService.routeFriendNotification(notification);
    }).then((cleanup) => { if (!active) cleanup(); else unsubscribeNotifications = cleanup; });
    return () => { active = false; unsubscribeNotifications?.(); unsubscribeState?.(); };
  }, [authSession?.user?.id, refreshFriendState]);
  const friendPresenceIds = friendState.friends.map((friend) => friend.userId).sort().join("|");
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void friendPresenceService.subscribe(
      friendPresenceIds ? friendPresenceIds.split("|") : [],
      { sharePresence: userSafetySettings.showOnlineStatus && trayPresenceStatus !== "invisible", ownStatus: trayPresenceStatus === "invisible" ? "offline" : trayPresenceStatus },
      (presence) => {
        if (!active) return;
        setFriendState((current) => {
          const friends = current.friends.map((friend) => presence[friend.userId] ? { ...friend, ...presence[friend.userId] } : friend);
          return { ...current, friends };
        });
      },
    ).then((cleanup) => { if (!active) cleanup(); else unsubscribe = cleanup; });
    return () => { active = false; unsubscribe?.(); };
  }, [authSession?.user?.id, friendPresenceIds, trayPresenceStatus, userSafetySettings.showOnlineStatus]);
  const [legalAcceptancePhase, setLegalAcceptancePhase] = useState<"checking" | "accepted" | "required">("checking");
  const [legalAcceptanceLoading, setLegalAcceptanceLoading] = useState(false);
  const [legalAcceptanceError, setLegalAcceptanceError] = useState<string | null>(null);
  const legalAcceptanceUserId = authSession?.user?.id ?? null;
  useEffect(() => {
    if (!legalAcceptanceUserId) { setLegalAcceptancePhase("checking"); return; }
    let canceled = false;
    setLegalAcceptancePhase("checking");
    setLegalAcceptanceError(null);
    void termsAcceptanceService.getStatus(legalAcceptanceUserId).then((status) => {
      if (!canceled) setLegalAcceptancePhase(status.accepted ? "accepted" : "required");
    });
    return () => { canceled = true; };
  }, [legalAcceptanceUserId]);
  const acceptUpdatedLegalTerms = useCallback(async () => {
    if (!legalAcceptanceUserId) return;
    setLegalAcceptanceLoading(true);
    setLegalAcceptanceError(null);
    const result = await termsAcceptanceService.acceptCurrent(legalAcceptanceUserId);
    setLegalAcceptanceLoading(false);
    if (!result.ok) { setLegalAcceptanceError(result.message); return; }
    setLegalAcceptancePhase("accepted");
    pushToast("Current Picom terms accepted.", "success");
  }, [legalAcceptanceUserId, pushToast]);
  const onboardingUserId = authSession?.user?.id ?? null;
  useEffect(() => {
    if (!onboardingUserId) {
      setOnboardingPhase("checking");
      return;
    }

    let canceled = false;
    setOnboardingPhase("checking");
    void onboardingService.getState(onboardingUserId).then((result) => {
      if (canceled) return;
      setOnboardingPhase(result.ok && result.data.completed ? "complete" : "required");
    });
    return () => { canceled = true; };
  }, [onboardingUserId]);
  const { membersVisible, toggleMembersVisible } = useMemberSidebarState(true);
  const currentUser = activeCommunity.members.find((member) => member.userId === currentUserId) ?? fallbackCurrentUser;
  const communityAccess = useMemo<CommunityAccess>(() => getCommunityAccess(currentUserId, activeCommunity), [activeCommunity]);
  const blockedUserIds = useMemo(() => userBlockingService.listBlockedUserIds(), [blockedUserVersion]);
  const visibleMentionItems = useMemo(() => mentionItems.filter((item) => {
    if (blockedUserIds.includes(item.authorId)) return false;
    if (notificationPolicyState.mutedCommunityIds.includes(item.communityId) || notificationPolicyState.mutedChannelIds.includes(item.channelId)) return false;
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [blockedUserIds, communities, mentionItems, notificationPolicyState]);
  const visibleStoryItems = useMemo(() => storyItems.filter((item) => {
    if (blockedUserIds.includes(item.authorId)) return false;
    if (item.communityId && notificationPolicyState.mutedCommunityIds.includes(item.communityId)) return false;
    if (item.channelId && notificationPolicyState.mutedChannelIds.includes(item.channelId)) return false;
    if (!item.communityId) return true;
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    if (!item.channelId) return access.isMember || access.canViewPublicContent;
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [blockedUserIds, communities, notificationPolicyState, storyItems]);
  const visibleCommunityEvents = useMemo(() => communityEvents.filter((item) => {
    if (notificationPolicyState.mutedCommunityIds.includes(item.communityId)) return false;
    if (item.channelId && notificationPolicyState.mutedChannelIds.includes(item.channelId)) return false;
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    if (!item.channelId) return access.isMember || access.canViewPublicContent;
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [communities, communityEvents, notificationPolicyState]);
  const searchableCommunities = useMemo(() => communities.map((community) => ({ ...community, members: community.members.filter((member) => !blockedUserIds.includes(member.userId)), messages: community.messages.filter((message) => !blockedUserIds.includes(message.authorId)) })), [blockedUserIds, communities]);
  const searchableSavedMessages = useMemo(() => savedMessages.filter((item) => !blockedUserIds.includes(item.authorId)), [blockedUserIds, savedMessages]);
  useEffect(() => {
    if (!paletteOpen) { setPaletteEntityResults([]); setPaletteSearchLoading(false); return; }
    const query = paletteQuery.trim();
    if (!query) { setPaletteEntityResults([]); setPaletteSearchLoading(false); return; }
    let canceled = false;
    setPaletteSearchLoading(true);
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const local = advancedSearchService.searchLocal(query, searchableCommunities, visibleMentionItems, currentUserId, searchableSavedMessages);
        const remote = dataSourceService.getStatus().isSupabase && query.length >= 2 ? await advancedSearchService.searchRemote(query, null, 50) : [];
        if (canceled) return;
        const merged = new Map<string, AdvancedSearchResult>();
        [...local, ...remote.filter((result) => !result.userId || !blockedUserIds.includes(result.userId))].forEach((result) => {
          const key = `${result.category}:${result.communityId ?? ""}:${result.channelId ?? ""}:${result.podcastEpisodeId ?? result.radioSessionId ?? result.messageId ?? result.userId ?? result.id}`;
          if (!merged.has(key)) merged.set(key, result);
        });
        setPaletteEntityResults([...merged.values()].slice(0, 80));
        setPaletteSearchLoading(false);
      })();
    }, 180);
    return () => { canceled = true; window.clearTimeout(timeoutId); };
  }, [blockedUserIds, paletteOpen, paletteQuery, searchableCommunities, searchableSavedMessages, visibleMentionItems]);
  const visibleChannels = useMemo(() => getVisibleChannelsForCurrentUser(activeCommunity, communityAccess), [activeCommunity, communityAccess]);
  const displayedActiveChannel = useMemo(() => visibleChannels.find((channel) => channel.id === activeChannel.id) ?? visibleChannels[0] ?? activeChannel, [activeChannel, visibleChannels]);
  const latestActiveMessageId = useMemo(() => {
    const channelMessages = activeCommunity.messages.filter((message) => message.channelId === displayedActiveChannel.id && !message.deletedAt);
    return channelMessages[channelMessages.length - 1]?.id ?? null;
  }, [activeCommunity.messages, displayedActiveChannel.id]);
  useEffect(() => {
    diagnosticsService.setAppContext({ activeView, activeCommunityId: activeCommunity.id, activeChannelId: activeCommunity.kind === "text" ? displayedActiveChannel.id : null, authState: authSession?.user ? "authenticated" : "signed_out" });
  }, [activeChannel.id, activeCommunity.id, activeView, authSession, displayedActiveChannel.id]);
  const supabaseCommunitiesLoadedRef = useRef(false);
  const supabaseSidebarLoadedRef = useRef(new Set<string>());
  const supabaseMessagesLoadedRef = useRef(new Set<string>());
  const supabaseMembersLoadedRef = useRef(new Set<string>());
  const messageHighlightTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (messageHighlightTimerRef.current !== null) {
      window.clearTimeout(messageHighlightTimerRef.current);
      messageHighlightTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return userSafetyCenterService.subscribe(setUserSafetySettings);
  }, []);

  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    void userBlockingService.refreshRemoteBlocks().then(() => { if (active) setBlockedUserVersion((version) => version + 1); });
    return () => { active = false; };
  }, [authSession?.user?.id, safeMode.active]);

  useEffect(() => {
    if (safeMode.active) {
      setVoiceSnapshot(initialVoiceSnapshot);
      return;
    }
    let canceled = false;
    let unsubscribe: (() => void) | undefined;

    void import("./services/voiceService").then(({ voiceService }) => {
      if (canceled) return;
      unsubscribe = voiceService.subscribe(setVoiceSnapshot);
    });

    return () => {
      canceled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const stableTimer = window.setTimeout(() => {
      crashRecoveryService.recordStartupStable();
      safeModeService.recordStartupStable();
    }, 3000);
    const recordCleanShutdown = () => crashRecoveryService.recordCleanShutdown();

    window.addEventListener("beforeunload", recordCleanShutdown);

    return () => {
      window.clearTimeout(stableTimer);
      window.removeEventListener("beforeunload", recordCleanShutdown);
      crashRecoveryService.recordCleanShutdown();
    };
  }, []);

  const mapMessageSummaryToMessage = useCallback((message: MessageSummary): Message => ({
    id: message.id,
    clientMessageId: message.clientMessageId,
    channelId: message.channelId,
    authorId: message.authorId,
    body: message.body,
    sequence: message.sequence,
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? undefined,
    attachments: [],
    reactions: message.reactions ?? [],
    localStatus: "sent",
  }), []);

  const handleRealtimeMessageInsert = useCallback((message: MessageSummary) => {
    if (message.communityId !== activeCommunity.id) return;

    upsertLocalMessage({
      id: message.id,
      clientMessageId: message.clientMessageId,
      communityId: message.communityId,
      channelId: message.channelId,
      authorId: message.authorId,
      body: message.body,
      sequence: message.sequence,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
    });

    const isActivelyRead = activeView === "community" && message.channelId === activeChannel.id && isActiveMessageListNearBottom;
    if (!isActivelyRead && message.authorId !== currentUser.userId) {
      markChannelUnread({
        communityId: message.communityId,
        channelId: message.channelId,
        mentionCount: getLocalMentionCount(message.body, currentUser),
      });
    }
  }, [activeChannel.id, activeCommunity.id, activeView, currentUser, isActiveMessageListNearBottom, markChannelUnread, upsertLocalMessage]);

  const handleRealtimeMessageUpdate = useCallback((message: MessageSummary) => {
    if (message.communityId !== activeCommunity.id || message.channelId !== activeChannel.id) return;

    if (message.deletedAt) {
      updateLocalMessage({
        communityId: message.communityId,
        channelId: message.channelId,
        id: message.id,
        body: message.body,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
      });
      return;
    }

    upsertLocalMessage({
      id: message.id,
      clientMessageId: message.clientMessageId,
      communityId: message.communityId,
      channelId: message.channelId,
      authorId: message.authorId,
      body: message.body,
      sequence: message.sequence,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
    });
  }, [activeChannel.id, activeCommunity.id, updateLocalMessage, upsertLocalMessage]);

  const handleRealtimeMessageDelete = useCallback((messageId: string) => {
    deleteLocalMessage({
      communityId: activeCommunity.id,
      channelId: activeChannel.id,
      id: messageId,
    });
  }, [activeChannel.id, activeCommunity.id, deleteLocalMessage]);

  const realtimeStatus = useSupabaseMessageRealtime({
    enabled: Boolean(authSession) && !safeMode.active && activeView === "community" && activeCommunity.kind === "text",
    communityId: activeCommunity.id,
    channelId: activeChannel.id,
    subscribeCommunityWide: true,
    onInsert: handleRealtimeMessageInsert,
    onUpdate: handleRealtimeMessageUpdate,
    onDelete: handleRealtimeMessageDelete,
  });
  const typingBroadcast = useSupabaseTypingBroadcast({
    enabled: Boolean(authSession) && !safeMode.active && activeView === "community" && activeCommunity.kind === "text",
    communityId: activeCommunity.id,
    channelId: activeChannel.id,
    currentUserId: currentUser.userId,
    displayName: currentUser.displayName,
  });
  const presenceChannel = useSupabasePresenceChannel({
    enabled: Boolean(authSession) && !safeMode.active,
    communityId: activeCommunity.id,
    currentUserId: currentUser.userId,
    displayName: currentUser.displayName,
    avatarUrl: currentUser.avatarUrl,
    status: currentUser.status,
  });
  useEffect(() => {
    diagnosticsService.setRealtimeStatus(realtimeStatus);
  }, [realtimeStatus]);
  useEffect(() => {
    if (safeMode.active) {
      setMaintenanceStatus(maintenanceStatusService.getSnapshot());
      return;
    }

    const unsubscribe = maintenanceStatusService.subscribe(setMaintenanceStatus);
    void maintenanceStatusService.refresh().then(setMaintenanceStatus);

    return unsubscribe;
  }, [safeMode.active]);
  const displayedActiveCommunity = useMemo<Community>(() => {
    const baseCommunity = !presenceChannel.onlineUserIds.length ? activeCommunity : {
      ...activeCommunity,
      members: activeCommunity.members.map((member) => {
        const presence = presenceChannel.presenceByUserId[member.userId];
        if (!presence) return member;

        const status = presence.status;
        const statusText = status === "dnd" ? "Do not disturb" : status === "idle" ? "Idle now" : "Online now";

        return {
          ...member,
          avatarUrl: presence.avatarUrl ?? member.avatarUrl,
          status,
          statusText,
        };
      }),
    };

    return {
      ...baseCommunity,
      members: baseCommunity.members.map((member) => {
        if (member.userId !== currentUserId) return member;

        return {
          ...member,
          username: profileSettings.username || member.username,
          displayName: profileSettings.displayName || member.displayName,
          avatarUrl: profileSettings.avatarUrl === null ? undefined : profileSettings.avatarUrl ?? member.avatarUrl,
          status: mapTrayStatusToMemberStatus(trayPresenceStatus),
          statusText: profileSettings.statusText || trayPresenceLabels[trayPresenceStatus] || member.statusText,
          bio: profileSettings.bio || member.bio,
        };
      }),
    };
    return filterCommunityForAccess(baseCommunity, communityAccess);
  }, [activeCommunity, communityAccess, presenceChannel.onlineUserIds.length, presenceChannel.presenceByUserId, profileSettings, trayPresenceStatus]);
  const displayedCurrentUser = displayedActiveCommunity.members.find((member) => member.userId === currentUser.userId) ?? currentUser;
  const followSuggestionsV2 = useMemo(() => rankFollowSuggestions({
    candidates: communities.flatMap((community) => community.members),
    communities,
    accessibleMentions: visibleMentionItems,
    currentUserId,
    followedUserIds,
    blockedUserIds,
    limit: 10,
  }), [blockedUserIds, communities, followedUserIds, visibleMentionItems]);
  const replyToMessage = useMemo(
    () => displayedActiveCommunity.messages.find((message) => message.id === replyToMessageId && message.channelId === displayedActiveChannel.id) ?? null,
    [displayedActiveChannel.id, displayedActiveCommunity.messages, replyToMessageId],
  );
  const selectedProfileMember = useMemo(() => {
    if (!activeProfileUserId) return null;
    const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === activeProfileUserId) ?? null;
    if (!member || member.userId !== directMessageUserId) return member;
    return { ...member, username: profileSettings.username || member.username, displayName: profileSettings.displayName || member.displayName, avatarUrl: profileSettings.avatarUrl === null ? undefined : profileSettings.avatarUrl ?? member.avatarUrl, status: (profileSettings.status === "busy" ? "dnd" : profileSettings.status) as typeof member.status, statusText: profileSettings.statusText || member.statusText, bio: profileSettings.bio || member.bio };
  }, [activeProfileUserId, communities, directMessageUserId, profileSettings]);

  useEffect(() => {
    if (!activeProfileUserId || !selectedProfileMember || !dataSourceService.getStatus().isSupabase) {
      setRemoteUserProfile(null);
      setRemoteProfileSubjectId(null);
      setRemoteProfileLoadState(activeProfileUserId && selectedProfileMember ? "ready" : "idle");
      setRemoteProfileLoadError(null);
      return;
    }
    const subjectId = activeProfileUserId;
    let active = true;
    setRemoteUserProfile(null);
    setRemoteProfileSubjectId(null);
    setRemoteProfileLoadState("loading");
    setRemoteProfileLoadError(null);
    void profileActivityService.load({ member: selectedProfileMember, communities, viewerUserId: directMessageUserId, followedUserIds }).then((result) => {
      if (!active || subjectId !== activeProfileUserId) return;
      setRemoteProfileSubjectId(subjectId);
      if (result.ok) { setRemoteUserProfile(result.data); setRemoteProfileLoadState("ready"); setRemoteProfileLoadError(null); }
      else { setRemoteProfileLoadState("error"); setRemoteProfileLoadError(result.error.message); pushToast(result.error.message, "error"); }
    });
    return () => { active = false; };
  }, [activeProfileUserId, communities, directMessageUserId, followedUserIds, profileReloadVersion, pushToast, selectedProfileMember]);

  const selectedUserProfile = useMemo(() => {
    if (!selectedProfileMember) return null;
    const projection=profilePrivacySubjectId===activeProfileUserId?profilePrivacyProjection:restrictedProfilePrivacyProjection;
    const mockProfile=getMockProfileForMember(selectedProfileMember,communities,{currentUserId:directMessageUserId,followedUserIds});
    const sourceProfile=dataSourceService.getStatus().isSupabase
      ? remoteProfileSubjectId===activeProfileUserId&&remoteUserProfile?remoteUserProfile:profileActivityService.emptyProductionProfile(mockProfile)
      : mockProfile;
    const profile = profilePrivacyService.applyProjection(sourceProfile,projection);
    const friend = friendState.friends.some((candidate) => candidate.userId === profile.id);
    const request = friendState.requests.find((candidate) => candidate.userId === profile.id);
    const ownOverrides = profile.id === directMessageUserId ? { username: profileSettings.username || profile.username, displayName: profileSettings.displayName || profile.displayName, avatarUrl: profileSettings.avatarUrl === null ? undefined : profileSettings.avatarUrl ?? profile.avatarUrl, coverUrl: profileSettings.coverUrl === null ? undefined : profileSettings.coverUrl ?? profile.coverUrl, status: profileSettings.status, statusText: profileSettings.statusText || profile.statusText, bio: profileSettings.bio || profile.bio, location: profileSettings.location || profile.location, timezone: profileSettings.timezone || profile.timezone, preferredLanguage: profileSettings.preferredLanguage || profile.preferredLanguage, tags: profileSettings.tags.length ? profileSettings.tags : profile.tags } : {};
    const isFollowing = profile.id !== directMessageUserId && followedUserIds.includes(profile.id);
    const initialMockFollowing = currentUserFollowedUserIds.includes(profile.id);
    const followerDelta = dataSourceService.getStatus().isMock ? Number(isFollowing) - Number(initialMockFollowing) : 0;
    return { ...profile, ...ownOverrides, isFollowing, stats: { ...profile.stats, followers: Math.max(0, profile.stats.followers + followerDelta) }, verificationBadges: profileVerificationBadges, friendshipStatus: friend ? "friends" as const : request?.direction === "incoming" ? "incoming" as const : request?.direction === "outgoing" ? "outgoing" as const : "none" as const };
  }, [activeProfileUserId, communities, directMessageUserId, followedUserIds, friendState.friends, friendState.requests, profilePrivacyProjection, profilePrivacySubjectId, profileSettings, profileVerificationBadges, remoteProfileSubjectId, remoteUserProfile, selectedProfileMember]);

  useEffect(()=>{if(!activeProfileUserId){setProfileVerificationBadges([]);return;}let active=true;void profileVerificationService.listForSubject("user",activeProfileUserId).then((result)=>{if(active)setProfileVerificationBadges(result.ok?result.data:[])});return()=>{active=false};},[activeProfileUserId]);
  useEffect(()=>{if(!activeProfileUserId){setProfilePrivacyProjection(defaultProfilePrivacyProjection);setProfilePrivacySubjectId(null);return;}const subjectId=activeProfileUserId;const viewerId=directMessageUserId;const hasSharedCommunity=communities.some((community)=>community.members.some((member)=>member.userId===viewerId)&&community.members.some((member)=>member.userId===subjectId));const isFriend=friendState.friends.some((friend)=>friend.userId===subjectId);let active=true;void profilePrivacyService.getProjection({targetUserId:subjectId,viewerUserId:viewerId,hasSharedCommunity,isFriend}).then((projection)=>{if(active){setProfilePrivacyProjection(projection);setProfilePrivacySubjectId(subjectId)}});return()=>{active=false};},[activeProfileUserId,communities,directMessageUserId,friendState.friends]);
  useEffect(() => profilePrivacyService.subscribe((settings) => {
    if (activeProfileUserId !== directMessageUserId) return;
    setProfilePrivacyProjection({ ...settings, canViewProfile: true, location: profileSettings.location || undefined, timezone: profileSettings.timezone || undefined });
    setProfilePrivacySubjectId(directMessageUserId);
  }), [activeProfileUserId, directMessageUserId, profileSettings.location, profileSettings.timezone]);

  useEffect(() => notificationCenterService.subscribe(setNotificationCenterItems), []);
  useEffect(() => authSession ? notificationCenterService.startRemoteSync() : undefined, [authSession?.user?.id]);
  useEffect(() => { notificationPolicyStateService.setDoNotDisturb(trayPresenceStatus === "dnd"); }, [trayPresenceStatus]);

  useEffect(() => {
    appearanceService.applyDocumentPreferences(theme, appearanceSettings, accessibilitySettings);
    settingsService.updateSettings({ theme, accessibilitySettings, appearanceSettings });
  }, [accessibilitySettings, appearanceSettings, theme]);
  useEffect(() => appearanceService.subscribeToSystemTheme((systemTheme) => {
    if (appearanceSettings.themeMode === "system") setTheme(systemTheme);
  }), [appearanceSettings.themeMode]);
  useEffect(() => { if (authSession?.user?.id) void settingsService.hydrateAccountSettings(); }, [authSession?.user?.id]);

  useEffect(() => {
    setIsActiveMessageListNearBottom(true);
  }, [activeChannel.id, activeCommunity.id]);

  useEffect(() => {
    if (activeCommunity.kind !== "text" || activeView !== "community" || !isActiveMessageListNearBottom) return;
    clearChannelUnread({ communityId: activeCommunity.id, channelId: displayedActiveChannel.id });
    void readStateService.markChannelRead({ channelId: displayedActiveChannel.id, lastReadMessageId: latestActiveMessageId });
  }, [activeCommunity.id, activeView, clearChannelUnread, displayedActiveChannel.id, isActiveMessageListNearBottom, latestActiveMessageId]);

  useEffect(() => {
    if (activeCommunity.kind !== "text" || safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase) return;
    let canceled = false;
    void readStateService.listCommunityUnread(activeCommunity.id).then((result) => {
      if (canceled || !result.ok) return;
      setCommunityUnreadState(activeCommunity.id, result.data.map((summary) => ({
        channelId: summary.channelId,
        unread: summary.unreadCount > 0,
        mentionCount: summary.mentionCount,
      })));
    });
    return () => { canceled = true; };
  }, [activeCommunity.id, authSession, safeMode.active, setCommunityUnreadState]);

  useEffect(() => {
    if (activeCommunity.kind !== "text" || !visibleChannels.length) return;
    if (visibleChannels.some((channel) => channel.id === activeChannel.id)) return;
    setActiveChannelId(visibleChannels[0].id);
  }, [activeChannel.id, activeCommunity.kind, setActiveChannelId, visibleChannels]);

  const refreshMaintenanceStatus = useCallback(() => {
    void maintenanceStatusService.refresh().then(setMaintenanceStatus);
  }, []);
  const openSystemStatusPage = useCallback(async () => {
    const result = await statusPageService.openStatusPage();
    if (result.ok) {
      pushToast(`Opened system status: ${statusPageService.getDisplayDomain()}.`, "success");
      return;
    }

    pushToast(result.reason === "STATUS_PAGE_URL_NOT_CONFIGURED" ? "System status page is not configured yet." : "System status page could not be opened.", "info");
  }, [pushToast]);
  const resetSafeModeSettings = useCallback(() => {
    void safeModeService.resetSettings().then((result) => {
      const defaults = settingsService.getDefaultSettings();
      setAppearanceSettings(defaults.appearanceSettings);
      setTheme(appearanceService.resolveTheme(defaults.appearanceSettings.themeMode));
      setAccessibilitySettings(defaults.accessibilitySettings);
      setProfileSettings(defaults.profileSettings);
      pushToast(result.message, "success");
    });
  }, [pushToast]);
  const clearSafeModeCache = useCallback(() => {
    void safeModeService.clearCache().then((result) => pushToast(result.message, "success"));
  }, [pushToast]);
  const exportSafeModeLogs = useCallback(() => {
    const result = safeModeService.exportLogs();
    pushToast(result.message, "success");
  }, [pushToast]);
  const restartNormallyFromSafeMode = useCallback(() => {
    setSafeMode(safeModeService.getStartupState());
    safeModeService.restartNormally();
  }, []);
  const continueAfterCrashRecovery = useCallback(() => {
    crashRecoveryService.dismissRecoveryDialog();
    setCrashRecoveryRecord(null);
    pushToast("Continuing normally after recovery check.", "success");
  }, [pushToast]);
  const startSafeModeFromCrashRecovery = useCallback(() => {
    crashRecoveryService.dismissRecoveryDialog();
    safeModeService.enableSafeMode("manual_flag");
    setCrashRecoveryRecord(null);
    window.location.reload();
  }, []);
  const exportCrashRecoveryLogs = useCallback(() => {
    const result = crashRecoveryService.exportDiagnosticsFile();
    pushToast(result.message, "success");
  }, [pushToast]);
  const resetSettingsFromCrashRecovery = useCallback(() => {
    void safeModeService.resetSettings().then((result) => {
      const defaults = settingsService.getDefaultSettings();
      setAppearanceSettings(defaults.appearanceSettings);
      setTheme(appearanceService.resolveTheme(defaults.appearanceSettings.themeMode));
      setAccessibilitySettings(defaults.accessibilitySettings);
      setProfileSettings(defaults.profileSettings);
      crashRecoveryService.clearCrashState();
      setCrashRecoveryRecord(null);
      pushToast(result.message, "success");
    });
  }, [pushToast]);
  const handlePasswordResetRequest = useCallback(async (email: string) => {
    const result = await authService.requestPasswordReset(email);
    if (!result.ok) {
      pushToast(result.error.message, "error");
      return result.error.message;
    }

    pushToast(result.data.message, "success");
    return result.data.message;
  }, [pushToast]);
  const handlePasswordResetConfirm = useCallback(async (password: string) => {
    const result = await authService.confirmPasswordReset(password);
    if (!result.ok) return { ok: false, message: result.error.message };
    setPasswordRecoveryMode(false);
    setPasswordRecoveryMessage(null);
    pushToast(result.data.message, "success");
    return { ok: true, message: result.data.message };
  }, [pushToast]);
  const lockApp = useCallback(() => {
    closeTransientOverlays();
    closePalette();
    setIsAppLocked(true);
  }, [closePalette, closeTransientOverlays]);
  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
    pushToast("Picom unlocked locally.", "success");
  }, [pushToast]);
  const logoutFromLockScreen = useCallback(() => {
    setIsAppLocked(false);
    void handleLogout();
  }, [handleLogout]);

  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase || supabaseCommunitiesLoadedRef.current) return;

    let canceled = false;
    supabaseCommunitiesLoadedRef.current = true;

    communityService.listCommunities().then((result) => {
      if (canceled) return;

      if (!result.ok) {
        supabaseCommunitiesLoadedRef.current = false;
        pushToast(result.error.message, "error");
        return;
      }

      const nextCommunities = result.data.map(createCommunityFromSummary);
      replaceCommunities(nextCommunities);

      if (nextCommunities[0]) {
        switchCommunity(nextCommunities[0].id);
      }
    });

    return () => {
      canceled = true;
    };
  }, [authSession, pushToast, replaceCommunities, switchCommunity]);

  useEffect(() => {
    if (activeCommunity.kind !== "text" || safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase || supabaseSidebarLoadedRef.current.has(activeCommunity.id)) return;

    let canceled = false;
    supabaseSidebarLoadedRef.current.add(activeCommunity.id);

    Promise.all([
      channelCategoryService.listCategories(activeCommunity.id),
      channelService.listChannels(activeCommunity.id),
    ]).then(([categoryResult, channelResult]) => {
      if (canceled) return;

      if (!categoryResult.ok) {
        supabaseSidebarLoadedRef.current.delete(activeCommunity.id);
        pushToast(categoryResult.error.message, "error");
        return;
      }

      if (!channelResult.ok) {
        supabaseSidebarLoadedRef.current.delete(activeCommunity.id);
        pushToast(channelResult.error.message, "error");
        return;
      }

      const fallbackCategoryId = `${activeCommunity.id}-channels`;
      const nextCategories: ChannelCategory[] = (categoryResult.data.length ? categoryResult.data : [
        { id: fallbackCategoryId, communityId: activeCommunity.id, name: "Channels", position: 0, createdAt: null, updatedAt: null },
      ]).map((category) => ({
        id: category.id,
        name: category.name,
        position: category.position,
        channels: [],
      }));
      const categoryById = new Map(nextCategories.map((category) => [category.id, category]));
      const defaultCategory = nextCategories[0];

      channelResult.data.forEach((channel) => {
        const targetCategory = categoryById.get(channel.categoryId ?? "") ?? defaultCategory;
        if (!targetCategory) return;

        targetCategory.channels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          topic: channel.topic ?? undefined,
          isPrivate: channel.isPrivate,
          categoryId: targetCategory.id,
          position: channel.position,
        });
      });

      nextCategories.forEach((category) => {
        category.channels.sort((left, right) => (left.position ?? 0) - (right.position ?? 0) || left.name.localeCompare(right.name));
      });

      replaceCommunityCategories(activeCommunity.id, nextCategories);
    });

    return () => {
      canceled = true;
    };
  }, [activeCommunity.id, activeCommunity.kind, authSession, pushToast, replaceCommunityCategories, safeMode.active]);

  useEffect(() => {
    if (activeCommunity.kind !== "text" || safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase) return;

    const messageKey = `${activeCommunity.id}:${activeChannel.id}`;
    if (supabaseMessagesLoadedRef.current.has(messageKey)) return;

    let canceled = false;
    supabaseMessagesLoadedRef.current.add(messageKey);

    messageService.listMessages({
      communityId: activeCommunity.id,
      channelId: activeChannel.id,
    }).then((result) => {
      if (canceled) return;

      if (!result.ok) {
        supabaseMessagesLoadedRef.current.delete(messageKey);
        pushToast(result.error.message, "error");
        return;
      }

      const messages: Message[] = result.data.items.map(mapMessageSummaryToMessage);

      replaceChannelMessages(activeCommunity.id, activeChannel.id, messages);
    });

    return () => {
      canceled = true;
    };
  }, [activeChannel.id, activeCommunity.id, activeCommunity.kind, authSession, mapMessageSummaryToMessage, pushToast, replaceChannelMessages, safeMode.active]);

  useEffect(() => {
    if (safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase || supabaseMembersLoadedRef.current.has(activeCommunity.id)) return;

    let canceled = false;
    supabaseMembersLoadedRef.current.add(activeCommunity.id);

    membersService.listMembers(activeCommunity.id).then((result) => {
      if (canceled) return;

      if (!result.ok) {
        supabaseMembersLoadedRef.current.delete(activeCommunity.id);
        pushToast(result.error.message, "error");
        return;
      }

      const fallbackRole = activeCommunity.roles.find((role) => role.name === "Member") ?? activeCommunity.roles[0];
      const members: Member[] = result.data.map((member) => ({
        id: member.id,
        userId: member.userId,
        displayName: member.displayName ?? `User ${member.userId.slice(0, 8)}`,
        username: member.username ?? `user-${member.userId.slice(0, 8)}`,
        avatarSeed: member.userId,
        avatarUrl: member.avatarUrl ?? undefined,
        status: member.status ?? "offline",
        statusText: member.statusText ?? "Member",
        roleId: member.roleId ?? fallbackRole.id,
        bio: "Supabase community member.",
      }));

      if (members.length > 0) {
        replaceCommunityMembers(activeCommunity.id, members);
      }
    });

    return () => {
      canceled = true;
    };
  }, [activeCommunity.id, activeCommunity.roles, authSession, pushToast, replaceCommunityMembers, safeMode.active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editing = shortcutService.isEditableTarget(event.target);

      if (!editing && shortcutService.matchesEvent("commandPalette", event)) {
        event.preventDefault();
        openPalette();
        return;
      }

      if (!editing && shortcutService.matchesEvent("settings", event)) {
        event.preventDefault();
        openSettings();
        return;
      }

      if (!editing && shortcutService.matchesEvent("lockApp", event)) {
        event.preventDefault();
        lockApp();
        return;
      }

      if (!editing && shortcutService.matchesEvent("previousChannel", event)) {
        event.preventDefault();
        selectChannelByOffset(-1);
        return;
      }

      if (!editing && shortcutService.matchesEvent("nextChannel", event)) {
        event.preventDefault();
        selectChannelByOffset(1);
        return;
      }

      if (!editing && voiceSnapshot.status === "connected" && shortcutService.matchesEvent("voiceMute", event)) {
        event.preventDefault();
        void import("./services/voiceService").then(({ voiceService }) => voiceService.setMuted(!voiceSnapshot.muted).then((result) => { if (!result.ok) pushToast(result.error.message, "error"); }));
        return;
      }

      if (!editing && voiceSnapshot.status === "connected" && shortcutService.matchesEvent("voiceDeafen", event)) {
        event.preventDefault();
        void import("./services/voiceService").then(({ voiceService }) => { const result = voiceService.setDeafened(!voiceSnapshot.deafened); if (!result.ok) pushToast(result.error.message, "error"); });
        return;
      }

      if (shortcutService.matchesEvent("escape", event)) {
        closeTransientOverlays();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeChannel.id, channels, closeTransientOverlays, lockApp, openPalette, openSettings, pushToast, selectChannelByOffset, voiceSnapshot.deafened, voiceSnapshot.muted, voiceSnapshot.status]);

  const maybeShowNotificationPermissionPrompt = useCallback((trigger: NotificationPermissionOnboardingTrigger) => {
    const prompt = notificationPermissionOnboardingService.getPrompt(trigger);
    if (!prompt) return;

    notificationPermissionOnboardingService.markPrompted(trigger);
    setNotificationPermissionPrompt(prompt);
  }, []);

  useEffect(() => {
    analyticsService.trackEvent("app_started", { runtime: "electron", releaseChannel: "beta" });
  }, [safeMode.active]);

  useEffect(() => {
    if (authSession?.user) analyticsService.trackEvent("login_success", { mode: dataSourceService.getStatus().mode });
    if (authSession?.user) crashReporterService.setUserContext(authSession.user.id); else crashReporterService.clearUserContext();
  }, [authSession?.user?.id]);

  useEffect(() => {
    if (settingsOpen) {
      maybeShowNotificationPermissionPrompt("notification_settings_opened");
      analyticsService.trackEvent("settings_opened", { section: "settings" });
    }
  }, [maybeShowNotificationPermissionPrompt, settingsOpen]);

  const openPodcastEpisodeSource = useCallback(async (communityId: string, episodeId: string, successMessage = "Opened the Podcast episode.") => {
    const target = communities.find((community) => community.id === communityId);
    const access = target ? getCommunityAccess(currentUserId, target) : null;
    if (!target || target.kind !== "podcast" || !access || (!access.isMember && !access.canViewPublicContent)) { pushToast("This Podcast episode is unavailable or private.", "error"); return false; }
    const result = await podcastService.getPodcastEpisode(episodeId);
    if (!result.ok || result.data.communityId !== communityId || result.data.status !== "published") { pushToast("This Podcast episode is unavailable, private, or no longer published.", "error"); return false; }
    communityNavigationService.rememberPodcastSection(communityId, "episodes");
    communityNavigationService.rememberPodcastEpisode(communityId, episodeId);
    setActiveView("podcastCommunity");
    switchCommunity(communityId);
    closeTransientOverlays();
    pushToast(successMessage, "info");
    return true;
  }, [closeTransientOverlays, communities, pushToast, switchCommunity]);

  useEffect(() => {
    const handleDeepLinkAction = (action: DeepLinkAction) => {
      if (action.type === "passwordRecovery") {
        if (!action.code) { setPasswordRecoveryMode(false); pushToast(action.error || "This password reset link is invalid or expired.", "error"); return; }
        void authService.preparePasswordRecovery(action.code).then((result) => {
          if (!result.ok) { setPasswordRecoveryMode(false); pushToast(result.error.message, "error"); return; }
          clearAuthError();
          setAuthView("login");
          setPasswordRecoveryMessage(result.data.message);
          setPasswordRecoveryMode(true);
        });
        return;
      }
      if (action.type === "emailVerification") {
        if (!action.code) { pushToast(action.error || "This email verification link is invalid or expired.", "error"); return; }
        void authService.confirmEmailVerification(action.code).then((result) => pushToast(result.ok ? result.data.message : result.error.message, result.ok ? "success" : "error"));
        return;
      }
      if (action.type === "authCallback") {
        if (!action.code) {
          pushToast(action.error || "Social sign in was canceled.", "error");
          return;
        }

        void socialAuthService.completeOAuthCallback(action.code).then((result) => {
          pushToast(result.ok ? "Social sign in completed." : result.error, result.ok ? "success" : "error");
        });
        return;
      }

      if (action.type === "settings") {
        openSettings();
        pushToast("Opened settings from deep link.", "info");
        return;
      }

      if (action.type === "friends") {
        setActiveView("friends");
        closeTransientOverlays();
        pushToast("Opened friends foundation from deep link.", "info");
        return;
      }

      if (action.type === "invite") {
        setPendingInviteCode(action.code);
        setActiveView("community");
        pushToast("Invite received. Review it before joining.", "info");
        return;
      }

      if (action.type === "radio") {
        const target = communities.find((community) => community.id === action.communityId);
        const access = target ? getCommunityAccess(currentUserId, target) : null;
        if (!target || target.kind !== "radio" || !access || (!access.isMember && !access.canViewPublicContent)) {
          pushToast("This Radio session is unavailable or private.", "error");
          return;
        }
        communityNavigationService.rememberRadioSession(action.communityId, action.sessionId);
        setActiveView("radioCommunity");
        switchCommunity(action.communityId);
        closeTransientOverlays();
        pushToast("Opened the Radio session.", "info");
        return;
      }

      if (action.type === "podcast") {
        void openPodcastEpisodeSource(action.communityId, action.episodeId);
        return;
      }

      const targetCommunity = communities.find((community) => community.id === action.communityId);
      if (!targetCommunity) {
        pushToast("Deep link community is unavailable in this local workspace.", "error");
        return;
      }

      setActiveView(communityViewForKind(targetCommunity.kind));
      switchCommunity(action.communityId, targetCommunity.kind === "text" ? action.channelId : undefined);
      if (targetCommunity.kind === "text" && action.channelId) {
        clearChannelUnread({ communityId: action.communityId, channelId: action.channelId });
      }
      closeTransientOverlays();

      if (action.messageId) {
        pushToast("Deep link opened the channel. Message highlight is a placeholder.", "info");
      } else {
        pushToast("Deep link opened the community.", "info");
      }
    };

    return deepLinkService.onDeepLink(handleDeepLinkAction);
  }, [clearAuthError, clearChannelUnread, closeTransientOverlays, communities, openPodcastEpisodeSource, openSettings, pushToast, switchCommunity]);

  useEffect(() => {
    const handleMenuAction = (payload: MenuActionPayload) => {
      if (payload.action === "open-settings") {
        closeTransientOverlays();
        openSettings();
        pushToast("Opened settings from the app menu foundation.", "info");
        return;
      }

      if (payload.action === "open-command-palette") {
        closeTransientOverlays();
        openPalette();
        return;
      }

      if (payload.action === "open-mention-feed") {
        setActiveView("mentionFeed");
        closeTransientOverlays();
        pushToast("Opened mention feed from the app menu foundation.", "info");
        return;
      }

      if (payload.action === "open-direct-messages") {
        if (directConversations[0]) setActiveDirectConversationId(directConversations[0].id);
        setActiveView("directMessages");
        closeTransientOverlays();
        pushToast("Opened direct messages from the app menu foundation.", "info");
        return;
      }

      if (payload.action === "open-friends") {
        setActiveView("friends");
        closeTransientOverlays();
        pushToast("Opened friends from the app menu foundation.", "info");
        return;
      }

      if (payload.action === "send-feedback") {
        closeTransientOverlays();
        openSettings();
        pushToast("Feedback placeholder is available in Settings > Advanced.", "info");
        return;
      }

      if (payload.action === "open-system-status") {
        void openSystemStatusPage();
        return;
      }

      if (payload.action === "export-diagnostics") {
        void feedbackService.exportSupportDiagnostics({
          issueType: "other",
          title: "App menu diagnostics export",
          description: "Diagnostics export requested through the app menu foundation.",
          includeDiagnostics: true,
          includeLogs: true
        }).then((result) => {
          if (result.ok) {
            pushToast(result.canceled ? "Diagnostics export canceled." : `Diagnostics exported via ${result.method}.`, result.canceled ? "info" : "success");
            return;
          }

          pushToast(result.reason, "error");
        });
        return;
      }

      if (payload.action === "open-help" || payload.action === "open-about") {
        openSettings();
        pushToast(`${payload.action === "open-help" ? "Help" : "About"} placeholder is kept in Settings for MVP.`, "info");
        return;
      }

      if (payload.action === "quit") {
        pushToast("Quit stays behind native tray/window controls in this placeholder.", "info");
      }
    };

    return menuService.onAction(handleMenuAction);
  }, [closeTransientOverlays, directConversations, openPalette, openSettings, openSystemStatusPage, pushToast]);

  useEffect(() => {
    if (safeMode.active) return;

    void trayService.syncCloseToTrayPreference();

    const handleTrayAction = (payload: PicomTrayActionPayload) => {
      if (payload.action === "open") {
        pushToast("Picom restored from the system tray.", "info");
        return;
      }

      if (payload.action === "settings") {
        closeTransientOverlays();
        openSettings();
        pushToast("Opened settings from the system tray.", "info");
        return;
      }

      if (payload.action === "mute") {
        settingsService.updateNotificationSettings({ muted: payload.muted });
        pushToast(payload.muted ? "Notifications muted from the system tray." : "Notifications unmuted from the system tray.", "info");
        return;
      }

      if (payload.action === "online" || payload.action === "idle" || payload.action === "dnd" || payload.action === "invisible") {
        setTrayPresenceStatus(payload.action);
        pushToast(`Status set to ${trayPresenceLabels[payload.action]}.`, "info");
      }
    };

    return trayService.onAction(handleTrayAction);
  }, [closeTransientOverlays, openSettings, pushToast, safeMode.active]);

  const jumpToMessage = useCallback((community: Community, message: Message) => {
    const access = getCommunityAccess(currentUserId, community);
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === message.channelId);
    if (!channel || !canViewChannel(access, channel) || message.deletedAt) {
      pushToast("This message is no longer available or you do not have access.", "error");
      return;
    }
    setActiveView("community");
    switchCommunity(community.id, message.channelId);
    setActiveChannelId(message.channelId);
    clearChannelUnread({ communityId: community.id, channelId: message.channelId });
    setHighlightedMessageId(message.id);
    if (messageHighlightTimerRef.current !== null) window.clearTimeout(messageHighlightTimerRef.current);
    messageHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === message.id ? null : current));
      messageHighlightTimerRef.current = null;
    }, 2200);
  }, [clearChannelUnread, pushToast, setActiveChannelId, switchCommunity]);

  const paletteResults = useMemo<PaletteResult[]>(() => {
    const q = paletteQuery.toLowerCase();
    const all: PaletteResult[] = [
      {
        id: "cmd-settings",
        group: "Commands",
        label: "Open settings",
        detail: "Ctrl + ,",
        run: () => {
          openSettings();
          closePalette();
        },
      },
      {
        id: "cmd-theme",
        group: "Commands",
        label: "Toggle theme",
        detail: theme === "light" ? "Switch to dark" : "Switch to light",
        run: () => {
          toggleTheme();
          closePalette();
        },
      },
      {
        id: "cmd-lock-app",
        group: "Commands",
        label: "Lock app",
        detail: "Ctrl + Shift + L",
        run: () => {
          lockApp();
          closePalette();
        },
      },
      {
        id: "cmd-mention-feed",
        group: "Navigation",
        label: "Open mention feed",
        detail: "Home feed for popular and followed people mentions",
        run: () => {
          setActiveView("mentionFeed");
          closeTransientOverlays();
          closePalette();
        },
      },
      {
        id: "cmd-direct-messages",
        group: "Navigation",
        label: "Open direct messages",
        detail: "Beta placeholder conversations",
        run: () => {
          if (directConversations[0]) setActiveDirectConversationId(directConversations[0].id);
          setActiveView("directMessages");
          closeTransientOverlays();
          closePalette();
        },
      },
      {
        id: "cmd-friends",
        group: "Navigation",
        label: "Open friends foundation",
        detail: "Local beta friends placeholder",
        run: () => {
          setActiveView("friends");
          closeTransientOverlays();
          closePalette();
        },
      },
      { id: "cmd-saved-messages", group: "Navigation", label: "Open saved messages", detail: "Private bookmarks", run: () => { setActiveView("savedMessages"); closeTransientOverlays(); closePalette(); } },
      {
        id: "cmd-create-community",
        group: "Actions",
        label: "Create community",
        detail: "Open the desktop create community modal",
        run: () => {
          setCreateCommunityOpen(true);
          closePalette();
        },
      },
    ];

    for (const result of paletteEntityResults) {
      const resultMember = result.userId ? communities.flatMap((community) => community.members).find((candidate) => candidate.userId === result.userId) : undefined;
      const resultCommunity = result.communityId ? communities.find((community) => community.id === result.communityId) : undefined;
      const verification = result.category === "People" && resultMember
        ? getUserVerificationSummary(resultMember.userId, [], resultMember.verification)
        : result.category === "Communities" && resultCommunity
          ? getCommunityVerificationSummary(resultCommunity.id, [], resultCommunity.verification)
          : undefined;
      all.push({
        id: result.id, group: result.category, label: result.label, detail: result.detail, verification,
        run: () => {
          if (result.category === "People" && result.userId) {
            const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === result.userId);
            if (member && !blockedUserIds.includes(member.userId)) { setPreviousViewBeforeProfile(activeView); setActiveProfileUserId(result.userId); setActiveView("profile"); }
            else pushToast("This profile is unavailable or outside your accessible communities.", "error");
          }
          else if (result.category === "Radio" && result.communityId && result.radioSessionId) { const target = communities.find((community) => community.id === result.communityId); const access = target ? getCommunityAccess(currentUserId, target) : null; if (target?.kind === "radio" && access && (access.isMember || access.canViewPublicContent)) { communityNavigationService.rememberRadioSession(result.communityId, result.radioSessionId); setActiveView("radioCommunity"); switchCommunity(result.communityId); } else pushToast("This Radio session is unavailable or private.", "error"); }
          else if (result.category === "Podcasts" && result.communityId && result.podcastEpisodeId) { void openPodcastEpisodeSource(result.communityId, result.podcastEpisodeId, "Opened the Podcast search result."); }
          else if (result.category === "Communities" && result.communityId) { const target = communities.find((community) => community.id === result.communityId); if (target) { setActiveView(communityViewForKind(target.kind)); switchCommunity(result.communityId); } }
          else if (result.communityId && result.channelId && (result.category === "Messages" || result.category === "Mentions" || result.category === "Saved" || result.category === "Media")) {
            const target = advancedSearchService.resolveMessageJumpTarget(result, communities, currentUserId);
            if (target.ok) jumpToMessage(target.community, target.message);
            else {
              const community = communities.find((candidate) => candidate.id === result.communityId);
              const access = community ? getCommunityAccess(currentUserId, community) : null;
              const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === result.channelId);
              if (community && access && channel && canViewChannel(access, channel)) { setActiveView("community"); switchCommunity(community.id, channel.id); setActiveChannelId(channel.id); clearChannelUnread({ communityId: community.id, channelId: channel.id }); if (result.messageId) setHighlightedMessageId(result.messageId); }
              else pushToast(target.reason, "error");
            }
          } else if (result.communityId && result.channelId) { setActiveView("community"); switchCommunity(result.communityId, result.channelId); setActiveChannelId(result.channelId); clearChannelUnread({ communityId: result.communityId, channelId: result.channelId }); }
          closePalette();
        },
      });
    }

    return all
      .filter((result) => !q || `${result.group} ${result.label} ${result.detail}`.toLowerCase().includes(q))
      .slice(0, 36);
  }, [activeView, blockedUserIds, clearChannelUnread, closePalette, closeTransientOverlays, communities, directConversations, jumpToMessage, lockApp, openPodcastEpisodeSource, openSettings, paletteEntityResults, paletteQuery, pushToast, setActiveChannelId, switchCommunity, theme]);

  const openMentionFeed = useCallback(() => {
    setActiveView("mentionFeed");
    closeTransientOverlays();
  }, [closeTransientOverlays]);

  const openCommunityFromRail = useCallback((communityId: string) => {
    const target = communities.find((community) => community.id === communityId);
    setActiveView(target ? communityViewForKind(target.kind) : "community");
    switchCommunity(communityId);
    closeTransientOverlays();
  }, [closeTransientOverlays, communities, switchCommunity]);

  const toggleFollowUser = useCallback(async (userId: string) => {
    if (userId === directMessageUserId || followMutationInFlightRef.current.has(userId)) return;
    const wasFollowing = followedUserIds.includes(userId);
    followMutationInFlightRef.current.add(userId);
    setProfileRelationshipBusyUserId(userId);
    setFollowedUserIds((current) => wasFollowing ? current.filter((id) => id !== userId) : [...new Set([...current, userId])]);
    const result = await (wasFollowing ? relationshipService.unfollowUser(userId) : relationshipService.followUser(userId));
    if (!result.ok) {
      setFollowedUserIds((current) => wasFollowing ? [...new Set([...current, userId])] : current.filter((id) => id !== userId));
      pushToast(result.error, "error");
    } else {
      const authoritative = await relationshipService.getFollowing();
      if (authoritative.ok) setFollowedUserIds(authoritative.data);
      setProfileReloadVersion((version) => version + 1);
    }
    followMutationInFlightRef.current.delete(userId);
    setProfileRelationshipBusyUserId((current) => current === userId ? null : current);
  }, [directMessageUserId, followedUserIds, pushToast]);

  const toggleMentionReaction = useCallback((id: string) => {
    const item = mentionItems.find((candidate) => candidate.id === id);
    if (!item) { pushToast("This mention is no longer accessible.", "error"); return; }
    const previousReactions = item.reactions ?? [];
    const [primaryReaction = { emoji: "\u{1F44D}", count: 0 }, ...rest] = previousReactions;
    const wasReacted = Boolean(primaryReaction.reactedByCurrentUser);
    const optimisticReaction = { ...primaryReaction, count: Math.max(0, primaryReaction.count + (wasReacted ? -1 : 1)), reactedByCurrentUser: !wasReacted };
    setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, reactions: [optimisticReaction, ...rest] } : candidate));
    void (async () => {
      const result = wasReacted
        ? await reactionService.removeReaction({ messageId: item.messageId, emoji: primaryReaction.emoji })
        : await reactionService.addReaction({ messageId: item.messageId, emoji: primaryReaction.emoji });
      if (!result.ok) {
        setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, reactions: previousReactions } : candidate));
        pushToast(result.error.message, "error");
        return;
      }
      const authoritativeReaction = { ...primaryReaction, emoji: result.data.emoji, count: result.data.count, reactedByCurrentUser: result.data.reactedByCurrentUser };
      setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, reactions: [authoritativeReaction, ...rest] } : candidate));
    })();
  }, [mentionItems, pushToast]);

  const toggleSavedMessage = useCallback(async (community: Community, message: Message): Promise<boolean> => {
    const saved = savedMessageService.isMessageSaved(message.id);
    const ok = saved ? await savedMessageService.unsaveMessage(message.id) : await savedMessageService.saveMessage(message.id,{communityId:community.id,channelId:message.channelId,authorId:message.authorId,preview:message.body.slice(0,220),messageCreatedAt:message.createdAt});
    if (!ok) { pushToast("Saved Messages could not be updated.", "error"); return saved; }
    setSavedMessages(await savedMessageService.getSavedMessages());
    pushToast(saved ? "Message removed from Saved Messages." : "Message saved.", "success");
    return !saved;
  }, [pushToast]);

  const toggleMentionSaved = useCallback((id: string) => {
    const item=mentionItems.find((candidate)=>candidate.id===id);const community=item?communities.find((candidate)=>candidate.id===item.communityId):undefined;const message=community?.messages.find((candidate)=>candidate.id===item?.messageId);
    if (!item || !community) { pushToast("This mention is no longer accessible.", "error"); return; }
    void (async () => { const nextSaved = message ? await toggleSavedMessage(community, message) : await (async () => { const saved = savedMessageService.isMessageSaved(item.messageId); const ok = saved ? await savedMessageService.unsaveMessage(item.messageId) : await savedMessageService.saveMessage(item.messageId, { communityId: item.communityId, channelId: item.channelId, authorId: item.authorId, preview: item.body.slice(0, 220), messageCreatedAt: item.createdAt }); if (!ok) { pushToast("Saved Messages could not be updated.", "error"); return saved; } setSavedMessages(await savedMessageService.getSavedMessages()); return !saved; })(); setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, isSaved: nextSaved } : candidate)); })();
  }, [communities, mentionItems, pushToast, toggleSavedMessage]);

  const markMentionRead = useCallback((id: string) => {
    const item = mentionItems.find((candidate) => candidate.id === id);
    if (!item || !item.isUnread) return;
    setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, isUnread: false } : candidate));
    void readStateService.markChannelRead({ channelId: item.channelId, lastReadMessageId: item.messageId }).then((result) => {
      if (result.ok) return;
      setMentionItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, isUnread: true } : candidate));
      pushToast("Picom could not mark this Feed item as read.", "error");
    });
  }, [mentionItems, pushToast]);

  const toggleMentionFilter = useCallback((filter: MentionQuickFilter) => {
    setMentionQuickFilter((current) => { const next = current === filter ? null : filter; feedUiStateService.setSelection(mentionTab, next); return next; });
  }, [mentionTab]);

  const changeMentionTab = useCallback((tab: MentionFeedTab) => {
    feedUiStateService.setSelection(tab, mentionQuickFilter);
    setMentionTab(tab);
  }, [mentionQuickFilter]);

  const openMentionInChannel = useCallback((item: MentionItem) => {
    const community = communities.find((candidate) => candidate.id === item.communityId);
    const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    const access = community ? getCommunityAccess(currentUserId, community) : null;
    if (!community || !channel || !access || !canViewChannel(access, channel)) {
      pushToast("This Feed item is no longer accessible.", "error");
      return;
    }
    setActiveView("community");
    switchCommunity(item.communityId, item.channelId);
    clearChannelUnread({ communityId: item.communityId, channelId: item.channelId });
    setMentionItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, isUnread: false } : candidate)));
    closeTransientOverlays();
    setHighlightedMessageId(item.messageId);
    if (messageHighlightTimerRef.current) window.clearTimeout(messageHighlightTimerRef.current);
    messageHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => current === item.messageId ? null : current);
      messageHighlightTimerRef.current = null;
    }, 2200);
  }, [clearChannelUnread, closeTransientOverlays, communities, currentUserId, pushToast, switchCommunity]);

  const markStorySeen = useCallback((storyId: string) => {
    feedUiStateService.markStorySeen(storyId);
    setStoryItems((current) => current.map((story) => (story.id === storyId ? { ...story, status: "seen" } : story)));
  }, []);

  const openStoryInChannel = useCallback((story: FollowedUserStory) => {
    if (story.sourceType === "radio_session" && story.communityId && story.sourceId) {
      const target = communities.find((community) => community.id === story.communityId);
      if (!target || target.kind !== "radio") { pushToast("This Radio story is no longer accessible.", "error"); return; }
      communityNavigationService.rememberRadioSession(story.communityId, story.sourceId);
      setActiveView("radioCommunity"); switchCommunity(story.communityId); markStorySeen(story.id); closeTransientOverlays(); return;
    }
    if ((story.sourceType === "podcast_episode" || story.sourceType === "podcast_comment") && story.communityId && story.sourceId) {
      const target = communities.find((community) => community.id === story.communityId);
      const episodeId = story.parentSourceId ?? story.sourceId;
      if (!target || target.kind !== "podcast") { pushToast("This Podcast story is no longer accessible.", "error"); return; }
      communityNavigationService.rememberPodcastEpisode(story.communityId, episodeId);
      setActiveView("podcastCommunity"); switchCommunity(story.communityId); markStorySeen(story.id); closeTransientOverlays(); return;
    }
    if (!story.communityId || !story.channelId) {
      pushToast("This story is not linked to an open channel yet.", "info");
      return;
    }

    const targetCommunity = communities.find((community) => community.id === story.communityId);
    const targetChannel = targetCommunity?.categories.flatMap((category) => category.channels).find((channel) => channel.id === story.channelId);
    const targetAccess = targetCommunity ? getCommunityAccess(currentUserId, targetCommunity) : null;
    if (!targetCommunity || !targetChannel || !targetAccess || !canViewChannel(targetAccess, targetChannel)) {
      pushToast("This Story source is no longer accessible.", "error");
      return;
    }

    setActiveView("community");
    switchCommunity(story.communityId, story.channelId);
    clearChannelUnread({ communityId: story.communityId, channelId: story.channelId });
    markStorySeen(story.id);
    closeTransientOverlays();
    if (story.messageId) {
      setHighlightedMessageId(story.messageId);
      if (messageHighlightTimerRef.current) window.clearTimeout(messageHighlightTimerRef.current);
      messageHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedMessageId((current) => current === story.messageId ? null : current);
        messageHighlightTimerRef.current = null;
      }, 2200);
    }
  }, [clearChannelUnread, closeTransientOverlays, communities, currentUserId, markStorySeen, pushToast, switchCommunity]);

  const toggleFeedVoiceMute = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) => voiceService.setMuted(!voiceSnapshot.muted).then((result) => {
      if (!result.ok) pushToast(result.error.message, "error");
    }));
  }, [pushToast, voiceSnapshot.muted]);

  const toggleFeedVoiceDeafen = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) => {
      const result = voiceService.setDeafened(!voiceSnapshot.deafened);
      if (!result.ok) pushToast(result.error.message, "error");
    });
  }, [pushToast, voiceSnapshot.deafened]);

  const leaveFeedVoice = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) => voiceService.leave().then(() => pushToast("Left the voice room.", "info")));
  }, [pushToast]);

  const openFeedScreenShare = useCallback(() => {
    const room = activeVoiceRooms.find((candidate) => candidate.channelName === voiceSnapshot.roomName && candidate.canJoin);
    if (!room) { pushToast("The connected voice room is no longer available.", "error"); return; }
    const community = communities.find((candidate) => candidate.id === room.communityId);
    const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === room.channelId);
    if (!community || !channel) { pushToast("The connected voice channel is no longer available.", "error"); return; }
    setActiveView(communityViewForKind(community.kind));
    switchCommunity(room.communityId, room.channelId);
    closeTransientOverlays();
    pushToast("Screen share controls opened in the connected voice room.", "success");
  }, [activeVoiceRooms, closeTransientOverlays, communities, pushToast, switchCommunity, voiceSnapshot.roomName]);

  const openDiscoveredVoiceRoom = useCallback((room: ActiveVoiceRoomSummary) => {
    const community = communities.find((candidate) => candidate.id === room.communityId);
    const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === room.channelId);
    if (!community || !channel) {
      pushToast("This voice room is no longer available.", "error");
      return;
    }
    const access = getCommunityAccess(currentUserId, community);
    if (!canViewChannel(access, channel) || !room.canJoin) {
      pushToast(room.joinBlockedReason ?? "You cannot join this voice room.", "info");
      return;
    }
    setActiveView(communityViewForKind(community.kind));
    switchCommunity(community.id, channel.id);
    setActiveChannelId(channel.id);
    pushToast(`Opened ${channel.name}. Use Join room to connect.`, "info");
  }, [communities, pushToast, setActiveChannelId, switchCommunity]);

  const joinActiveVoiceRoom = useCallback(() => {
    if (displayedActiveChannel.type !== "voice") {
      pushToast("Select a voice channel before joining voice.", "info");
      return;
    }

    if (communityAccess.isVisitor || !authSession) {
      pushToast(communityAccess.isVisitor ? "Join this community before entering voice." : "Sign in before entering voice.", "error");
      return;
    }

    void import("./services/voiceService").then(({ voiceService }) =>
      voiceService.join({
        communityId: activeCommunity.id,
        channelId: displayedActiveChannel.id,
        participantName: displayedCurrentUser.displayName,
        intent: "voice",
      }).then((result) => {
        if (!result.ok) {
          pushToast(result.error.message, "error");
        }
      }),
    );
  }, [activeCommunity.id, authSession, communityAccess.isVisitor, displayedActiveChannel.id, displayedActiveChannel.type, displayedCurrentUser.displayName, pushToast]);

  const leaveActiveVoiceRoom = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) => voiceService.leave());
  }, []);

  const toggleActiveVoiceMute = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) =>
      voiceService.setMuted(!voiceSnapshot.muted).then((result) => {
        if (!result.ok) pushToast(result.error.message, "error");
      }),
    );
  }, [pushToast, voiceSnapshot.muted]);

  const toggleActiveVoiceDeafen = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) => {
      const result = voiceService.setDeafened(!voiceSnapshot.deafened);
      if (!result.ok) pushToast(result.error.message, "error");
    });
  }, [pushToast, voiceSnapshot.deafened]);

  const startActiveVoiceScreenShare = useCallback((sourceId: string, preset: "presentation" | "balanced" | "performance", sourceLabel?: string) => {
    void import("./services/voiceService").then(({ voiceService }) =>
      voiceService.startScreenShare(sourceId, preset, sourceLabel).then((result) => {
        if (!result.ok) pushToast(result.error.message, "error");
      }),
    );
  }, [pushToast]);

  const stopActiveVoiceScreenShare = useCallback(() => {
    void import("./services/voiceService").then(({ voiceService }) =>
      voiceService.stopScreenShare().then((result) => {
        if (!result.ok) pushToast(result.error.message, "error");
      }),
    );
  }, [pushToast]);

  const openFeedEventCommunity = useCallback((communityId: string) => {
    const targetCommunity = communities.find((community) => community.id === communityId);
    if (!targetCommunity) {
      pushToast("This event community is not available in mock data.", "error");
      return;
    }

    setActiveView(communityViewForKind(targetCommunity.kind));
    switchCommunity(communityId);
    closeTransientOverlays();
  }, [closeTransientOverlays, communities, pushToast, switchCommunity]);

  const openFeedEventDetails = useCallback((event: typeof mockUpcomingEvents[number]) => {
    const targetCommunity = communities.find((community) => community.id === event.communityId);
    if (!targetCommunity) { pushToast("This event is no longer available.", "error"); return; }
    if (event.source === "radio" && event.radioSessionId) {
      communityNavigationService.rememberRadioSession(event.communityId, event.radioSessionId);
      setActiveView("radioCommunity");
      switchCommunity(event.communityId);
    } else {
      setActiveView(communityViewForKind(targetCommunity.kind));
      switchCommunity(event.communityId, event.channelId);
    }
    closeTransientOverlays();
  }, [closeTransientOverlays, communities, pushToast, switchCommunity]);

  const openProfilePage = useCallback((member: Member) => {
    setPreviousViewBeforeProfile((previous) => (activeView === "profile" ? previous : activeView));
    setActiveProfileUserId(member.userId);
    setActiveView("profile");
    closeTransientOverlays();
  }, [activeView, closeTransientOverlays]);

  const openDirectMessages = useCallback((userId?: string) => {
    if (userId && !userBlockingService.canMessageUser(userId)) { pushToast("Unblock this user before opening a direct message.", "error"); return; }
    if (userId) {
      const existing = directConversations.find((candidate) => candidate.participantUserId === userId);
      if (existing) {
        setActiveDirectConversationId(existing.id);
      } else if (dataSourceService.getStatus().isSupabase) {
        void directMessageService.createDirectConversation(userId).then(async (created) => { if (!created.ok) { pushToast(created.error.message, "error"); return; } const loaded = await directMessageService.loadDirectConversations(); if (loaded.ok) { setDirectConversations(loaded.data); setActiveDirectConversationId(created.data); } else pushToast(loaded.error.message, "error"); });
      } else {
        const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId);
        if (member) {
          const conversation: DirectConversation = {
            id: `dm-${userId}`, participantUserId: userId, participantName: member.displayName, participantUsername: member.username,
            participantStatus: member.status, participantStatusText: member.statusText, lastMessagePreview: "Start a conversation",
            updatedAt: new Date().toISOString(), unreadCount: 0, messages: [],
          };
          setDirectConversations((current) => [conversation, ...current]);
          setActiveDirectConversationId(conversation.id);
        }
      }
    }
    setActiveView("directMessages");
    closeTransientOverlays();
  }, [closeTransientOverlays, communities, directConversations, pushToast]);

  const sendDirectMessageLocal = useCallback(async (conversationId: string, body: string, attachments: readonly DirectMessageAttachment[] = [], replyToMessageId?: string, retryClientMessageId?: string): Promise<boolean> => {
    const conversation = directConversations.find((candidate) => candidate.id === conversationId);
    if (conversation && !userBlockingService.canMessageUser(conversation.participantUserId)) { pushToast("Direct messages with this blocked user are disabled.", "error"); return false; }
    const createdAt = new Date().toISOString();
    const clientMessageId = retryClientMessageId ?? crypto.randomUUID();
    setDirectConversations((current) => current.map((item) => { if (item.id !== conversationId) return item; const reply = replyToMessageId ? item.messages.find((message) => message.id === replyToMessageId) : undefined; const optimistic: DirectMessage = { id: `dm-optimistic-${clientMessageId}`, clientMessageId, conversationId, authorId: directMessageUserId, body, createdAt, attachments, replyToMessageId, replyPreview: replyToMessageId ? { messageId: replyToMessageId, authorName: reply?.authorId === directMessageUserId ? "You" : item.participantName, body: !reply ? "Message unavailable" : reply.deletedAt ? "Message deleted" : reply.body } : undefined, sendStatus: "sending" }; const existingIndex = item.messages.findIndex((message) => message.clientMessageId === clientMessageId); const messages = [...item.messages]; if (existingIndex >= 0) messages[existingIndex] = { ...messages[existingIndex], ...optimistic }; else messages.push(optimistic); return { ...item, lastMessagePreview: body, updatedAt: createdAt, unreadCount: 0, messages }; }));
    const result = await directMessageService.sendDirectMessage({ conversationId, body, attachments, replyToMessageId, clientMessageId });
    if (result.ok) { setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, messages: item.messages.map((message) => message.clientMessageId === clientMessageId ? { ...result.data, sendStatus: "sent" } : message), lastMessagePreview: result.data.body, updatedAt: result.data.createdAt } : item)); return true; }
    setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, messages: item.messages.map((message) => message.clientMessageId === clientMessageId ? { ...message, sendStatus: "failed" } : message) } : item));
    pushToast(result.error.message, "error");
    return false;
  }, [directConversations, directMessageUserId, pushToast]);

  const handleDirectRealtimeInsert = useCallback((message: DirectConversation["messages"][number]) => {
    setDirectConversations((current) => current.map((conversation) => {
      if (conversation.id !== message.conversationId) return conversation;
      const index = conversation.messages.findIndex((candidate) => candidate.id === message.id || Boolean(message.clientMessageId && candidate.clientMessageId === message.clientMessageId));
      const messages = [...conversation.messages];
      if (index >= 0) messages[index] = { ...message, sendStatus: "sent" }; else messages.push({ ...message, sendStatus: "sent" });
      const active = activeView === "directMessages" && activeDirectConversationId === conversation.id;
      return { ...conversation, messages, lastMessagePreview: message.deletedAt ? "Message deleted" : message.body, updatedAt: message.createdAt, unreadCount: message.authorId === directMessageUserId || active ? 0 : conversation.unreadCount + (index >= 0 ? 0 : 1) };
    }));
    if (activeView === "directMessages" && activeDirectConversationId === message.conversationId && message.authorId !== directMessageUserId) void directMessageService.markDirectConversationRead(message.conversationId, message.id);
  }, [activeDirectConversationId, activeView, directMessageUserId]);

  const handleDirectRealtimeUpdate = useCallback((message: DirectConversation["messages"][number]) => {
    setDirectConversations((current) => current.map((conversation) => conversation.id === message.conversationId ? { ...conversation, messages: conversation.messages.map((candidate) => candidate.id === message.id ? { ...candidate, ...message } : candidate), lastMessagePreview: message.deletedAt ? "Message deleted" : message.body } : conversation));
  }, []);

  const handleDirectRealtimeDelete = useCallback((conversationId: string, messageId: string) => {
    setDirectConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, messages: conversation.messages.map((message) => message.id === messageId ? { ...message, body: "", deletedAt: new Date().toISOString() } : message), lastMessagePreview: "Message deleted" } : conversation));
  }, []);

  const handleDirectRealtimeReaction = useCallback((type: "add" | "remove", reaction: DirectReactionRow) => {
    setDirectConversations((current) => current.map((conversation) => ({ ...conversation, messages: conversation.messages.map((message) => {
      if (message.id !== reaction.message_id) return message;
      const reactions = [...(message.reactions ?? [])];
      const index = reactions.findIndex((item) => item.emoji === reaction.emoji);
      if (reaction.user_id === directMessageUserId && ((type === "add" && index >= 0 && reactions[index].reactedByCurrentUser) || (type === "remove" && (index < 0 || !reactions[index].reactedByCurrentUser)))) return message;
      const delta = type === "add" ? 1 : -1;
      if (index >= 0) { const next = reactions[index].count + delta; if (next > 0) reactions[index] = { ...reactions[index], count: next, reactedByCurrentUser: reaction.user_id === directMessageUserId ? type === "add" : reactions[index].reactedByCurrentUser }; else reactions.splice(index, 1); }
      else if (type === "add") reactions.push({ emoji: reaction.emoji, count: 1, reactedByCurrentUser: reaction.user_id === directMessageUserId });
      return { ...message, reactions };
    }) })));
  }, [directMessageUserId]);

  const editDirectMessageLocal = useCallback(async (messageId: string, body: string): Promise<boolean> => { const result = await directMessageService.editDirectMessage(messageId, body); if (!result.ok) { pushToast(result.error.message, "error"); return false; } handleDirectRealtimeUpdate(result.data); return true; }, [handleDirectRealtimeUpdate, pushToast]);
  const deleteDirectMessageLocal = useCallback(async (messageId: string): Promise<boolean> => { const result = await directMessageService.deleteDirectMessage(messageId); if (!result.ok) { pushToast(result.error.message, "error"); return false; } handleDirectRealtimeUpdate(result.data); return true; }, [handleDirectRealtimeUpdate, pushToast]);
  const toggleDirectReactionLocal = useCallback(async (message: DirectMessage, emoji: string): Promise<boolean> => { const active = message.reactions?.find((reaction) => reaction.emoji === emoji)?.reactedByCurrentUser === true; const result = active ? await directMessageService.removeDirectReaction(message.id, emoji) : await directMessageService.addDirectReaction(message.id, emoji); if (!result.ok) { pushToast(result.error.message, "error"); return false; } handleDirectRealtimeReaction(active ? "remove" : "add", { id: `local-${message.id}-${emoji}-${directMessageUserId}`, message_id: message.id, user_id: directMessageUserId, emoji, created_at: new Date().toISOString() }); return true; }, [directMessageUserId, handleDirectRealtimeReaction, pushToast]);
  const removeFailedDirectMessage = useCallback((messageId: string) => { setDirectConversations((current) => current.map((conversation) => ({ ...conversation, messages: conversation.messages.filter((message) => message.id !== messageId || message.sendStatus !== "failed") }))); }, []);

  const handleDirectRealtimeAttachment = useCallback((type: "add" | "remove", attachment: DirectSharedMediaItem) => {
    const apply = (resolved: DirectSharedMediaItem) => setDirectConversations((current) => current.map((conversation) => { if (!conversation.messages.some((message) => message.id === resolved.messageId)) return conversation; return { ...conversation, sharedMedia: type === "add" ? [...(conversation.sharedMedia ?? []).filter((item) => item.id !== resolved.id), resolved] : (conversation.sharedMedia ?? []).filter((item) => item.id !== resolved.id), messages: conversation.messages.map((message) => message.id !== resolved.messageId ? message : { ...message, attachments: type === "add" ? [...(message.attachments ?? []).filter((item) => item.id !== resolved.id), resolved] : (message.attachments ?? []).filter((item) => item.id !== resolved.id) }) }; }));
    if (type === "add") void directAttachmentUploadService.resolveDisplayUrl(attachment).then((resolved) => apply({ ...resolved, messageId: attachment.messageId, createdAt: attachment.createdAt })); else apply(attachment);
  }, []);

  const handleDirectReadState = useCallback((conversationId: string, userId: string, lastReadAt?: string, lastReadMessageId?: string) => {
    if (userId !== directMessageUserId) return;
    setDirectConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0, lastReadAt, lastReadMessageId } : conversation));
  }, [directMessageUserId]);

  const refreshDirectConversationSummaries = useCallback(() => {
    if (!dataSourceService.getStatus().isSupabase) return;
    void directMessageService.loadDirectConversations().then((result) => { if (!result.ok) return; setDirectConversations((current) => result.data.map((summary) => { const existing = current.find((item) => item.id === summary.id); return { ...summary, messages: existing?.messages ?? [], sharedMedia: existing?.sharedMedia }; })); });
  }, []);

  useDirectMessageRealtime({
    enabled: true,
    activeConversationId: activeDirectConversationId,
    currentUserId: directMessageUserId,
    isDirectMessagesViewActive: activeView === "directMessages",
    onInsert: handleDirectRealtimeInsert,
    onUpdate: handleDirectRealtimeUpdate,
    onDelete: handleDirectRealtimeDelete,
    onReaction: handleDirectRealtimeReaction,
    onAttachment: handleDirectRealtimeAttachment,
    onReadState: handleDirectReadState,
    onConversationChanged: refreshDirectConversationSummaries,
    mutedConversationIds: directConversations.filter((conversation) => conversation.muted).map((conversation) => conversation.id),
  });

  const openNotificationSource = useCallback((item: NotificationCenterItem) => {
    notificationCenterService.markRead(item.id);
    setNotificationCenterOpen(false);
    if (item.context.kind === "dm" && item.context.userId) { openDirectMessages(item.context.userId); return; }
    if (item.context.kind === "community" && item.context.communityId && item.context.radioSessionId) {
      const target = communities.find((community) => community.id === item.context.communityId);
      const access = target ? getCommunityAccess(currentUserId, target) : null;
      if (target?.kind === "radio" && access && (access.isMember || access.canViewPublicContent)) {
        communityNavigationService.rememberRadioSession(item.context.communityId, item.context.radioSessionId);
        setActiveView("radioCommunity");
        switchCommunity(item.context.communityId);
      } else pushToast("This Radio session is unavailable or private.", "error");
      return;
    }
    if (item.context.kind === "community" && item.context.communityId && item.context.podcastEpisodeId) { void openPodcastEpisodeSource(item.context.communityId, item.context.podcastEpisodeId, "Opened the Podcast mention."); return; }
    if (item.context.kind === "community" && item.context.communityId) {
      const target = communities.find((community) => community.id === item.context.communityId);
      setActiveView(target ? communityViewForKind(target.kind) : "community"); switchCommunity(item.context.communityId, target?.kind === "text" ? item.context.channelId : undefined);
      if (target?.kind === "text" && item.context.channelId) setActiveChannelId(item.context.channelId);
      if (item.context.messageId) setHighlightedMessageId(item.context.messageId);
      return;
    }
    pushToast(item.title, "info");
  }, [communities, openDirectMessages, openPodcastEpisodeSource, pushToast, setActiveChannelId, switchCommunity]);

  const createCommunityEvent = useCallback(async (input: CreateCommunityEventInput) => { const event=await communityEventService.createEvent(input);if(event){setCommunityEvents((current)=>[event,...current]);pushToast("Event created.","success");}else pushToast("Event could not be created.","error"); },[pushToast]);
  const updateCommunityEvent = useCallback(async (eventId: string, input: UpdateCommunityEventInput) => { const event = await communityEventService.updateEvent(eventId, input); if (event) { setCommunityEvents((current) => current.map((item) => item.id === eventId ? event : item)); pushToast("Event updated.", "success"); } else pushToast("Event could not be updated.", "error"); }, [pushToast]);
  const cancelCommunityEvent = useCallback(async (eventId:string) => { if(await communityEventService.cancelEvent(eventId)){setCommunityEvents((current)=>current.map((event)=>event.id===eventId?{...event,cancelledAt:new Date().toISOString()}:event));pushToast("Event cancelled.","success");} },[pushToast]);

  const openFriends = useCallback((tab: FriendViewTab = "all") => {
    setFriendsViewTab(tab);
    setActiveView("friends");
    closeTransientOverlays();
  }, [closeTransientOverlays]);

  const toggleFriendFavorite = useCallback((userId: string) => {
    setFriendState((current) => ({
      ...current,
      friends: current.friends.map((friend) => friend.userId === userId ? { ...friend, favorite: !friend.favorite } : friend),
    }));
  }, []);

  const acceptFriendRequest = useCallback(async (requestId: string) => { const result=await relationshipService.acceptFriendRequest(requestId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request accepted.","success"); }, [pushToast, refreshFriendState]);

  const dismissFriendRequest = useCallback(async (requestId: string) => { const result=await relationshipService.declineFriendRequest(requestId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request declined.","info"); }, [pushToast, refreshFriendState]);
  const cancelFriendRequest = useCallback(async (requestId: string) => { const result=await relationshipService.cancelFriendRequest(requestId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request canceled.","info"); }, [pushToast, refreshFriendState]);

  const handleProfileFriendAction = useCallback(async (userId: string, action: "add" | "cancel" | "accept" | "remove") => {
    if (userId === directMessageUserId) { pushToast("You cannot manage a friendship with your own account.", "error"); return; }
    if (userBlockingService.isBlocked(userId)) { pushToast("Unblock this user before changing the friendship.", "error"); return; }
    if (profileRelationshipBusyUserId === userId) return;
    setProfileRelationshipBusyUserId(userId);
    const request = friendState.requests.find((candidate) => candidate.userId === userId && candidate.status === "pending");
    const result = action === "add"
      ? await relationshipService.sendFriendRequest(userId)
      : action === "remove"
        ? await relationshipService.removeFriend(userId)
        : action === "accept" && request
          ? await relationshipService.acceptFriendRequest(request.id)
          : action === "cancel" && request
            ? await relationshipService.cancelFriendRequest(request.id)
            : { ok: false as const, error: "This friend request is no longer available." };
    if (!result.ok) pushToast(result.error, "error");
    else {
      await refreshFriendState();
      setProfileReloadVersion((version) => version + 1);
      pushToast(action === "add" ? "Friend request sent." : action === "accept" ? "Friend request accepted." : action === "cancel" ? "Friend request canceled." : "Friend removed.", action === "remove" || action === "cancel" ? "info" : "success");
    }
    setProfileRelationshipBusyUserId((current) => current === userId ? null : current);
  }, [directMessageUserId, friendState.requests, profileRelationshipBusyUserId, pushToast, refreshFriendState]);

  const sendFriendRequest = useCallback(async (userId: string) => { const result=await relationshipService.sendFriendRequest(userId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request sent.","success"); }, [pushToast, refreshFriendState]);
  const removeFriend = useCallback(async (userId: string) => { const result=await relationshipService.removeFriend(userId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend removed.","info"); }, [pushToast, refreshFriendState]);
  const blockFriend = useCallback(async (userId: string) => { const friend=friendState.friends.find((item)=>item.userId===userId); if(!friend)return; const result=await relationshipService.blockFriend(friend); if(!result.ok){pushToast(result.error,"error");return;} setBlockedUserVersion((value)=>value+1); await refreshFriendState(); pushToast("User blocked and removed from friends.","success"); }, [friendState.friends, pushToast, refreshFriendState]);
  const unblockFriend = useCallback(async (userId: string) => { const blocked=userBlockingService.listBlockedUsers().find((item)=>item.userId===userId); if(!blocked)return; const persisted=await userBlockingService.setBlockedUser(blocked,false); if(!persisted){pushToast("Could not unblock this user.","error");return;} setBlockedUserVersion((value)=>value+1); await refreshFriendState(); pushToast("User unblocked.","success"); }, [pushToast, refreshFriendState]);

  const closeProfileView = useCallback(() => {
    setActiveView(previousViewBeforeProfile ?? "mentionFeed");
    setPreviousViewBeforeProfile(null);
    closeTransientOverlays();
  }, [closeTransientOverlays, previousViewBeforeProfile]);

  const openProfileActivity = useCallback((activity: ProfileActivityItem) => {
    if (!activity.communityId || !activity.channelId) {
      pushToast("This activity is not linked to an open channel yet.", "info");
      return;
    }

    setActiveView("community");
    switchCommunity(activity.communityId, activity.channelId);
    clearChannelUnread({ communityId: activity.communityId, channelId: activity.channelId });
    closeTransientOverlays();
    if (activity.messageId) {
      const messageId = activity.messageId;
      setHighlightedMessageId(messageId);
      globalThis.setTimeout(() => setHighlightedMessageId((current) => current === messageId ? null : current), 3200);
    }
  }, [clearChannelUnread, closeTransientOverlays, pushToast, switchCommunity]);

  const finishFirstRunOnboarding = useCallback((completion: OnboardingCompletion) => {
    const nextProfileSettings = {
      ...profileSettings,
      displayName: completion.profile.displayName,
      statusText: completion.profile.statusText,
    };
    setProfileSettings(nextProfileSettings);
    setFollowedUserIds(completion.followedUserIds);
    applyManualTheme(completion.theme);
    settingsService.updateSettings({ theme: completion.theme, appearanceSettings: { ...appearanceSettings, themeMode: completion.theme }, profileSettings: nextProfileSettings });
    setOnboardingPhase("complete");
    if (completion.startChoice === "createCommunity") setCreateCommunityOpen(true);
    if (completion.startChoice === "joinInvite" && completion.inviteCode) setPendingInviteCode(completion.inviteCode);

    setActiveView("mentionFeed");
    pushToast("Picom setup completed.", "success");
  }, [profileSettings, pushToast]);

  const finishDesktopFirstLaunchSetup = useCallback(() => {
    const next = settingsService.completeFirstLaunchSetup(theme);
    setFirstLaunchSetupCompleted(next.firstLaunchSetupCompleted);
  }, [theme]);

  if (!safeMode.active && !firstLaunchSetupCompleted) {
    return (
      <DesktopAppShell>
        <WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} />
        <FirstLaunchSetup theme={theme} onThemeChange={applyManualTheme} onComplete={finishDesktopFirstLaunchSetup} />
      </DesktopAppShell>
    );
  }

  if (passwordRecoveryMode || !authReady || !authSession) {
    return (
      <>
        <DesktopAppShell>
          <WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} />
          {maintenanceStatus.status === "maintenance" ? (
            <MaintenanceStatusView status={maintenanceStatus} onRetry={refreshMaintenanceStatus} onOpenStatusPage={openSystemStatusPage} />
          ) : authView === "login" ? (
            <LoginScreen
              theme={theme}
              loading={!authReady || authLoading}
              error={authError}
              onToggleTheme={toggleTheme}
              onSubmit={handleLogin}
              onPasswordResetRequest={handlePasswordResetRequest}
              recoveryMode={passwordRecoveryMode}
              recoveryMessage={passwordRecoveryMessage}
              onConfirmPasswordReset={handlePasswordResetConfirm}
              onCancelPasswordRecovery={() => { setPasswordRecoveryMode(false); setPasswordRecoveryMessage(null); void authService.signOut(); }}
              onSwitchToRegister={() => {
                clearAuthError();
                setAuthView("register");
              }}
            />
          ) : (
            <RegisterScreen
              theme={theme}
              loading={!authReady || authLoading}
              error={authError}
              onToggleTheme={toggleTheme}
              onSubmit={handleRegister}
              onSwitchToLogin={() => {
                clearAuthError();
                setAuthView("login");
              }}
            />
          )}
        </DesktopAppShell>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (legalAcceptancePhase === "checking" && authSession.user) {
    return <DesktopAppShell><WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} /><main className="first-run-onboarding onboarding-loading"><span className="onboarding-welcome-orb"><AppIcon name="lock" size="xl" /></span><strong>Checking policy version...</strong></main></DesktopAppShell>;
  }

  if (legalAcceptancePhase === "required" && authSession.user) {
    return <DesktopAppShell><WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} /><TermsReacceptPrompt loading={legalAcceptanceLoading} error={legalAcceptanceError} onAccept={() => void acceptUpdatedLegalTerms()} onSignOut={() => void handleLogout()} /></DesktopAppShell>;
  }

  if (onboardingPhase === "checking" && authSession.user) {
    return (
      <DesktopAppShell>
        <WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} />
        <main className="first-run-onboarding onboarding-loading"><span className="onboarding-welcome-orb"><AppIcon name="home" size="xl" /></span><strong>Preparing your Picom workspace…</strong></main>
      </DesktopAppShell>
    );
  }

  if (onboardingPhase === "required" && authSession.user) {
    return (
      <>
        <DesktopAppShell>
          <WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => undefined} />
          <DeferredViewBoundary label="Preparing onboarding">
          <OnboardingFlow
            userId={authSession.user.id}
            initialDisplayName={authSession.user.displayName || profileSettings.displayName || currentUser.displayName}
            initialUsername={currentUser.username}
            initialStatusText={profileSettings.statusText || currentUser.statusText}
            initialFollowedUserIds={followedUserIds}
            suggestions={followSuggestionsV2.length ? followSuggestionsV2.map((suggestion) => suggestion.member) : mockFollowSuggestions.filter((member) => !blockedUserIds.includes(member.userId) && !followedUserIds.includes(member.userId))}
            theme={theme}
            onThemeChange={applyManualTheme}
            onComplete={finishFirstRunOnboarding}
          />
          </DeferredViewBoundary>
        </DesktopAppShell>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const openContext = (event: MouseEvent, items: MenuItem[]) => {
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY, items);
  };

  const sendMessage = async (body: string, attachments?: Attachment[], replyToMessageId?: string | null, pollDraft?: CreatePollDraft) => {
    if (!canSendMessage(communityAccess, displayedActiveChannel)) {
      pushToast(communityAccess.isVisitor ? "Join this community to send messages." : "You do not have permission to send messages here.", "error");
      return;
    }

    const moderation = messageModerationFilterService.checkMessage(activeCommunity.id, body, currentUser.userId, displayedActiveChannel.id);
    if (!moderation.allowed) {
      pushToast(moderation.reason ?? "Message blocked by moderation filters.", "error");
      return;
    }
    const clientMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const localOrder = messageSendQueueService.nextLocalOrder(activeCommunity.id, displayedActiveChannel.id);
    const optimisticId = `local-${clientMessageId}`;
    appendLocalMessage({
      id: optimisticId,
      clientMessageId,
      communityId: activeCommunity.id,
      channelId: displayedActiveChannel.id,
      authorId: currentUser.userId,
      body,
      localOrder,
      replyToMessageId,
      attachments,
      localStatus: typeof navigator !== "undefined" && !navigator.onLine ? "queued_offline" : "sending",
    });
    const result = await messageSendQueueService.enqueue({
      communityId: activeCommunity.id,
      channelId: displayedActiveChannel.id,
      authorId: currentUser.userId,
      body,
      clientMessageId,
      replyToMessageId,
      localOrder,
    });

    if (!result.ok) {
      if (result.error.code === "QUEUE_CANCELED") return;
      setLocalMessageDeliveryStatus({ communityId: activeCommunity.id, channelId: displayedActiveChannel.id, id: optimisticId, clientMessageId, localStatus: "failed" });
      const conflict = offlineSyncConflictService.classify({
        actionType: "sendMessage",
        errorCode: result.error.code,
        errorMessage: result.error.message,
      });
      pushToast(conflict.userMessage, "error");
      return;
    }

    const pollResult = pollDraft ? await pollService.create({ ...pollDraft, messageId: result.data.id }) : null;
    if (pollResult && !pollResult.ok) pushToast(pollResult.message, "error");
    analyticsService.trackEvent("message_sent_count_only", { count: 1, mode: dataSourceService.getStatus().mode });
    messageModerationFilterService.recordMessageSent(activeCommunity.id, displayedActiveChannel.id, currentUser.userId);
    appendLocalMessage({
      id: result.data.id,
      clientMessageId,
      communityId: activeCommunity.id,
      channelId: displayedActiveChannel.id,
      authorId: result.data.authorId,
      body: result.data.body,
      localOrder,
      createdAt: result.data.createdAt,
      replyToMessageId: result.data.replyToMessageId,
      attachments,
      poll: pollResult?.ok ? pollResult.data : undefined,
      localStatus: "sent",
    });

    maybeShowNotificationPermissionPrompt("first_message_sent");
    setReplyToMessageId(null);
  };

  const retryFailedMessage = async (message: Message) => {
    if (!message.clientMessageId || (message.localStatus !== "failed" && message.localStatus !== "queued_offline")) return;
    const localStatus = typeof navigator !== "undefined" && !navigator.onLine ? "queued_offline" : "sending";
    setLocalMessageDeliveryStatus({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, clientMessageId: message.clientMessageId, localStatus });
    const result = await messageSendQueueService.enqueue({ communityId: activeCommunity.id, channelId: message.channelId, authorId: message.authorId, body: message.body, clientMessageId: message.clientMessageId, replyToMessageId: message.replyToMessageId, localOrder: message.localOrder ?? messageSendQueueService.nextLocalOrder(activeCommunity.id, message.channelId) });
    if (!result.ok) {
      if (result.error.code === "QUEUE_CANCELED") return;
      setLocalMessageDeliveryStatus({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, clientMessageId: message.clientMessageId, localStatus: "failed" });
      const conflict = offlineSyncConflictService.classify({ actionType: "sendMessage", errorCode: result.error.code, errorMessage: result.error.message });
      pushToast(conflict.userMessage, "error");
      return;
    }
    appendLocalMessage({ id: result.data.id, clientMessageId: message.clientMessageId, communityId: activeCommunity.id, channelId: message.channelId, authorId: result.data.authorId, body: result.data.body, localOrder: message.localOrder, createdAt: result.data.createdAt, replyToMessageId: result.data.replyToMessageId, attachments: message.attachments, localStatus: "sent" });
    pushToast("Message sent after retry.", "success");
  };

  const removeFailedMessage = (message: Message) => {
    if (message.localStatus !== "failed" && message.localStatus !== "queued_offline") return;
    if (message.clientMessageId) messageSendQueueService.cancelPending(message.clientMessageId);
    removeLocalMessage({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id });
    pushToast("Local failed message removed.", "info");
  };

  const canCurrentUserModerate = () => {
    const role = activeCommunity.roles.find((candidate) => candidate.id === currentUser.roleId);
    return (role?.level ?? 0) >= 60;
  };

  const handleSaveMessageEdit = async (message: Message, body: string) => {
    if (message.authorId !== currentUser.userId || message.deletedAt) {
      pushToast("You can only edit your own active messages.", "error");
      return;
    }

    const previousBody = message.body;
    const previousEditedAt = message.editedAt ?? null;
    editLocalMessage({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
      body,
    });
    const result = await messageService.editMessage({ messageId: message.id, body, expectedEditedAt: previousEditedAt });
    if (!result.ok) {
      updateLocalMessage({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, body: previousBody, editedAt: previousEditedAt });
      pushToast(result.error.message, "error");
      return;
    }
    updateLocalMessage({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, body: result.data.body, editedAt: result.data.editedAt });
    setEditingMessageId(null);
  };

  const handleDeleteMessage = async (message: Message) => {
    const ownMessage = message.authorId === currentUser.userId;

    if (!ownMessage && !canCurrentUserModerate()) {
      pushToast("You do not have permission to delete this message.", "error");
      return;
    }

    const needsConfirmation = message.body.length > 80 || Boolean(message.attachments?.length);
    if (needsConfirmation && !window.confirm("Delete this message? Its content and attachments will be hidden. A limited deletion record may remain under Picom's retention and moderation policies.")) {
      return;
    }

    const result = await messageService.deleteMessage({ messageId: message.id, expectedEditedAt: message.editedAt ?? null });
    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }
    deleteLocalMessage({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
    });
    pushToast("Message deleted. Its content is hidden; the deletion marker remains in the conversation.", "success");

    if (replyToMessageId === message.id) {
      setReplyToMessageId(null);
    }
  };

  const handleToggleMessageReaction = async (message: Message, emoji: string) => {
    if (!canSendMessage(communityAccess, displayedActiveChannel)) {
      pushToast(communityAccess.isVisitor ? "Join this community to react to messages." : "You do not have permission to react here.", "error");
      return;
    }

    const currentlyReacted = Boolean(message.reactions?.find((reaction) => reaction.emoji === emoji)?.reactedByCurrentUser);
    toggleLocalReaction({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
      emoji,
    });

    if (dataSourceService.getStatus().isMock) return;
    const result = currentlyReacted
      ? await reactionService.removeReaction({ messageId: message.id, emoji })
      : await reactionService.addReaction({ messageId: message.id, emoji });
    if (!result.ok) {
      toggleLocalReaction({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, emoji });
      pushToast(result.error.message, "error");
      return;
    }
    setLocalReactionSummary({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
      emoji: result.data.emoji,
      count: result.data.count,
      reactedByCurrentUser: result.data.reactedByCurrentUser,
    });
  };

  const handleReportMessage = (message: Message) => {
    const channel = activeCommunity.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === message.channelId);
    const author = activeCommunity.members.find((member) => member.userId === message.authorId);
    setReportTarget({ communityId: activeCommunity.id, channelId: message.channelId, targetType: "message", targetId: message.id, label: `Message by ${author?.displayName ?? "a member"} in #${channel?.name ?? "channel"}` });
  };

  const handleOpenThread = async (message: Message) => {
    const result = await threadService.openOrCreate({ communityId: activeCommunity.id, channelId: message.channelId, parentMessageId: message.id, name: message.body.slice(0, 70) || "Attachment thread", createdBy: currentUser.userId, canCreate: canSendMessage(communityAccess, displayedActiveChannel) });
    if (result.ok) setActiveThread({ thread: result.data, parentMessage: message }); else pushToast(result.message, "error");
  };

  const handleReportUser = (member: Member) => {
    const contextCommunity = communities.find((community) => community.members.some((candidate) => candidate.userId === member.userId)) ?? activeCommunity;
    setReportTarget({ communityId: contextCommunity.id, targetType: "user", targetId: member.userId, label: `${member.displayName} (@${member.username})` });
  };

  const handleToggleBlockUser = async (member: Member) => {
    if (member.userId === currentUser.userId) {
      pushToast("You cannot block your own account.", "error");
      return false;
    }

    const blocked = !userBlockingService.isBlocked(member.userId);
    const persisted = await userBlockingService.setBlockedUser(member, blocked);
    if (!persisted) { pushToast(`Could not ${blocked ? "block" : "unblock"} ${member.displayName}.`, "error"); return false; }
    setBlockedUserVersion((version) => version + 1);
    if (blocked) {
      setDirectConversations((current) => current.filter((conversation) => conversation.participantUserId !== member.userId));
      if (followedUserIds.includes(member.userId)) { await relationshipService.unfollowUser(member.userId); setFollowedUserIds((current) => current.filter((id) => id !== member.userId)); }
      void refreshFriendState();
    }
    setProfileReloadVersion((version) => version + 1);
    pushToast(blocked ? `${member.displayName} blocked.` : `${member.displayName} unblocked.`, blocked ? "info" : "success");
    return true;
  };

  const openJoinedCommunity = (target: Community) => {
    const landing = resolveCommunityJoinLanding(target);
    if (target.kind === "radio") communityNavigationService.rememberRadioSection(target.id, "live");
    if (target.kind === "podcast") communityNavigationService.rememberPodcastSection(target.id, "episodes");
    switchCommunity(target.id, landing.channelId);
    if (landing.channelId) setActiveChannelId(landing.channelId);
    setActiveView(landing.view);
    return landing;
  };

  const handleJoinCommunity = async (rulesAcceptance: { rulesVersion: string; acceptedAt: string } | null) => {
    const result = await communityMembershipService.joinCommunity({
      community: activeCommunity,
      currentUser,
      isAuthenticated: Boolean(authSession),
      rulesAcceptance,
    });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return false;
    }

    replaceCommunityMembers(activeCommunity.id, [
      ...activeCommunity.members.filter((member) => member.userId !== result.data.member.userId),
      result.data.member,
    ]);
    const landing = openJoinedCommunity(activeCommunity);
    pushToast(result.data.status === "already_member" ? `You are already a member of ${activeCommunity.name}. Opened ${landing.landingLabel}.` : `Joined ${activeCommunity.name}. Opened ${landing.landingLabel}.`, "success");
    return true;
  };

  const handleLeaveCommunity = async () => {
    const result = await communityMembershipService.leaveCommunity({
      community: activeCommunity,
      currentUserId,
    });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    replaceCommunityMembers(activeCommunity.id, activeCommunity.members.filter((member) => member.userId !== currentUserId));
    pushToast(`Left ${activeCommunity.name}.`, "info");
  };

  const handleInviteAccepted = async (communityId: string, member: Member, status: InviteAcceptanceStatus, preview: CommunityInvitePreview) => {
    let target = communities.find((community) => community.id === communityId);
    if (!target) {
      const listed = await communityService.listCommunities();
      const summary = listed.ok ? listed.data.find((community) => community.id === communityId) : undefined;
      if (!summary) {
        pushToast(status === "already_member" ? "You are already a member, but the workspace could not be loaded." : "Joined successfully, but the workspace could not be loaded.", "error");
        setPendingInviteCode(null);
        return;
      }
      target = addCommunity(createCommunityFromSummary(summary));
    }

    const defaultRole = target.roles.find((role) => role.id === member.roleId) ?? target.roles.find((role) => role.name === "Member");
    const normalizedMember = { ...member, roleId: defaultRole?.id ?? member.roleId };
    replaceCommunityMembers(communityId, [...target.members.filter((candidate) => candidate.userId !== member.userId), normalizedMember]);
    const landing = openJoinedCommunity(target);
    setPendingInviteCode(null);
    const displayName = target.name || preview.communityName;
    pushToast(status === "already_member" ? `You are already a member of ${displayName}. Opened ${landing.landingLabel}.` : `Joined ${displayName} with invite. Opened ${landing.landingLabel}.`, "success");
  };

  const handleCreateCommunity = async (value: CreateCommunityFormValue): Promise<CreateCommunitySubmitResult> => {
    const result = await communityService.createCommunity(value);

    if (!result.ok) {
      return { ok: false, error: result.error.message };
    }

    const community = addCommunity(createCommunityFromSummary(result.data));
    analyticsService.trackEvent("community_created", { mode: dataSourceService.getStatus().mode, kind: community.kind });
    switchCommunity(community.id);
    setActiveView(communityViewForKind(community.kind));
    setCreateCommunityOpen(false);
    maybeShowNotificationPermissionPrompt("community_created");
    pushToast(`${community.name} ${community.kind} community created.`, "success");
    return { ok: true };
  };

  const handleCreateChannel = async (value: CreateChannelFormValue) => {
    const result = await channelService.createChannel({
      communityId: activeCommunity.id,
      categoryId: value.categoryId,
      name: value.name,
      type: value.type,
      isPrivate: value.isPrivate,
      publicReadEnabled: value.publicReadEnabled,
    });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    const channel = addChannel({
      id: result.data.id,
      communityId: result.data.communityId,
      categoryId: result.data.categoryId,
      name: result.data.name,
      type: result.data.type,
      topic: result.data.topic,
      isPrivate: result.data.isPrivate,
      publicReadEnabled: result.data.publicReadEnabled,
      position: result.data.position,
    });

    if (value.isPrivate) {
      privateChannelPermissionService.saveChannelPermissions(channel.id, value.allowedRoleIds);
    }

    setActiveChannelId(channel.id);
    clearChannelUnread({ communityId: activeCommunity.id, channelId: channel.id });
    setCreateChannelCategoryId(null);
    pushToast(`#${channel.name} created.`, "success");
  };

  const openProfile = (_event: MouseEvent, member: Member) => {
    openProfilePage(member);
  };

  return (
    <>
      <DesktopAppShell>
        <WindowTitleBar theme={theme} onToggleTheme={toggleTheme} onOpenSearch={openPalette} onOpenNotifications={() => setNotificationCenterOpen((open) => !open)} notificationUnreadCount={notificationCenterItems.filter((item) => !item.readAt).length} />
        {maintenanceStatus.status === "maintenance" ? (
          <MaintenanceStatusView status={maintenanceStatus} onRetry={refreshMaintenanceStatus} onOpenStatusPage={openSystemStatusPage} />
        ) : (
        <div className="desktop-frame">
          <SafeModeBanner
            state={safeMode}
            onResetSettings={resetSafeModeSettings}
            onClearCache={clearSafeModeCache}
            onExportLogs={exportSafeModeLogs}
            onRestartNormally={restartNormallyFromSafeMode}
          />
          <MaintenanceStatusBanner status={maintenanceStatus} onRetry={refreshMaintenanceStatus} />
          <ServerRail
            communities={communities}
            activeCommunityId={activeCommunityId}
            homeActive={activeView === "mentionFeed"}
            directMessagesActive={activeView === "directMessages"}
            discoveryActive={activeView === "discovery"}
            onOpenHome={openMentionFeed}
            onOpenDirectMessages={() => openDirectMessages()}
            onOpenDiscovery={() => { setActiveView("discovery"); closeTransientOverlays(); }}
            onSelectCommunity={openCommunityFromRail}
            onOpenSettings={openSettings}
            onUtilityAction={(message) => {
              if (message === "create-community") {
                setCreateCommunityOpen(true);
                return;
              }

              pushToast(message, "info");
            }}
            onContextMenu={(event, community) => {
              const muted = notificationPolicyState.mutedCommunityIds.includes(community.id);
              openContext(event, [
                { label: community.name, disabled: true },
                { label: muted ? "Unmute community" : "Mute community", onSelect: () => { notificationPolicyStateService.setCommunityMuted(community.id, !muted); pushToast(muted ? `${community.name} notifications and feed items unmuted.` : `${community.name} notifications and feed items muted.`, "success"); } },
                { label: "Copy community ID", onSelect: () => void clipboardService.copyText(community.id).then(() => pushToast("Community ID copied.", "success")) },
              ]);
            }}
          />
          {activeView === "discovery" ? (
            <DeferredViewBoundary label="Opening discovery">
            <DiscoveryView
              communities={communities}
              currentUserId={directMessageUserId}
              onView={openCommunityFromRail}
              onJoin={async (communityId) => {
                const community = communities.find((item) => item.id === communityId);
                if (!community) return;
                openCommunityFromRail(community.id);
                pushToast(`Review ${community.name}'s rules from the community menu before joining.`, "info");
              }}
              onReport={(community) => setReportTarget({ targetType: "community", targetId: community.id, communityId: community.id, label: community.name })}
            />
            </DeferredViewBoundary>
          ) : activeView === "mentionFeed" ? (
            <DeferredViewBoundary label="Opening Mention Feed">
            <div className="mention-feed-shell">
              <MentionFeedMain
                items={visibleMentionItems}
                communities={communities}
                friends={friendState.friends}
                events={visibleCommunityEvents}
                stories={visibleStoryItems}
                voiceState={voiceSnapshot}
                activeVoiceRooms={activeVoiceRooms}
                followedUserIds={followedUserIds}
                currentUserId={currentUserId}
                activeTab={mentionTab}
                activeFilter={mentionQuickFilter}
                onTabChange={changeMentionTab}
                onOpenImage={openPreview}
                onOpenInChannel={openMentionInChannel}
                onToggleReaction={toggleMentionReaction}
                onToggleSaved={toggleMentionSaved}
                onMarkRead={markMentionRead}
                onOpenProfile={openProfile}
                onMarkStorySeen={markStorySeen}
                onOpenStoryInChannel={openStoryInChannel}
                onToggleVoiceMute={toggleFeedVoiceMute}
                onToggleVoiceDeafen={toggleFeedVoiceDeafen}
                onLeaveVoice={leaveFeedVoice}
                onOpenVoiceRoom={openDiscoveredVoiceRoom}
                onOpenScreenShare={openFeedScreenShare}
                onOpenEventCommunity={openFeedEventCommunity}
                onEventDetails={openFeedEventDetails}
                onCopyAudioReference={(item) => {
                  const sourceId = item.sourceId ?? item.id.replace(/^feed-/, "");
                  const reference = item.type === "podcast_episode"
                    ? `picom://community/${item.communityId}/podcast/${sourceId}`
                    : `picom://community/${item.communityId}/radio/${sourceId}`;
                  void clipboardService.copyText(reference).then(() => pushToast("Feed reference copied.", "success"));
                }}
                onReportAudio={(item) => {
                  const sourceId = item.sourceId ?? item.id.replace(/^feed-/, "");
                  setReportTarget({ communityId: item.communityId, targetType: item.type === "podcast_episode" ? "podcast_episode" : "radio_session", targetId: sourceId, label: item.title, evidenceExcerpt: item.body.slice(0, 280) });
                }}
                onOpenMore={(event, item) =>
                  openContext(event, [
                    {
                      label: item.isSaved ? "Unsave mention" : "Save mention",
                      onSelect: () => toggleMentionSaved(item.id),
                    },
                    {
                      label: item.isUnread ? "Mark as read" : "Already read",
                      disabled: !item.isUnread,
                      onSelect: () => markMentionRead(item.id),
                    },
                    {
                      label: "Open in channel",
                      onSelect: () => openMentionInChannel(item),
                    },
                    {
                      label: "Copy message reference",
                      onSelect: () => void clipboardService.copyText(`picom://community/${item.communityId}/channel/${item.channelId}/message/${item.messageId}`).then(() => pushToast("Message reference copied.", "success")),
                    },
                    {
                      label: "Report message",
                      onSelect: () => setReportTarget({ communityId: item.communityId, channelId: item.channelId, targetType: "message", targetId: item.messageId, label: `Feed message ${item.messageId}`, evidenceExcerpt: item.body.slice(0, 280) }),
                    },
                  ])
                }
              />
              <MentionRightPanel
                items={visibleMentionItems}
                communities={communities}
                popularUserIds={[...mockPopularUserIds]}
                followedUserIds={followedUserIds}
                suggestedUserIds={followSuggestionsV2.map((suggestion) => suggestion.member.userId)}
                blockedUserIds={blockedUserIds}
                activeFilter={mentionQuickFilter}
                onFilterChange={toggleMentionFilter}
                onOpenProfile={openProfile}
              />
            </div>
            </DeferredViewBoundary>
          ) : activeView === "profile" && selectedProfileMember && selectedUserProfile ? (
            <DeferredViewBoundary label="Opening profile">
            <ProfileView
              member={selectedProfileMember}
              profile={selectedUserProfile}
              communities={communities}
              currentUserId={directMessageUserId}
              onBack={closeProfileView}
              onToggleFollow={toggleFollowUser}
              onMessage={openDirectMessages}
              onFriendAction={handleProfileFriendAction}
              onOpenActivity={openProfileActivity}
              onOpenImage={openPreview}
              onOpenCommunity={openFeedEventCommunity}
              dataState={dataSourceService.getStatus().isSupabase ? remoteProfileLoadState : "ready"}
              dataError={remoteProfileLoadError}
              onRetryData={() => setProfileReloadVersion((version) => version + 1)}
              onEditProfile={() => { settingsService.requestInitialSection("Profile"); openSettings(); }}
              onRequestVerification={() => { settingsService.requestInitialSection("Profile"); openSettings(); }}
              isBlocked={blockedUserIds.includes(selectedUserProfile.id)}
              relationshipBusy={profileRelationshipBusyUserId === selectedUserProfile.id}
              onOpenMore={(event, profile) => {
                const request = friendState.requests.find((candidate) => candidate.userId === profile.id && candidate.status === "pending");
                const friendAction = profile.friendshipStatus === "friends" ? "remove" : profile.friendshipStatus === "outgoing" ? "cancel" : profile.friendshipStatus === "incoming" ? "accept" : "add";
                const friendLabel = friendAction === "remove" ? "Remove friend" : friendAction === "cancel" ? "Cancel friend request" : friendAction === "accept" ? "Accept friend request" : "Add friend";
                const openProfileSettings = () => { settingsService.requestInitialSection("Profile"); openSettings(); };
                openContext(event, profile.isCurrentUser ? [
                  { label: "Edit profile", onSelect: openProfileSettings },
                  { label: "Verification status and request", onSelect: openProfileSettings },
                  { label: "Copy user ID", onSelect: () => void clipboardService.copyText(profile.id) },
                ] : [
                  { label: "Message", onSelect: () => openDirectMessages(profile.id), disabled: blockedUserIds.includes(profile.id) },
                  { label: profile.isFollowing ? "Unfollow" : "Follow", onSelect: () => void toggleFollowUser(profile.id), disabled: blockedUserIds.includes(profile.id) || profileRelationshipBusyUserId === profile.id },
                  { label: friendLabel, onSelect: () => void handleProfileFriendAction(profile.id, friendAction), disabled: blockedUserIds.includes(profile.id) || profileRelationshipBusyUserId === profile.id || ((friendAction === "accept" || friendAction === "cancel") && !request) },
                  { label: blockedUserIds.includes(profile.id) ? "Unblock user" : "Block user", onSelect: () => { if (selectedProfileMember) void handleToggleBlockUser(selectedProfileMember); } },
                  { label: "Report user", onSelect: () => { if (selectedProfileMember) handleReportUser(selectedProfileMember); } },
                  { label: "Copy user ID", onSelect: () => void clipboardService.copyText(profile.id) },
                ]);
              }}
            />
            </DeferredViewBoundary>
          ) : activeView === "savedMessages" ? (
            <DeferredViewBoundary label="Opening saved messages">
            <SavedMessagesView items={savedMessages} communities={communities} onBack={() => setActiveView("community")} onOpen={(item) => { const community=communities.find((candidate)=>candidate.id===item.communityId);const message=community?.messages.find((candidate)=>candidate.id===item.messageId);if(community&&message)jumpToMessage(community,message);else pushToast("This saved message is unavailable or inaccessible.","error"); }} onUnsave={(item) => { void savedMessageService.unsaveMessage(item.messageId).then(async (ok) => { if (ok) setSavedMessages(await savedMessageService.getSavedMessages()); else pushToast("Saved Messages could not be updated.", "error"); }); }} />
            </DeferredViewBoundary>
          ) : activeView === "directMessages" ? (
            <DeferredViewBoundary label="Opening direct messages">
            <DirectMessagesView
              conversations={directConversations}
              activeConversationId={activeDirectConversationId}
              currentUserId={directMessageUserId}
              currentUserDisplayName={currentUser.displayName}
              friendRequestCount={friendState.counts.pending}
              onSelectConversation={(conversationId) => { setActiveDirectConversationId(conversationId); setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item)); void directMessageService.markDirectConversationRead(conversationId); }}
              onSendMessage={sendDirectMessageLocal}
              onEditMessage={editDirectMessageLocal}
              onDeleteMessage={deleteDirectMessageLocal}
              onToggleReaction={toggleDirectReactionLocal}
              onRemoveFailedMessage={removeFailedDirectMessage}
              onOpenCommunity={openCommunityFromRail}
              onBlockUser={async (userId) => { const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId); if (!member) { pushToast("This user is no longer available.", "error"); return false; } return handleToggleBlockUser(member); }}
              onReportUser={(userId, conversationId) => { const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId); if (member) setReportTarget({ conversationId, targetType: "user", targetId: member.userId, label: `${member.displayName} (@${member.username})` }); else pushToast("This user is no longer available.", "error"); }}
              onReportMessage={(message, conversation) => setReportTarget({ conversationId: conversation.id, targetType: "direct_message", targetId: message.id, label: `Message from ${conversation.participantName}`, evidenceExcerpt: message.body.slice(0, 280) })}
              onNotice={(message, kind = "info") => pushToast(message, kind)}
              onSetMuted={async (conversationId, mutedUntil) => { const muted = Boolean(mutedUntil && Date.parse(mutedUntil) > Date.now()); const result = await directMessageService.setDirectConversationMuted(conversationId, mutedUntil); if (!result.ok) { pushToast(result.error.message, "error"); return false; } setDirectConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, muted, mutedUntil: mutedUntil ?? undefined } : conversation)); return true; }}
              onArchive={async (conversationId) => { const result = await directMessageService.setDirectConversationArchived(conversationId, true); if (!result.ok) { pushToast(result.error.message, "error"); return false; } setDirectConversations((current) => { const remaining = current.filter((conversation) => conversation.id !== conversationId); setActiveDirectConversationId(remaining[0]?.id ?? ""); return remaining; }); return true; }}
              onBackToCommunity={() => setActiveView("community")}
              onOpenFriends={() => openFriends("all")}
              onOpenPendingFriends={() => openFriends("pending")}
              onOpenProfile={(userId) => {
                const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId);
                if (member) openProfilePage(member);
              }}
            />
            </DeferredViewBoundary>
          ) : activeView === "friends" ? (
            <DeferredViewBoundary label="Opening friends">
            <FriendsView
              friends={friendState.friends}
              requests={friendState.requests}
              suggestions={friendState.suggestions}
              counts={friendState.counts}
              blockedUsers={userBlockingService.listBlockedUsers()}
              activeTab={friendsViewTab}
              onTabChange={setFriendsViewTab}
              onBackToCommunity={() => setActiveView("community")}
              onOpenDirectMessage={openDirectMessages}
              onOpenProfile={(userId) => {
                const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId);
                if (member) openProfilePage(member);
              }}
              onToggleFavorite={toggleFriendFavorite}
              onAcceptRequest={acceptFriendRequest}
              onDismissRequest={dismissFriendRequest}
              onCancelRequest={cancelFriendRequest}
              onSendRequest={sendFriendRequest}
              onRemoveFriend={removeFriend}
              onBlockFriend={blockFriend}
              onUnblockFriend={unblockFriend}
            />
            </DeferredViewBoundary>
          ) : activeView === "podcastCommunity" && displayedActiveCommunity.kind === "podcast" ? (
            <DeferredViewBoundary label="Opening podcast community">
              <PodcastCommunityShell
                community={displayedActiveCommunity}
                canPublish={communityAccess.permissions.includes("publishPodcasts")}
                canEdit={communityAccess.permissions.includes("publishPodcasts") || communityAccess.permissions.includes("editPodcastMetadata")}
                canModerateComments={communityAccess.permissions.includes("moderatePodcastComments")}
                canModerateEpisodes={communityAccess.permissions.includes("moderatePodcastEpisodes")}
                onOpenProfile={openProfilePage}
                onReport={setReportTarget}
              />
            </DeferredViewBoundary>
          ) : activeView === "radioCommunity" && displayedActiveCommunity.kind === "radio" ? (
            <DeferredViewBoundary label="Opening radio community">
              <RadioCommunityShell
                community={displayedActiveCommunity}
                currentUser={displayedCurrentUser}
                canManageAudio={communityAccess.isOwner || communityAccess.permissions.some((permission) => ["manageCommunity", "hostRadio", "manageRadioPrograms"].includes(permission))}
                onOpenProfile={openProfilePage}
              />
            </DeferredViewBoundary>
          ) : (
            <>
              <CommunitySidebar
                community={displayedActiveCommunity}
                communities={communities}
                access={communityAccess}
                activeChannelId={displayedActiveChannel.id}
                currentUser={displayedCurrentUser}
                isAuthenticated={Boolean(authSession)}
                onSelectChannel={(channel) => {
                  setActiveView("community");
                  setActiveChannelId(channel.id);
                  clearChannelUnread({ communityId: activeCommunity.id, channelId: channel.id });
                }}
                audioActive={activeView === "podcastCommunity"}
                onOpenAudio={() => setActiveView(communityViewForKind(displayedActiveCommunity.kind))}
                onCreateChannel={(categoryId) => setCreateChannelCategoryId(categoryId)}
                onOpenSettings={openSettings}
                onLogout={handleLogout}
                onJoinCommunity={handleJoinCommunity}
                onLeaveCommunity={handleLeaveCommunity}
                pendingInviteCode={pendingInviteCode}
                onClearPendingInviteCode={() => setPendingInviteCode(null)}
                onInviteAccepted={handleInviteAccepted}
                onMemberRolesChanged={(memberId, roleIds, primaryRoleId) => replaceCommunityMembers(activeCommunity.id, activeCommunity.members.map((member) => member.id === memberId ? { ...member, roleId: primaryRoleId, roleIds } : member))}
                onCommunityRolesChanged={(roles) => replaceCommunities(communities.map((community) => community.id === activeCommunity.id ? { ...community, roles } : community))}
                onCommunityUpdated={(summary) => replaceCommunities(communities.map((community) => community.id !== summary.id ? community : { ...community, kind: summary.kind, ownerId: summary.ownerId ?? community.ownerId, name: summary.name, description: summary.description, icon: summary.iconUrl ?? "", accentColor: summary.accentColor, visibility: summary.visibility, publicReadEnabled: summary.publicReadEnabled }))}
                onPlaceholderAction={(message) => pushToast(message, "info")}
                events={communityEvents}
                onCreateEvent={(input) => void createCommunityEvent(input)}
                onUpdateEvent={(eventId, input) => void updateCommunityEvent(eventId, input)}
                onCancelEvent={(eventId) => void cancelCommunityEvent(eventId)}
                onCreateCategory={(name) => {
                  const category = addCategory({ communityId: activeCommunity.id, name });
                  pushToast(`${category.name} category created locally.`, "success");
                }}
                onRenameCategory={(categoryId, name) => {
                  renameCategory({ communityId: activeCommunity.id, categoryId, name });
                  pushToast("Category renamed locally.", "success");
                }}
                onDeleteCategory={(categoryId) => {
                  deleteCategory({ communityId: activeCommunity.id, categoryId });
                  pushToast("Category deleted locally; channels moved safely.", "info");
                }}
                onMoveChannel={(categoryId, channelId, direction) => {
                  moveChannel({ communityId: activeCommunity.id, categoryId, channelId, direction });
                  pushToast("Channel order updated locally.", "success");
                }}
                onChannelContextMenu={(event, channel) =>
                  openContext(event, [
                    {
                      label: "Copy channel ID",
                      onSelect: () => clipboardService.copyText(channel.id).then(() => pushToast("Channel ID copied.", "success")),
                    },
                    {
                      label: notificationPolicyState.mutedChannelIds.includes(channel.id) ? "Unmute channel" : "Mute channel",
                      onSelect: () => {
                        const muted = notificationPolicyState.mutedChannelIds.includes(channel.id);
                        notificationPolicyStateService.setChannelMuted(channel.id, !muted);
                        pushToast(muted ? `#${channel.name} notifications and feed items unmuted.` : `#${channel.name} notifications and feed items muted.`, "success");
                      },
                    },
                    {
                      label: "Export message history placeholder",
                      disabled: !communityAccess.isOwner && !communityAccess.permissions.includes("manageCommunity"),
                      onSelect: () => {
                        const result = messageHistoryExportService.requestChannelExportPlaceholder({
                          communityId: activeCommunity.id,
                          channelId: channel.id,
                          requestedById: currentUser.userId,
                          format: "json",
                          canExport: communityAccess.isOwner || communityAccess.permissions.includes("manageCommunity"),
                        });

                        pushToast(
                          result.ok ? `Message export placeholder queued: ${result.data.exportId}.` : result.error.message,
                          result.ok ? "info" : "error",
                        );
                      },
                    },
                    ...(canManageChannels(communityAccess) ? [{ label: "Edit channel", onSelect: () => setEditingChannel(channel) }, { label: "Delete channel", tone: "danger" as const, onSelect: () => setDeletingChannel(channel) }] : []),
                  ])
                }
              />
              {displayedActiveChannel.type === "voice" ? (
                <DeferredViewBoundary label="Opening voice room">
                <VoiceRoomView
                  community={displayedActiveCommunity}
                  channel={displayedActiveChannel}
                  snapshot={voiceSnapshot}
                  onJoin={joinActiveVoiceRoom}
                  onLeave={leaveActiveVoiceRoom}
                  onToggleMute={toggleActiveVoiceMute}
                  onToggleDeafen={toggleActiveVoiceDeafen}
                  onStartScreenShare={startActiveVoiceScreenShare}
                  onStopScreenShare={stopActiveVoiceScreenShare}
                />
                </DeferredViewBoundary>
              ) : (
              <ChatMain
                community={displayedActiveCommunity}
                access={communityAccess}
                channel={displayedActiveChannel}
                messages={displayedActiveCommunity.messages}
                realtimeStatus={realtimeStatus}
                typingNames={typingBroadcast.typingNames}
                onTypingStart={typingBroadcast.sendTypingStart}
                onTypingStop={typingBroadcast.sendTypingStop}
                onSendMessage={sendMessage}
                onOpenInvite={() => setComposerInviteOpen(true)}
                onOpenTopic={() => pushToast("Channel topic editing is prepared in the channel settings foundation.", "info")}
                onOpenPoll={() => setPollCreateOpen(true)}
                onMessageListNearBottomChange={setIsActiveMessageListNearBottom}
                currentUserId={currentUser.userId}
                readReceiptsEnabled={userSafetySettings.enableReadReceipts}
                highlightedMessageId={highlightedMessageId}
                replyToMessage={replyToMessage}
                editingMessageId={editingMessageId}
                onCancelReply={() => setReplyToMessageId(null)}
                membersVisible={membersVisible && communityAccess.canViewMemberList}
                onToggleMembers={communityAccess.canViewMemberList ? toggleMembersVisible : () => pushToast("Join this community to view its member directory.", "info")}
                onMessageContextMenu={(event, message) =>
                  openContext(event, [
                    {
                      label: "Reply",
                      disabled: Boolean(message.deletedAt) || !canSendMessage(communityAccess, displayedActiveChannel),
                      onSelect: () => setReplyToMessageId(message.id),
                    },
                    {
                      label: "React with 👍",
                      disabled: Boolean(message.deletedAt) || !canSendMessage(communityAccess, displayedActiveChannel),
                      onSelect: () => handleToggleMessageReaction(message, "👍"),
                    },
                    {
                      label: "Edit message",
                      disabled: message.authorId !== currentUser.userId || Boolean(message.deletedAt),
                      onSelect: () => setEditingMessageId(message.id),
                    },
                    {
                      label: "Delete message",
                      tone: "danger",
                      disabled: Boolean(message.deletedAt) || (message.authorId !== currentUser.userId && !canCurrentUserModerate()),
                      onSelect: () => handleDeleteMessage(message),
                    },
                    { label: savedMessageService.isMessageSaved(message.id) ? "Unsave message" : "Save message", onSelect: () => void toggleSavedMessage(displayedActiveCommunity, message) },
                    {
                      label: "Report message",
                      disabled: Boolean(message.deletedAt) || message.authorId === currentUser.userId,
                      onSelect: () => handleReportMessage(message),
                    },
                    { label: "Start or open thread", disabled: Boolean(message.deletedAt), onSelect: () => void handleOpenThread(message) },
                    {
                      label: "Copy message ID",
                      onSelect: () => clipboardService.copyText(message.id).then(() => pushToast("Message ID copied.", "success")),
                    },
                  ])
                }
                onOpenProfile={openProfile}
                onOpenImage={openPreview}
                onReplyMessage={(message) => setReplyToMessageId(message.id)}
                onStartEditMessage={(message) => setEditingMessageId(message.id)}
                onCancelEditMessage={() => setEditingMessageId(null)}
                onSaveEditMessage={handleSaveMessageEdit}
                onDeleteMessage={handleDeleteMessage}
                onToggleReaction={handleToggleMessageReaction}
                onRetryMessage={(message) => void retryFailedMessage(message)}
                onRemoveFailedMessage={removeFailedMessage}
                blockedUserIds={blockedUserIds}
                onOpenJoinCommunity={() => pushToast("Review and accept the community rules from the community menu before joining.", "info")}
                pushToast={pushToast}
              />
              )}
              {membersVisible && communityAccess.canViewMemberList ? (
                <MemberSidebar
                  community={displayedActiveCommunity}
                  onOpenProfile={openProfile}
                  onMemberContextMenu={(event, member) => {
                    const moderationActions: { action: MemberModerationAction; label: string }[] = [{ action: "timeout", label: "Timeout member" }, { action: "kick", label: "Remove member" }, { action: "ban", label: "Ban member" }];
                    openContext(event, [
                      { label: `View ${member.displayName}`, onSelect: () => openProfilePage(member) },
                      { label: "Open direct message", onSelect: () => openDirectMessages(member.userId) },
                      { label: "Open friends foundation", onSelect: openFriends },
                      { label: "Report user", disabled: member.userId === currentUser.userId, onSelect: () => handleReportUser(member) },
                      ...moderationActions.filter(({ action }) => canModerateCommunityMember(communityAccess, activeCommunity, member, action)).map(({ action, label }) => ({ label, tone: action === "timeout" ? "normal" as const : "danger" as const, onSelect: () => setMemberModerationTarget({ member, action }) })),
                    ]);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
        )}
      </DesktopAppShell>
      <GlobalAudioMiniPlayer hidden={activeView === "mentionFeed"} />

      {createCommunityOpen ? <CreateCommunityModal onClose={() => setCreateCommunityOpen(false)} onSubmit={handleCreateCommunity} /> : null}
      {createChannelCategoryId ? (
        <CreateChannelModal
          community={activeCommunity}
          defaultCategoryId={createChannelCategoryId}
          onClose={() => setCreateChannelCategoryId(null)}
          onSubmit={handleCreateChannel}
        />
      ) : null}
      {editingChannel ? <EditChannelModal
        channel={editingChannel}
        categories={activeCommunity.categories}
        onClose={() => setEditingChannel(null)}
        onSubmit={async (value: EditChannelFormValue) => {
          const result = await channelService.updateChannel({ channelId: editingChannel.id, communityId: activeCommunity.id, ...value, topic: value.topic || null });
          if (!result.ok) { pushToast(result.error.message, "error"); return; }
          const updated = result.data;
          replaceCommunities(communities.map((community) => community.id !== activeCommunity.id ? community : { ...community, categories: community.categories.map((category) => ({ ...category, channels: category.id === updated.categoryId ? [...category.channels.filter((item) => item.id !== updated.id), { ...editingChannel, name: updated.name, type: updated.type, topic: updated.topic ?? undefined, isPrivate: updated.isPrivate, publicReadEnabled: updated.publicReadEnabled, categoryId: updated.categoryId ?? undefined }] : category.channels.filter((item) => item.id !== updated.id) })) }));
          setEditingChannel(null);
          pushToast("Channel updated.", "success");
        }}
      /> : null}
      {deletingChannel ? <DeleteChannelModal
        channel={deletingChannel}
        isLastChannel={activeCommunity.categories.flatMap((category) => category.channels).length <= 1}
        onClose={() => setDeletingChannel(null)}
        onConfirm={async (confirmationName) => {
          const fallback = activeCommunity.categories.flatMap((category) => category.channels).find((item) => item.id !== deletingChannel.id && canViewChannel(communityAccess, item));
          const result = await channelService.deleteChannel({ channelId: deletingChannel.id, communityId: activeCommunity.id, channelName: deletingChannel.name, confirmName: confirmationName, fallbackChannelId: fallback?.id ?? null });
          if (!result.ok) { pushToast(result.error.message, "error"); return; }
          replaceCommunities(communities.map((community) => community.id !== activeCommunity.id ? community : { ...community, categories: community.categories.map((category) => ({ ...category, channels: category.channels.filter((item) => item.id !== deletingChannel.id) })), messages: community.messages.filter((message) => message.channelId !== deletingChannel.id) }));
          if (activeChannel.id === deletingChannel.id && result.data.fallbackChannelId) setActiveChannelId(result.data.fallbackChannelId);
          setDeletingChannel(null);
          pushToast("Channel deleted.", "success");
        }}
      /> : null}
      {settingsOpen ? <Suspense fallback={null}><SettingsModal theme={theme} accessibilitySettings={accessibilitySettings} appearanceSettings={appearanceSettings} profileSettings={profileSettings} communities={communities} onThemeChange={setTheme} onAccessibilitySettingsChange={setAccessibilitySettings} onAppearanceSettingsChange={(next) => { setAppearanceSettings(next); setTheme(appearanceService.resolveTheme(next.themeMode)); }} onProfileSettingsChange={setProfileSettings} onClose={closeSettings} pushToast={pushToast} onAccountDeletionRequested={() => { closeSettings(); void handleLogout(); }} onLogout={handleLogout} currentUsername={currentUser.username} currentEmail={authSession?.user?.email} ownedCommunityCount={communities.filter((community) => community.ownerId === currentUser.userId).length} currentEmailVerifiedAt={authSession?.user?.emailVerifiedAt} requireEmailVerification={appConfig.supabase.requireEmailVerification} developerPortalContext={{ communityId: displayedActiveCommunity.id, communityName: displayedActiveCommunity.name, ownerId: displayedActiveCommunity.ownerId ?? currentUser.userId, canManageBots: communityAccess.permissions.includes("manageCommunity"), canManageWebhooks: communityAccess.permissions.includes("manageChannels") }} /></Suspense> : null}
      {reportTarget ? <ReportModal target={reportTarget} reporterId={currentUser.userId} onClose={() => setReportTarget(null)} onResult={(message, ok) => pushToast(message, ok ? "success" : "error")} /> : null}
      {memberModerationTarget ? <MemberModerationModal
        member={memberModerationTarget.member}
        action={memberModerationTarget.action}
        onClose={() => setMemberModerationTarget(null)}
        onConfirm={async (reason, timeoutMinutes) => {
          if (!canModerateCommunityMember(communityAccess, activeCommunity, memberModerationTarget.member, memberModerationTarget.action)) { pushToast("You cannot manage this member.", "error"); return false; }
          const result = await memberManagementService.moderateMember({ communityId: activeCommunity.id, actorId: currentUser.userId, targetUserId: memberModerationTarget.member.userId, targetDisplayName: memberModerationTarget.member.displayName, action: memberModerationTarget.action, reason, timeoutMinutes });
          if (!result.ok) { pushToast(result.message, "error"); return false; }
          replaceCommunityMembers(activeCommunity.id, memberModerationTarget.action === "timeout" ? activeCommunity.members.map((member) => member.userId === memberModerationTarget.member.userId ? { ...member, status: "idle", statusText: `Timed out until ${new Date(result.data.timeoutUntil ?? Date.now()).toLocaleString()}` } : member) : activeCommunity.members.filter((member) => member.userId !== memberModerationTarget.member.userId));
          pushToast(`${memberModerationTarget.member.displayName}: ${memberModerationTarget.action} completed.`, "success");
          return true;
        }}
      /> : null}
      {composerInviteOpen ? <InvitePeopleModal community={displayedActiveCommunity} currentUserId={currentUser.userId} canCreate={communityAccess.permissions.includes("createInvites")} onClose={() => setComposerInviteOpen(false)} /> : null}
      {pollCreateOpen ? <CreatePollModal channelName={displayedActiveChannel.name} onClose={() => setPollCreateOpen(false)} onCreate={(draft) => sendMessage(draft.question, undefined, null, draft)} /> : null}
      {activeThread ? <ThreadPanel thread={activeThread.thread} parentMessage={activeThread.parentMessage} members={displayedActiveCommunity.members} currentUser={currentUser} canSend={canSendMessage(communityAccess, displayedActiveChannel)} onClose={() => setActiveThread(null)} onNotice={pushToast} /> : null}
      {notificationPermissionPrompt ? (
        <NotificationPermissionPrompt
          prompt={notificationPermissionPrompt}
          onAllow={() => {
            void notificationService.requestPermission().then((result) => {
              notificationPermissionOnboardingService.markPermissionRequested(
                notificationService.getStatus().permission,
                notificationPermissionPrompt.trigger,
              );
              setNotificationPermissionPrompt(null);
              pushToast(
                result.ok ? "Notification permission enabled." : result.reason ?? "Notification permission was not granted.",
                result.ok ? "success" : "info",
              );
            });
          }}
          onDismiss={() => {
            notificationPermissionOnboardingService.dismiss(notificationPermissionPrompt.trigger);
            setNotificationPermissionPrompt(null);
            pushToast("Notification permission prompt dismissed.", "info");
          }}
        />
      ) : null}
      {notificationCenterOpen ? <NotificationCenterPopover items={notificationCenterItems} onClose={() => setNotificationCenterOpen(false)} onOpenSource={openNotificationSource} /> : null}
            {paletteOpen ? (
        <CommandPalette
          communities={communities}
          query={paletteQuery}
          setQuery={setPaletteQuery}
          results={paletteResults}
          selectedIndex={Math.min(paletteIndex, Math.max(0, paletteResults.length - 1))}
          setSelectedIndex={setPaletteIndex}
          loading={paletteSearchLoading}
          onClose={closePalette}
        />
      ) : null}
      {menu ? <DesktopContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} /> : null}
      {profile ? <UserProfilePopover member={profile.member} community={activeCommunity} x={profile.x} y={profile.y} onClose={closeProfile} onViewProfile={openProfilePage} onReportUser={handleReportUser} isBlocked={blockedUserIds.includes(profile.member.userId)} onToggleBlock={handleToggleBlockUser} /> : null}
      {preview ? <ImagePreviewModal image={preview} onClose={closePreview} /> : null}
      {crashRecoveryRecord ? (
        <CrashRecoveryDialog
          record={crashRecoveryRecord}
          onContinue={continueAfterCrashRecovery}
          onSafeMode={startSafeModeFromCrashRecovery}
          onExportLogs={exportCrashRecoveryLogs}
          onResetSettings={resetSettingsFromCrashRecovery}
        />
      ) : null}
      {isAppLocked ? <AppLockScreen currentUser={displayedCurrentUser} onUnlock={unlockApp} onLogout={logoutFromLockScreen} /> : null}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
