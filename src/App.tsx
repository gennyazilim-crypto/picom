import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
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
import type { DirectConversation } from "./types/directMessages";
import type { FriendState } from "./types/friends";
import type { MentionFeedTab, MentionItem, MentionQuickFilter } from "./types/mentions";
import type { ProfileActivityItem } from "./types/profile";
import type { FollowedUserStory } from "./types/stories";
import type { CommunityTemplateId } from "./types/communityTemplates";
import type { CommunityAccess } from "./types/communityAccess";
import type { OnboardingCompletion } from "./types/onboarding";
import type { MockVoiceState } from "./types/voice";
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
import { SettingsModal } from "./components/SettingsModal";
import { TermsReacceptPrompt } from "./components/legal/TermsReacceptPrompt";
import { ToastStack } from "./components/ToastStack";
import { LoginScreen } from "./components/LoginScreen";
import { RegisterScreen } from "./components/RegisterScreen";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { MaintenanceStatusBanner, MaintenanceStatusView } from "./components/MaintenanceStatusView";
import { CreateCommunityModal } from "./components/CreateCommunityModal";
import { CreateChannelModal, type CreateChannelFormValue } from "./components/CreateChannelModal";
import { AppLockScreen } from "./components/AppLockScreen";
import { MentionFeedMain } from "./components/MentionFeedMain";
import { MentionRightPanel } from "./components/MentionRightPanel";
import { ProfileView } from "./components/ProfileView";
import { DirectMessagesView } from "./components/DirectMessagesView";
import { useDirectMessageRealtime } from "./hooks/useDirectMessageRealtime";
import type { DirectReactionRow } from "./services/supabase/directMessageRealtimeService";
import { directMessageService } from "./services/supabase/directMessageService";
import { relationshipService } from "./services/relationshipService";
import { profileVerificationService } from "./services/profileVerificationService";
import type { VerificationBadge } from "./types/verification";
import { rankFollowSuggestions } from "./utils/followSuggestionRanking";
import { advancedSearchService } from "./services/advancedSearchService";
import { termsAcceptanceService } from "./services/termsAcceptanceService";
import { savedMessageService, type SavedMessageRecord } from "./services/savedMessageService";
import { SavedMessagesView } from "./components/SavedMessagesView";
import { DiscoveryView } from "./components/DiscoveryView";
import { FriendsView } from "./components/FriendsView";
import { VoiceRoomView } from "./components/VoiceRoomView";
import { SafeModeBanner } from "./components/SafeModeBanner";
import { CrashRecoveryDialog } from "./components/CrashRecoveryDialog";
import { NotificationPermissionPrompt } from "./components/NotificationPermissionPrompt";
import { NotificationCenterPopover } from "./components/NotificationCenterPopover";
import { notificationCenterService, type NotificationCenterItem } from "./services/notificationCenterService";
import { clipboardService } from "./services/clipboardService";
import { deepLinkService, type DeepLinkAction } from "./services/deepLinkService";
import { diagnosticsService } from "./services/diagnosticsService";
import { feedbackService } from "./services/feedbackService";
import { loggingService } from "./services/loggingService";
import { menuService, type MenuActionPayload } from "./services/menuService";
import { dataSourceService } from "./services/dataSourceService";
import { settingsService } from "./services/settingsService";
import { trayService, type TrayStatus } from "./services/trayService";
import { maintenanceStatusService } from "./services/maintenanceStatusService";
import { crashRecoveryService, type CrashRecoveryRecord } from "./services/crashRecoveryService";
import { safeModeService, type SafeModeState } from "./services/safeModeService";
import { statusPageService } from "./services/statusPageService";
import { authService } from "./services/authService";
import { socialAuthService } from "./services/auth/socialAuthService";
import { onboardingService } from "./services/onboarding/onboardingService";
import { communityService } from "./services/communityService";
import { communityMembershipService } from "./services/community/communityMembershipService";
import { channelService } from "./services/channelService";
import { channelCategoryService } from "./services/channelCategoryService";
import { privateChannelPermissionService } from "./services/privateChannelPermissionService";
import { membersService } from "./services/membersService";
import { messageService, type MessageSummary } from "./services/messageService";
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
import { createCommunityFromSummary } from "./utils/communityFactory";
import { messageMentionsUser } from "./utils/mentionUtils";
import { canSendMessage, canViewChannel, filterCommunityForAccess, getCommunityAccess, getVisibleChannelsForCurrentUser } from "./services/permissions/communityPermissions";

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
  run: () => void;
};

type ActiveView = "community" | "mentionFeed" | "profile" | "directMessages" | "friends" | "savedMessages" | "discovery";

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

type CommandPaletteProps = {
  communities: Community[];
  query: string;
  setQuery: (value: string) => void;
  results: PaletteResult[];
  selectedIndex: number;
  setSelectedIndex: (value: number) => void;
  onClose: () => void;
};

function CommandPalette({
  communities,
  query,
  setQuery,
  results,
  selectedIndex,
  setSelectedIndex,
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(Math.max(0, selectedIndex - 1));
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
      <section className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input">
          <AppIcon name={overlayIcons.search} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search communities, channels, members, messages..."
          />
        </div>

        <div className="command-results">
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
                      className={index === selectedIndex ? "active" : ""}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={result.run}
                    >
                      <strong>{result.label}</strong>
                      <span>{result.detail}</span>
                    </button>
                  );
                })}
            </div>
          ))}

          {!results.length ? <div className="empty-state compact">No results for {query || "this search"}</div> : null}
        </div>

        <footer>{communities.length} communities indexed locally</footer>
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
  const [theme, setTheme] = useState<"light" | "dark">(saved.theme);
  const [accessibilitySettings, setAccessibilitySettings] = useState(saved.accessibilitySettings);
  const [maintenanceStatus, setMaintenanceStatus] = useState(() => maintenanceStatusService.getSnapshot());
  const [profileSettings, setProfileSettings] = useState(saved.profileSettings);
  const [trayPresenceStatus, setTrayPresenceStatus] = useState<TrayStatus>("online");
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [activeView, setActiveView] = useState<ActiveView>("community");
  const [mentionItems, setMentionItems] = useState<MentionItem[]>(mockMentionItems);
  const [storyItems, setStoryItems] = useState<FollowedUserStory[]>(mockFollowedUserStories);
  const [mentionTab, setMentionTab] = useState<MentionFeedTab>("feed");
  const [mentionQuickFilter, setMentionQuickFilter] = useState<MentionQuickFilter | null>(null);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(currentUserFollowedUserIds);
  const [activeProfileUserId, setActiveProfileUserId] = useState<string | null>(null);
  const [profileVerificationBadges, setProfileVerificationBadges] = useState<VerificationBadge[]>([]);
  const [previousViewBeforeProfile, setPreviousViewBeforeProfile] = useState<ActiveView | null>(null);
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>(mockDirectConversations);
  const [activeDirectConversationId, setActiveDirectConversationId] = useState(mockDirectConversations[0]?.id ?? "");
  const [friendState, setFriendState] = useState<FriendState>(mockFriendState);
  const [savedMessages, setSavedMessages] = useState<SavedMessageRecord[]>(() => savedMessageService.listSavedMessages());
  useEffect(() => { let active = true; const refresh = () => { void savedMessageService.getSavedMessages().then((items) => { if (active) setSavedMessages(items); }); }; refresh(); const unsubscribe = savedMessageService.subscribe(refresh); return () => { active = false; unsubscribe(); }; }, []);
  const [communityEvents, setCommunityEvents] = useState(mockUpcomingEvents);
  const [feedVoiceState, setFeedVoiceState] = useState<MockVoiceState>({
    isInVoiceRoom: true,
    roomName: "Focus Room",
    communityName: "Aurora Studio",
    participantCount: 8,
    isMuted: false,
    isDeafened: false,
    isScreenSharing: false,
  });
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceServiceSnapshot>(initialVoiceSnapshot);
  const [userSafetySettings, setUserSafetySettings] = useState(() => userSafetyCenterService.getSettings());
  const [blockedUserVersion, setBlockedUserVersion] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationCenterItems, setNotificationCenterItems] = useState(() => notificationCenterService.list());
  const [notificationPermissionPrompt, setNotificationPermissionPrompt] = useState<NotificationPermissionPromptData | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportModalTarget | null>(null);
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
    markChannelUnread,
    clearChannelUnread,
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
  useEffect(() => { if (!authSession || !dataSourceService.getStatus().isSupabase) return; let active = true; void directMessageService.loadDirectConversations().then((result) => { if (!active) return; if (result.ok) { setDirectConversations(result.data); setActiveDirectConversationId((current) => result.data.some((item) => item.id === current) ? current : result.data[0]?.id ?? ""); } else pushToast(result.error.message, "error"); }); return () => { active = false; }; }, [authSession?.user?.id, pushToast]);
  const refreshFriendState = useCallback(async () => {
    const result = await relationshipService.getFriendState();
    if (result.ok) setFriendState(result.data);
    else pushToast(result.error, "error");
  }, [pushToast]);
  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void refreshFriendState();
    void userSafetyCenterService.refreshRemotePrivacy();
    void relationshipService.subscribeToFriendNotifications((notification) => {
      if (!active) return;
      const accepted = notification.eventType === "request_accepted";
      notificationCenterService.add({ id: `friend-${notification.id}`, category: "system", title: accepted ? "Friend request accepted" : "New friend request", preview: accepted ? "A Picom user accepted your friend request." : "A Picom user sent you a friend request.", createdAt: notification.createdAt, context: { kind: "system", userId: notification.actorUserId, label: "Friends" } });
      void notificationService.showNotification({ title: accepted ? "Friend request accepted" : "New friend request", body: accepted ? "Your Picom connection is ready." : "Open Friends to review it.", category: "system", tag: `friend-${notification.id}` });
      void refreshFriendState();
    }).then((cleanup) => { if (!active) cleanup(); else unsubscribe = cleanup; });
    return () => { active = false; unsubscribe?.(); };
  }, [authSession?.user?.id, refreshFriendState]);
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
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [blockedUserIds, communities, mentionItems]);
  const visibleStoryItems = useMemo(() => storyItems.filter((item) => {
    if (blockedUserIds.includes(item.authorId)) return false;
    if (!item.communityId) return true;
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    if (!item.channelId) return access.isMember || access.canViewPublicContent;
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [blockedUserIds, communities, storyItems]);
  const visibleCommunityEvents = useMemo(() => communityEvents.filter((item) => {
    const community = communities.find((candidate) => candidate.id === item.communityId);
    if (!community) return false;
    const access = getCommunityAccess(currentUserId, community);
    if (!item.channelId) return access.isMember || access.canViewPublicContent;
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === item.channelId);
    return Boolean(channel && canViewChannel(access, channel));
  }), [communities, communityEvents]);
  const visibleChannels = useMemo(() => getVisibleChannelsForCurrentUser(activeCommunity, communityAccess), [activeCommunity, communityAccess]);
  const displayedActiveChannel = useMemo(() => visibleChannels.find((channel) => channel.id === activeChannel.id) ?? visibleChannels[0] ?? activeChannel, [activeChannel, visibleChannels]);
  useEffect(() => {
    diagnosticsService.setAppContext({ activeView, activeCommunityId: activeCommunity.id, activeChannelId: displayedActiveChannel.id, authState: authSession?.user ? "authenticated" : "signed_out" });
  }, [activeChannel.id, activeCommunity.id, activeView, authSession, displayedActiveChannel.id]);
  const supabaseCommunitiesLoadedRef = useRef(false);
  const supabaseSidebarLoadedRef = useRef(new Set<string>());
  const supabaseMessagesLoadedRef = useRef(new Set<string>());
  const supabaseMembersLoadedRef = useRef(new Set<string>());

  useEffect(() => {
    return userSafetyCenterService.subscribe(setUserSafetySettings);
  }, []);

  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase) return;
    let active = true;
    void userBlockingService.refreshRemoteBlocks().then(() => { if (active) setBlockedUserVersion((version) => version + 1); });
    return () => { active = false; };
  }, [authSession?.user?.id]);

  useEffect(() => {
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
    reactions: [],
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

    if (message.channelId !== activeChannel.id && message.authorId !== currentUser.userId) {
      markChannelUnread({
        communityId: message.communityId,
        channelId: message.channelId,
        mentionCount: getLocalMentionCount(message.body, currentUser),
      });
    }
  }, [activeChannel.id, activeCommunity.id, currentUser, markChannelUnread, upsertLocalMessage]);

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
    removeLocalMessage({
      communityId: activeCommunity.id,
      channelId: activeChannel.id,
      id: messageId,
    });
  }, [activeChannel.id, activeCommunity.id, removeLocalMessage]);

  const realtimeStatus = useSupabaseMessageRealtime({
    enabled: Boolean(authSession) && !safeMode.active,
    communityId: activeCommunity.id,
    channelId: activeChannel.id,
    onInsert: handleRealtimeMessageInsert,
    onUpdate: handleRealtimeMessageUpdate,
    onDelete: handleRealtimeMessageDelete,
  });
  const typingBroadcast = useSupabaseTypingBroadcast({
    enabled: Boolean(authSession) && !safeMode.active,
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
          displayName: profileSettings.displayName || member.displayName,
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
    return communities.flatMap((community) => community.members).find((member) => member.userId === activeProfileUserId) ?? null;
  }, [activeProfileUserId, communities]);

  const selectedUserProfile = useMemo(() => {
    if (!selectedProfileMember) return null;
    const profile = getMockProfileForMember(selectedProfileMember, communities, { currentUserId, followedUserIds });
    const friend = friendState.friends.some((candidate) => candidate.userId === profile.id);
    const request = friendState.requests.find((candidate) => candidate.userId === profile.id);
    return { ...profile, verificationBadges: profileVerificationBadges, friendshipStatus: friend ? "friends" as const : request?.direction === "incoming" ? "incoming" as const : request?.direction === "outgoing" ? "outgoing" as const : "none" as const };
  }, [communities, followedUserIds, friendState.friends, friendState.requests, profileVerificationBadges, selectedProfileMember]);

  useEffect(()=>{if(!activeProfileUserId){setProfileVerificationBadges([]);return;}let active=true;void profileVerificationService.listForSubject("user",activeProfileUserId).then((result)=>{if(active)setProfileVerificationBadges(result.ok?result.data:[])});return()=>{active=false};},[activeProfileUserId]);

  useEffect(() => notificationCenterService.subscribe(setNotificationCenterItems), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.highContrast = accessibilitySettings.highContrast ? "true" : "false";
    document.documentElement.dataset.reducedMotion = accessibilitySettings.reducedMotion ? "true" : "false";
    document.documentElement.dataset.largerText = accessibilitySettings.largerText ? "true" : "false";
    document.documentElement.dataset.focusRingStrong = accessibilitySettings.focusRingStrong ? "true" : "false";
    settingsService.updateSettings({ theme, accessibilitySettings });
  }, [accessibilitySettings, theme]);

  useEffect(() => {
    clearChannelUnread({ communityId: activeCommunity.id, channelId: activeChannel.id });
  }, [activeChannel.id, activeCommunity.id, clearChannelUnread]);

  useEffect(() => {
    if (!visibleChannels.length) return;
    if (visibleChannels.some((channel) => channel.id === activeChannel.id)) return;
    setActiveChannelId(visibleChannels[0].id);
  }, [activeChannel.id, setActiveChannelId, visibleChannels]);

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
      setTheme(defaults.theme);
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
      setTheme(defaults.theme);
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
    if (safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase || supabaseSidebarLoadedRef.current.has(activeCommunity.id)) return;

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
  }, [activeCommunity.id, authSession, pushToast, replaceCommunityCategories, safeMode.active]);

  useEffect(() => {
    if (safeMode.active || !authSession || !dataSourceService.getStatus().isSupabase) return;

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
  }, [activeChannel.id, activeCommunity.id, authSession, mapMessageSummaryToMessage, pushToast, replaceChannelMessages, safeMode.active]);

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        openSettings();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        lockApp();
        return;
      }

      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        selectChannelByOffset(-1);
        return;
      }

      if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        selectChannelByOffset(1);
        return;
      }

      if (event.key === "Escape") {
        closeTransientOverlays();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeChannel.id, channels, closeTransientOverlays, lockApp, openPalette, openSettings, selectChannelByOffset]);

  const maybeShowNotificationPermissionPrompt = useCallback((trigger: NotificationPermissionOnboardingTrigger) => {
    const prompt = notificationPermissionOnboardingService.getPrompt(trigger);
    if (!prompt) return;

    notificationPermissionOnboardingService.markPrompted(trigger);
    setNotificationPermissionPrompt(prompt);
  }, []);

  useEffect(() => {
    analyticsService.trackEvent("app_started", { runtime: "electron", releaseChannel: "beta" });
  }, []);

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

  useEffect(() => {
    const handleDeepLinkAction = (action: DeepLinkAction) => {
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

      const targetCommunity = communities.find((community) => community.id === action.communityId);
      if (!targetCommunity) {
        pushToast("Deep link community is unavailable in this local workspace.", "error");
        return;
      }

      setActiveView("community");
      switchCommunity(action.communityId, action.channelId);
      if (action.channelId) {
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
  }, [clearChannelUnread, closeTransientOverlays, communities, openSettings, pushToast, switchCommunity]);

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
    window.setTimeout(() => setHighlightedMessageId((current) => (current === message.id ? null : current)), 2200);
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
          setTheme(theme === "light" ? "dark" : "light");
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

    const searchResults = advancedSearchService.searchLocal(paletteQuery, communities, mentionItems, currentUserId, savedMessages);
    for (const result of searchResults) {
      all.push({
        id: result.id, group: result.category, label: result.label, detail: result.detail,
        run: () => {
          if (result.category === "People" && result.userId) { setPreviousViewBeforeProfile(activeView); setActiveProfileUserId(result.userId); setActiveView("profile"); }
          else if (result.category === "Communities" && result.communityId) { setActiveView("community"); switchCommunity(result.communityId); }
          else if (result.communityId && result.channelId && (result.category === "Messages" || result.category === "Mentions" || result.category === "Saved" || result.category === "Media")) {
            const target = advancedSearchService.resolveMessageJumpTarget(result, communities, currentUserId);
            if (target.ok) jumpToMessage(target.community, target.message); else pushToast(target.reason, "error");
          } else if (result.communityId && result.channelId) { setActiveView("community"); switchCommunity(result.communityId, result.channelId); setActiveChannelId(result.channelId); clearChannelUnread({ communityId: result.communityId, channelId: result.channelId }); }
          closePalette();
        },
      });
    }

    return all
      .filter((result) => !q || `${result.group} ${result.label} ${result.detail}`.toLowerCase().includes(q))
      .slice(0, 36);
  }, [activeView, clearChannelUnread, closePalette, closeTransientOverlays, communities, directConversations, jumpToMessage, lockApp, mentionItems, openSettings, paletteQuery, pushToast, savedMessages, setActiveChannelId, switchCommunity, theme]);

  const openMentionFeed = useCallback(() => {
    setActiveView("mentionFeed");
    closeTransientOverlays();
  }, [closeTransientOverlays]);

  const openCommunityFromRail = useCallback((communityId: string) => {
    setActiveView("community");
    switchCommunity(communityId);
    closeTransientOverlays();
  }, [closeTransientOverlays, switchCommunity]);

  const toggleFollowUser = useCallback((userId: string) => {
    if (userId === currentUserId) return;

    setFollowedUserIds((current) => {
      const following = current.includes(userId);
      void (following ? relationshipService.unfollowUser(userId) : relationshipService.followUser(userId));
      return following ? current.filter((id) => id !== userId) : [...current, userId];
    });
  }, []);

  const toggleMentionReaction = useCallback((id: string) => {
    setMentionItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const [primaryReaction, ...rest] = item.reactions ?? [{ emoji: "👍", count: 0 }];
        const reactedByCurrentUser = Boolean(primaryReaction.reactedByCurrentUser);
        const nextPrimaryReaction = {
          ...primaryReaction,
          count: Math.max(0, primaryReaction.count + (reactedByCurrentUser ? -1 : 1)),
          reactedByCurrentUser: !reactedByCurrentUser,
        };

        return { ...item, reactions: [nextPrimaryReaction, ...rest] };
      }),
    );
  }, []);

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
    setMentionItems((current) => current.map((item) => (item.id === id ? { ...item, isUnread: false } : item)));
  }, []);

  const toggleMentionFilter = useCallback((filter: MentionQuickFilter) => {
    setMentionQuickFilter((current) => (current === filter ? null : filter));
  }, []);

  const openMentionInChannel = useCallback((item: MentionItem) => {
    setActiveView("community");
    switchCommunity(item.communityId, item.channelId);
    clearChannelUnread({ communityId: item.communityId, channelId: item.channelId });
    setMentionItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, isUnread: false } : candidate)));
    closeTransientOverlays();
    loggingService.logInfo("Mention feed message highlight placeholder prepared", { messageId: item.messageId }, "mention-feed");
  }, [clearChannelUnread, closeTransientOverlays, switchCommunity]);

  const markStorySeen = useCallback((storyId: string) => {
    setStoryItems((current) => current.map((story) => (story.id === storyId ? { ...story, status: "seen" } : story)));
  }, []);

  const openStoryInChannel = useCallback((story: FollowedUserStory) => {
    if (!story.communityId || !story.channelId) {
      pushToast("This story is not linked to an open channel yet.", "info");
      return;
    }

    setActiveView("community");
    switchCommunity(story.communityId, story.channelId);
    clearChannelUnread({ communityId: story.communityId, channelId: story.channelId });
    markStorySeen(story.id);
    closeTransientOverlays();
    loggingService.logInfo("Story message highlight placeholder prepared", { messageId: story.messageId }, "mention-feed");
  }, [clearChannelUnread, closeTransientOverlays, markStorySeen, pushToast, switchCommunity]);

  const toggleFeedVoiceMute = useCallback(() => {
    setFeedVoiceState((current) => ({ ...current, isMuted: !current.isMuted }));
  }, []);

  const toggleFeedVoiceDeafen = useCallback(() => {
    setFeedVoiceState((current) => ({ ...current, isDeafened: !current.isDeafened }));
  }, []);

  const leaveFeedVoice = useCallback(() => {
    setFeedVoiceState((current) => ({ ...current, isInVoiceRoom: false }));
    pushToast("Left the mock voice room.", "info");
  }, [pushToast]);

  const showScreenSharePlaceholder = useCallback(() => {
    pushToast("Screen share controls are prepared for LiveKit, but stay local in this task.", "info");
  }, [pushToast]);

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

  const startActiveVoiceScreenShare = useCallback((sourceId: string, preset: "presentation" | "balanced" | "performance") => {
    void import("./services/voiceService").then(({ voiceService }) =>
      voiceService.startScreenShare(sourceId, preset).then((result) => {
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

    setActiveView("community");
    switchCommunity(communityId);
    closeTransientOverlays();
  }, [closeTransientOverlays, communities, pushToast, switchCommunity]);

  const showFeedEventDetails = useCallback((event: typeof mockUpcomingEvents[number]) => {
    pushToast(`${event.title} details are a local placeholder.`, "info");
  }, [pushToast]);

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

  const sendDirectMessageLocal = useCallback(async (conversationId: string, body: string): Promise<boolean> => {
    const conversation = directConversations.find((candidate) => candidate.id === conversationId);
    if (conversation && !userBlockingService.canMessageUser(conversation.participantUserId)) { pushToast("Direct messages with this blocked user are disabled.", "error"); return false; }
    const createdAt = new Date().toISOString();
    const clientMessageId = `dm-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDirectConversations((current) => current.map((conversation) => conversation.id === conversationId ? {
      ...conversation, lastMessagePreview: body, updatedAt: createdAt, unreadCount: 0,
      messages: [...conversation.messages, { id: clientMessageId, clientMessageId, conversationId, authorId: directMessageUserId, body, createdAt }],
    } : conversation));
    if (dataSourceService.getStatus().isMock) return true;
    const result = await directMessageService.sendDirectMessage({ conversationId, body, clientMessageId });
    if (result.ok) { setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, messages: item.messages.map((message) => message.clientMessageId === clientMessageId ? result.data : message), lastMessagePreview: result.data.body, updatedAt: result.data.createdAt } : item)); return true; }
    setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, messages: item.messages.filter((message) => message.clientMessageId !== clientMessageId) } : item));
    pushToast(result.error.message, "error");
    return false;
  }, [directConversations, directMessageUserId, pushToast]);

  const handleDirectRealtimeInsert = useCallback((message: DirectConversation["messages"][number]) => {
    setDirectConversations((current) => current.map((conversation) => {
      if (conversation.id !== message.conversationId) return conversation;
      const index = conversation.messages.findIndex((candidate) => candidate.id === message.id || Boolean(message.clientMessageId && candidate.clientMessageId === message.clientMessageId));
      const messages = [...conversation.messages];
      if (index >= 0) messages[index] = message; else messages.push(message);
      const active = activeView === "directMessages" && activeDirectConversationId === conversation.id;
      return { ...conversation, messages, lastMessagePreview: message.deletedAt ? "Message deleted" : message.body, updatedAt: message.createdAt, unreadCount: message.authorId === currentUserId || active ? 0 : conversation.unreadCount + (index >= 0 ? 0 : 1) };
    }));
  }, [activeDirectConversationId, activeView]);

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
      const delta = type === "add" ? 1 : -1;
      if (index >= 0) { const next = reactions[index].count + delta; if (next > 0) reactions[index] = { ...reactions[index], count: next, reactedByCurrentUser: reaction.user_id === currentUserId ? type === "add" : reactions[index].reactedByCurrentUser }; else reactions.splice(index, 1); }
      else if (type === "add") reactions.push({ emoji: reaction.emoji, count: 1, reactedByCurrentUser: reaction.user_id === currentUserId });
      return { ...message, reactions };
    }) })));
  }, []);

  useDirectMessageRealtime({
    enabled: true,
    conversationIds: directConversations.map((conversation) => conversation.id),
    activeConversationId: activeDirectConversationId,
    currentUserId: directMessageUserId,
    isDirectMessagesViewActive: activeView === "directMessages",
    onInsert: handleDirectRealtimeInsert,
    onUpdate: handleDirectRealtimeUpdate,
    onDelete: handleDirectRealtimeDelete,
    onReaction: handleDirectRealtimeReaction,
  });

  const openNotificationSource = useCallback((item: NotificationCenterItem) => {
    notificationCenterService.markRead(item.id);
    setNotificationCenterOpen(false);
    if (item.context.kind === "dm" && item.context.userId) { openDirectMessages(item.context.userId); return; }
    if (item.context.kind === "community" && item.context.communityId) {
      setActiveView("community"); switchCommunity(item.context.communityId);
      if (item.context.channelId) setActiveChannelId(item.context.channelId);
      if (item.context.messageId) setHighlightedMessageId(item.context.messageId);
      return;
    }
    pushToast(item.title, "info");
  }, [openDirectMessages, pushToast, switchCommunity]);

  const createCommunityEvent = useCallback(async (input: CreateCommunityEventInput) => { const event=await communityEventService.createEvent(input);if(event){setCommunityEvents((current)=>[event,...current]);pushToast("Event created.","success");}else pushToast("Event could not be created.","error"); },[pushToast]);
  const updateCommunityEvent = useCallback(async (eventId: string, input: UpdateCommunityEventInput) => { const event = await communityEventService.updateEvent(eventId, input); if (event) { setCommunityEvents((current) => current.map((item) => item.id === eventId ? event : item)); pushToast("Event updated.", "success"); } else pushToast("Event could not be updated.", "error"); }, [pushToast]);
  const cancelCommunityEvent = useCallback(async (eventId:string) => { if(await communityEventService.cancelEvent(eventId)){setCommunityEvents((current)=>current.map((event)=>event.id===eventId?{...event,cancelledAt:new Date().toISOString()}:event));pushToast("Event cancelled.","success");} },[pushToast]);

  const openFriends = useCallback(() => {
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

  const requestFriendFromProfile = useCallback(async (userId: string) => { const result=await relationshipService.sendFriendRequest(userId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request sent.","success"); }, [pushToast, refreshFriendState]);

  const sendFriendRequest = useCallback(async (userId: string) => { const result=await relationshipService.sendFriendRequest(userId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend request sent.","success"); }, [pushToast, refreshFriendState]);
  const removeFriend = useCallback(async (userId: string) => { const result=await relationshipService.removeFriend(userId); if(!result.ok){pushToast(result.error,"error");return;} await refreshFriendState(); pushToast("Friend removed.","info"); }, [pushToast, refreshFriendState]);
  const blockFriend = useCallback(async (userId: string) => { const friend=friendState.friends.find((item)=>item.userId===userId); if(!friend)return; const result=await relationshipService.blockFriend(friend); if(!result.ok){pushToast(result.error,"error");return;} setBlockedUserVersion((value)=>value+1); await refreshFriendState(); pushToast("User blocked and removed from friends.","success"); }, [friendState.friends, pushToast, refreshFriendState]);

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
    loggingService.logInfo("Profile activity highlight placeholder prepared", { messageId: activity.messageId }, "profile");
  }, [clearChannelUnread, closeTransientOverlays, pushToast, switchCommunity]);

  const finishFirstRunOnboarding = useCallback((completion: OnboardingCompletion) => {
    const nextProfileSettings = {
      ...profileSettings,
      displayName: completion.profile.displayName,
      statusText: completion.profile.statusText,
    };
    setProfileSettings(nextProfileSettings);
    setFollowedUserIds(completion.followedUserIds);
    setTheme(completion.theme);
    settingsService.updateSettings({ theme: completion.theme, profileSettings: nextProfileSettings });
    setOnboardingPhase("complete");
    if (completion.startChoice === "joinInvite" && completion.inviteCode) setPendingInviteCode(completion.inviteCode);

    setActiveView("mentionFeed");
    pushToast("Picom setup completed.", "success");
  }, [profileSettings, pushToast]);

  if (!authReady || !authSession) {
    return (
      <>
        <DesktopAppShell>
          <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} />
          {maintenanceStatus.status === "maintenance" ? (
            <MaintenanceStatusView status={maintenanceStatus} onRetry={refreshMaintenanceStatus} onOpenStatusPage={openSystemStatusPage} />
          ) : authView === "login" ? (
            <LoginScreen
              theme={theme}
              loading={!authReady || authLoading}
              error={authError}
              onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
              onSubmit={handleLogin}
              onPasswordResetRequest={handlePasswordResetRequest}
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
              onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
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
    return <DesktopAppShell><WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} /><main className="first-run-onboarding onboarding-loading"><span className="onboarding-welcome-orb"><AppIcon name="lock" size="xl" /></span><strong>Checking policy version...</strong></main></DesktopAppShell>;
  }

  if (legalAcceptancePhase === "required" && authSession.user) {
    return <DesktopAppShell><WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} /><TermsReacceptPrompt loading={legalAcceptanceLoading} error={legalAcceptanceError} onAccept={() => void acceptUpdatedLegalTerms()} onSignOut={() => void handleLogout()} /></DesktopAppShell>;
  }

  if (onboardingPhase === "checking" && authSession.user) {
    return (
      <DesktopAppShell>
        <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} />
        <main className="first-run-onboarding onboarding-loading"><span className="onboarding-welcome-orb"><AppIcon name="home" size="xl" /></span><strong>Preparing your Picom workspace…</strong></main>
      </DesktopAppShell>
    );
  }

  if (onboardingPhase === "required" && authSession.user) {
    return (
      <>
        <DesktopAppShell>
          <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} />
          <OnboardingFlow
            userId={authSession.user.id}
            initialDisplayName={authSession.user.displayName || profileSettings.displayName || currentUser.displayName}
            initialUsername={currentUser.username}
            initialStatusText={profileSettings.statusText || currentUser.statusText}
            initialFollowedUserIds={followedUserIds}
            suggestions={followSuggestionsV2.length ? followSuggestionsV2.map((suggestion) => suggestion.member) : mockFollowSuggestions.filter((member) => !blockedUserIds.includes(member.userId) && !followedUserIds.includes(member.userId))}
            theme={theme}
            onThemeChange={setTheme}
            onComplete={finishFirstRunOnboarding}
          />
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
      localOrder,
    });

    if (!result.ok) {
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
      replyToMessageId,
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
    const result = await messageSendQueueService.enqueue({ communityId: activeCommunity.id, channelId: message.channelId, authorId: message.authorId, body: message.body, clientMessageId: message.clientMessageId, localOrder: message.localOrder ?? messageSendQueueService.nextLocalOrder(activeCommunity.id, message.channelId) });
    if (!result.ok) {
      setLocalMessageDeliveryStatus({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id, clientMessageId: message.clientMessageId, localStatus: "failed" });
      const conflict = offlineSyncConflictService.classify({ actionType: "sendMessage", errorCode: result.error.code, errorMessage: result.error.message });
      pushToast(conflict.userMessage, "error");
      return;
    }
    appendLocalMessage({ id: result.data.id, clientMessageId: message.clientMessageId, communityId: activeCommunity.id, channelId: message.channelId, authorId: result.data.authorId, body: result.data.body, localOrder: message.localOrder, createdAt: result.data.createdAt, replyToMessageId: message.replyToMessageId, attachments: message.attachments, localStatus: "sent" });
    pushToast("Message sent after retry.", "success");
  };

  const removeFailedMessage = (message: Message) => {
    if (message.localStatus !== "failed" && message.localStatus !== "queued_offline") return;
    removeLocalMessage({ communityId: activeCommunity.id, channelId: message.channelId, id: message.id });
    pushToast("Local failed message removed.", "info");
  };

  const canCurrentUserModerate = () => {
    const role = activeCommunity.roles.find((candidate) => candidate.id === currentUser.roleId);
    return (role?.level ?? 0) >= 60;
  };

  const handleSaveMessageEdit = (message: Message, body: string) => {
    if (message.authorId !== currentUser.userId || message.deletedAt) {
      pushToast("You can only edit your own active messages.", "error");
      return;
    }

    editLocalMessage({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
      body,
    });
    setEditingMessageId(null);
  };

  const handleDeleteMessage = (message: Message) => {
    const ownMessage = message.authorId === currentUser.userId;

    if (!ownMessage && !canCurrentUserModerate()) {
      pushToast("You do not have permission to delete this message.", "error");
      return;
    }

    const needsConfirmation = message.body.length > 80 || Boolean(message.attachments?.length);
    if (needsConfirmation && !window.confirm("Delete this message? It will be replaced with a deleted message placeholder.")) {
      return;
    }

    deleteLocalMessage({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
    });

    if (replyToMessageId === message.id) {
      setReplyToMessageId(null);
    }
  };

  const handleToggleMessageReaction = (message: Message, emoji: string) => {
    if (!canSendMessage(communityAccess, displayedActiveChannel)) {
      pushToast(communityAccess.isVisitor ? "Join this community to react to messages." : "You do not have permission to react here.", "error");
      return;
    }

    toggleLocalReaction({
      communityId: activeCommunity.id,
      channelId: message.channelId,
      id: message.id,
      emoji,
    });
  };

  const handleReportMessage = (message: Message) => {
    setReportTarget({ communityId: activeCommunity.id, channelId: message.channelId, targetType: "message", targetId: message.id, label: message.body.slice(0, 80) || "Attachment message" });
  };

  const handleOpenThread = async (message: Message) => {
    const result = await threadService.openOrCreate({ communityId: activeCommunity.id, channelId: message.channelId, parentMessageId: message.id, name: message.body.slice(0, 70) || "Attachment thread", createdBy: currentUser.userId, canCreate: canSendMessage(communityAccess, displayedActiveChannel) });
    if (result.ok) setActiveThread({ thread: result.data, parentMessage: message }); else pushToast(result.message, "error");
  };

  const handleReportUser = (member: Member) => {
    setReportTarget({ communityId: activeCommunity.id, targetType: "user", targetId: member.userId, label: `${member.displayName} (@${member.username})` });
  };

  const handleToggleBlockUser = async (member: Member) => {
    if (member.userId === currentUser.userId) {
      pushToast("You cannot block your own account.", "error");
      return;
    }

    const blocked = !userBlockingService.isBlocked(member.userId);
    const persisted = await userBlockingService.setBlockedUser(member, blocked);
    if (!persisted) { pushToast(`Could not ${blocked ? "block" : "unblock"} ${member.displayName}.`, "error"); return; }
    setBlockedUserVersion((version) => version + 1);
    if (blocked) { setDirectConversations((current) => current.filter((conversation) => conversation.participantUserId !== member.userId)); void refreshFriendState(); }
    pushToast(blocked ? `${member.displayName} blocked.` : `${member.displayName} unblocked.`, blocked ? "info" : "success");
  };

  const handleJoinCommunity = async () => {
    const result = await communityMembershipService.joinCommunity({
      community: activeCommunity,
      currentUser,
      isAuthenticated: Boolean(authSession),
    });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    replaceCommunityMembers(activeCommunity.id, [
      ...activeCommunity.members.filter((member) => member.userId !== result.data.userId),
      result.data,
    ]);
    pushToast(`Joined ${activeCommunity.name}.`, "success");
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

  const handleInviteAccepted = (communityId: string, member: Member) => {
    const target = communities.find((community) => community.id === communityId);
    if (!target) {
      pushToast("Joined successfully. Refresh communities to load the invited workspace.", "success");
      setPendingInviteCode(null);
      return;
    }

    replaceCommunityMembers(communityId, [...target.members.filter((candidate) => candidate.userId !== member.userId), member]);
    switchCommunity(communityId);
    setActiveView("community");
    setPendingInviteCode(null);
    pushToast(`Joined ${target.name} with invite.`, "success");
  };

  const handleCreateCommunity = async (name: string, description?: string, templateId?: CommunityTemplateId) => {
    const result = await communityService.createCommunity({ name, description, templateId });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    const community = addCommunity(createCommunityFromSummary(result.data));
    analyticsService.trackEvent("community_created", { mode: dataSourceService.getStatus().mode });
    switchCommunity(community.id);
    setCreateCommunityOpen(false);
    maybeShowNotificationPermissionPrompt("community_created");
    pushToast(`${community.name} created.`, "success");
  };

  const handleCreateChannel = async (value: CreateChannelFormValue) => {
    const result = await channelService.createChannel({
      communityId: activeCommunity.id,
      categoryId: value.categoryId,
      name: value.name,
      type: value.type,
      isPrivate: value.isPrivate,
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
        <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={openPalette} onOpenNotifications={() => setNotificationCenterOpen((open) => !open)} notificationUnreadCount={notificationCenterItems.filter((item) => !item.readAt).length} />
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
            onContextMenu={(event, label) => openContext(event, [{ label }, { label: "Context placeholder" }])}
          />
          {activeView === "discovery" ? (
            <DiscoveryView
              communities={communities}
              currentUserId={currentUserId}
              onView={openCommunityFromRail}
              onJoin={async (communityId) => {
                const community = communities.find((item) => item.id === communityId);
                if (!community) return;

                const result = await communityMembershipService.joinCommunity({
                  community,
                  currentUser,
                  isAuthenticated: Boolean(authSession),
                });

                if (result.ok) {
                  replaceCommunityMembers(community.id, [...community.members, result.data]);
                  openCommunityFromRail(community.id);
                  pushToast(`Joined ${community.name}.`, "success");
                } else {
                  pushToast(result.error.message, "error");
                }
              }}
              onReport={(community) => setReportTarget({ targetType: "community", targetId: community.id, communityId: community.id, label: community.name })}
            />
          ) : activeView === "mentionFeed" ? (
            <div className="mention-feed-shell">
              <MentionFeedMain
                items={visibleMentionItems}
                communities={communities}
                friends={friendState.friends}
                events={visibleCommunityEvents}
                stories={visibleStoryItems}
                voiceState={feedVoiceState}
                followedUserIds={followedUserIds}
                activeTab={mentionTab}
                activeFilter={mentionQuickFilter}
                onTabChange={setMentionTab}
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
                onScreenSharePlaceholder={showScreenSharePlaceholder}
                onOpenEventCommunity={openFeedEventCommunity}
                onEventDetails={showFeedEventDetails}
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
          ) : activeView === "profile" && selectedProfileMember && selectedUserProfile ? (
            <ProfileView
              member={selectedProfileMember}
              profile={selectedUserProfile}
              communities={communities}
              currentUserId={currentUserId}
              onBack={closeProfileView}
              onToggleFollow={toggleFollowUser}
              onMessage={openDirectMessages}
              onFriendAction={requestFriendFromProfile}
              onOpenActivity={openProfileActivity}
              onOpenImage={openPreview}
              onPlaceholderAction={(message) => pushToast(message, "info")}
              onOpenMore={(event, profile) => openContext(event, [
                { label: profile.isCurrentUser ? "Edit profile placeholder" : "Message placeholder" },
                { label: profile.isFollowing ? "Unfollow locally" : "Follow locally", onSelect: () => toggleFollowUser(profile.id), disabled: profile.isCurrentUser },
                { label: blockedUserIds.includes(profile.id) ? "Unblock user" : "Block user", onSelect: () => { if (selectedProfileMember) handleToggleBlockUser(selectedProfileMember); }, disabled: profile.isCurrentUser },
                { label: "Report user", onSelect: () => { if (selectedProfileMember) handleReportUser(selectedProfileMember); }, disabled: profile.isCurrentUser },
                { label: "Copy user ID", onSelect: () => void clipboardService.copyText(profile.id) },
              ])}
            />
          ) : activeView === "savedMessages" ? (
            <SavedMessagesView items={savedMessages} communities={communities} onBack={() => setActiveView("community")} onOpen={(item) => { const community=communities.find((candidate)=>candidate.id===item.communityId);const message=community?.messages.find((candidate)=>candidate.id===item.messageId);if(community&&message)jumpToMessage(community,message);else pushToast("This saved message is unavailable or inaccessible.","error"); }} onUnsave={(item) => { void savedMessageService.unsaveMessage(item.messageId).then(async (ok) => { if (ok) setSavedMessages(await savedMessageService.getSavedMessages()); else pushToast("Saved Messages could not be updated.", "error"); }); }} />
          ) : activeView === "directMessages" ? (
            <DirectMessagesView
              conversations={directConversations}
              activeConversationId={activeDirectConversationId}
              currentUserId={directMessageUserId}
              onSelectConversation={(conversationId) => { setActiveDirectConversationId(conversationId); setDirectConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item)); if (dataSourceService.getStatus().isSupabase) void directMessageService.markDirectConversationRead(conversationId); }}
              onSendMessage={sendDirectMessageLocal}
              onBackToCommunity={() => setActiveView("community")}
              onOpenProfile={(userId) => {
                const member = communities.flatMap((community) => community.members).find((candidate) => candidate.userId === userId);
                if (member) openProfilePage(member);
              }}
            />
          ) : activeView === "friends" ? (
            <FriendsView
              friends={friendState.friends}
              requests={friendState.requests}
              suggestions={friendState.suggestions}
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
            />
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
                  setActiveChannelId(channel.id);
                  clearChannelUnread({ communityId: activeCommunity.id, channelId: channel.id });
                }}
                onCreateChannel={(categoryId) => setCreateChannelCategoryId(categoryId)}
                onOpenSettings={openSettings}
                onLogout={handleLogout}
                onJoinCommunity={handleJoinCommunity}
                onLeaveCommunity={handleLeaveCommunity}
                pendingInviteCode={pendingInviteCode}
                onClearPendingInviteCode={() => setPendingInviteCode(null)}
                onInviteAccepted={handleInviteAccepted}
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
                    {
                      label: "Edit channel placeholder",
                      onSelect: () => channelService.updateChannel({ channelId: channel.id }).then((result) => {
                        if (!result.ok) pushToast(result.error.message, "info");
                      }),
                    },
                    {
                      label: "Delete channel placeholder",
                      tone: "danger",
                      onSelect: () => channelService.deleteChannel({ channelId: channel.id }).then((result) => {
                        if (!result.ok) pushToast(result.error.message, "info");
                      }),
                    },
                  ])
                }
              />
              {displayedActiveChannel.type === "voice" ? (
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
                currentUserId={currentUser.userId}
                readReceiptsEnabled={userSafetySettings.enableReadReceipts}
                highlightedMessageId={highlightedMessageId}
                replyToMessage={replyToMessage}
                editingMessageId={editingMessageId}
                onCancelReply={() => setReplyToMessageId(null)}
                membersVisible={membersVisible}
                onToggleMembers={toggleMembersVisible}
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
                onOpenJoinCommunity={handleJoinCommunity}
                pushToast={pushToast}
              />
              )}
              {membersVisible ? (
                <MemberSidebar
                  community={displayedActiveCommunity}
                  onOpenProfile={openProfile}
                  onMemberContextMenu={(event, member) =>
                  openContext(event, [
                    { label: `View ${member.displayName}` },
                    { label: "Open direct message", onSelect: () => openDirectMessages(member.userId) },
                    { label: "Open friends foundation", onSelect: openFriends },
                    { label: "Report user", disabled: member.userId === currentUser.userId, onSelect: () => handleReportUser(member) },
                    { label: "Moderation placeholder", disabled: true },
                  ])
                  }
                />
              ) : null}
            </>
          )}
        </div>
        )}
      </DesktopAppShell>

      {createCommunityOpen ? <CreateCommunityModal onClose={() => setCreateCommunityOpen(false)} onSubmit={handleCreateCommunity} /> : null}
      {createChannelCategoryId ? (
        <CreateChannelModal
          community={activeCommunity}
          defaultCategoryId={createChannelCategoryId}
          onClose={() => setCreateChannelCategoryId(null)}
          onSubmit={handleCreateChannel}
        />
      ) : null}
      {settingsOpen ? <SettingsModal theme={theme} accessibilitySettings={accessibilitySettings} profileSettings={profileSettings} onThemeChange={setTheme} onAccessibilitySettingsChange={setAccessibilitySettings} onProfileSettingsChange={setProfileSettings} onClose={closeSettings} pushToast={pushToast} onAccountDeletionRequested={() => { closeSettings(); void handleLogout(); }} currentUsername={currentUser.username} ownedCommunityCount={communities.filter((community) => community.ownerId === currentUser.userId).length} developerPortalContext={{ communityId: displayedActiveCommunity.id, communityName: displayedActiveCommunity.name, ownerId: displayedActiveCommunity.ownerId ?? currentUser.userId, canManageBots: communityAccess.permissions.includes("manageCommunity"), canManageWebhooks: communityAccess.permissions.includes("manageChannels") }} /> : null}
      {reportTarget ? <ReportModal target={reportTarget} reporterId={currentUser.userId} onClose={() => setReportTarget(null)} onResult={(message, ok) => pushToast(message, ok ? "success" : "error")} /> : null}
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
