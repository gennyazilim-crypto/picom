import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { currentUserId, mockCommunities } from "./data/mockCommunities";
import type { Attachment, ChannelCategory, Community, Member, Message } from "./types/community";
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
import { LoginScreen } from "./components/LoginScreen";
import { RegisterScreen } from "./components/RegisterScreen";
import { CreateCommunityModal } from "./components/CreateCommunityModal";
import { CreateChannelModal, type CreateChannelFormValue } from "./components/CreateChannelModal";
import { clipboardService } from "./services/clipboardService";
import { dataSourceService } from "./services/dataSourceService";
import { settingsService } from "./services/settingsService";
import { communityService } from "./services/communityService";
import { channelService } from "./services/channelService";
import { channelCategoryService } from "./services/channelCategoryService";
import { membersService } from "./services/membersService";
import { messageService, type MessageSummary } from "./services/messageService";
import { useMvpAppState } from "./state/useMvpAppState";
import { useLocalMessageState } from "./state/useLocalMessageState";
import { useOverlayState, type OverlayMenuItem as MenuItem } from "./state/useOverlayState";
import { useMemberSidebarState } from "./state/useMemberSidebarState";
import { useProtectedDesktopSession } from "./hooks/useProtectedDesktopSession";
import { useSupabaseMessageRealtime } from "./hooks/useSupabaseMessageRealtime";
import { useSupabasePresenceChannel } from "./hooks/useSupabasePresenceChannel";
import { useSupabaseTypingBroadcast } from "./hooks/useSupabaseTypingBroadcast";
import { createCommunityFromSummary } from "./utils/communityFactory";

const overlayIcons = mvpUiIconMap.overlays;

type PaletteResult = {
  id: string;
  group: string;
  label: string;
  detail: string;
  run: () => void;
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
  const saved = settingsService.getSettings();
  const [theme, setTheme] = useState<"light" | "dark">(saved.theme);
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | null>(null);
  const {
    communities,
    appendLocalMessage,
    upsertLocalMessage,
    updateLocalMessage,
    removeLocalMessage,
    clearChannelUnread,
    addCommunity,
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
  const { membersVisible, toggleMembersVisible } = useMemberSidebarState(true);
  const currentUser = activeCommunity.members.find((member) => member.userId === currentUserId) ?? activeCommunity.members[0];
  const supabaseCommunitiesLoadedRef = useRef(false);
  const supabaseSidebarLoadedRef = useRef(new Set<string>());
  const supabaseMessagesLoadedRef = useRef(new Set<string>());
  const supabaseMembersLoadedRef = useRef(new Set<string>());

  const mapMessageSummaryToMessage = useCallback((message: MessageSummary): Message => ({
    id: message.id,
    clientMessageId: message.clientMessageId,
    channelId: message.channelId,
    authorId: message.authorId,
    body: message.body,
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? undefined,
    attachments: [],
    reactions: [],
    localStatus: "sent",
  }), []);

  const handleRealtimeMessageInsert = useCallback((message: MessageSummary) => {
    if (message.communityId !== activeCommunity.id || message.channelId !== activeChannel.id) return;

    upsertLocalMessage({
      id: message.id,
      clientMessageId: message.clientMessageId,
      communityId: message.communityId,
      channelId: message.channelId,
      authorId: message.authorId,
      body: message.body,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
    });
  }, [activeChannel.id, activeCommunity.id, upsertLocalMessage]);

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
    enabled: Boolean(authSession),
    communityId: activeCommunity.id,
    channelId: activeChannel.id,
    onInsert: handleRealtimeMessageInsert,
    onUpdate: handleRealtimeMessageUpdate,
    onDelete: handleRealtimeMessageDelete,
  });
  const typingBroadcast = useSupabaseTypingBroadcast({
    enabled: Boolean(authSession),
    communityId: activeCommunity.id,
    channelId: activeChannel.id,
    currentUserId: currentUser.userId,
    displayName: currentUser.displayName,
  });
  const presenceChannel = useSupabasePresenceChannel({
    enabled: Boolean(authSession),
    communityId: activeCommunity.id,
    currentUserId: currentUser.userId,
    displayName: currentUser.displayName,
    status: currentUser.status,
  });
  const displayedActiveCommunity = useMemo<Community>(() => {
    if (!presenceChannel.onlineUserIds.length) return activeCommunity;

    const onlineUserIds = new Set(presenceChannel.onlineUserIds);

    return {
      ...activeCommunity,
      members: activeCommunity.members.map((member) =>
        onlineUserIds.has(member.userId)
          ? {
              ...member,
              status: member.status === "dnd" ? member.status : "online",
              statusText: member.status === "dnd" ? member.statusText : "Online now",
            }
          : member,
      ),
    };
  }, [activeCommunity, presenceChannel.onlineUserIds]);
  const displayedCurrentUser = displayedActiveCommunity.members.find((member) => member.userId === currentUser.userId) ?? currentUser;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    settingsService.updateSettings({ theme });
  }, [theme]);

  useEffect(() => {
    clearChannelUnread({ communityId: activeCommunity.id, channelId: activeChannel.id });
  }, [activeChannel.id, activeCommunity.id, clearChannelUnread]);

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
    if (!authSession || !dataSourceService.getStatus().isSupabase || supabaseSidebarLoadedRef.current.has(activeCommunity.id)) return;

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
  }, [activeCommunity.id, authSession, pushToast, replaceCommunityCategories]);

  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase) return;

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
  }, [activeChannel.id, activeCommunity.id, authSession, mapMessageSummaryToMessage, pushToast, replaceChannelMessages]);

  useEffect(() => {
    if (!authSession || !dataSourceService.getStatus().isSupabase || supabaseMembersLoadedRef.current.has(activeCommunity.id)) return;

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
  }, [activeCommunity.id, activeCommunity.roles, authSession, pushToast, replaceCommunityMembers]);

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
  }, [activeChannel.id, channels, closeTransientOverlays, openPalette, openSettings, selectChannelByOffset]);

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
    ];

    communities.forEach((community) => {
      all.push({
        id: `community-${community.id}`,
        group: "Communities",
        label: community.name,
        detail: "Switch community",
        run: () => {
          switchCommunity(community.id);
          closePalette();
        },
      });

      community.categories
        .flatMap((category) => category.channels)
        .forEach((channel) =>
          all.push({
            id: `channel-${channel.id}`,
            group: "Channels",
            label: `#${channel.name}`,
            detail: community.name,
            run: () => {
              switchCommunity(community.id);
              setActiveChannelId(channel.id);
              clearChannelUnread({ communityId: community.id, channelId: channel.id });
              closePalette();
            },
          }),
        );

      community.members.forEach((member) =>
        all.push({
          id: `member-${community.id}-${member.id}`,
          group: "Members",
          label: member.displayName,
          detail: `@${member.username}`,
          run: () => {
            switchCommunity(community.id);
            closePalette();
            pushToast(`${member.displayName} profile can be opened from the member list.`, "info");
          },
        }),
      );

      community.messages.slice(0, 12).forEach((message) =>
        all.push({
          id: `message-${community.id}-${message.id}`,
          group: "Messages",
          label: message.body.slice(0, 54),
          detail: community.name,
          run: () => {
            switchCommunity(community.id);
            setActiveChannelId(message.channelId);
            clearChannelUnread({ communityId: community.id, channelId: message.channelId });
            closePalette();
            pushToast("Message channel opened. Highlight placeholder is pending.", "info");
          },
        }),
      );
    });

    return all
      .filter((result) => !q || `${result.group} ${result.label} ${result.detail}`.toLowerCase().includes(q))
      .slice(0, 36);
  }, [clearChannelUnread, closePalette, communities, openSettings, paletteQuery, pushToast, setActiveChannelId, switchCommunity, theme]);

  if (!authReady || !authSession) {
    return (
      <>
        <DesktopAppShell>
          <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={() => undefined} />
          {authView === "login" ? (
            <LoginScreen
              theme={theme}
              loading={!authReady || authLoading}
              error={authError}
              onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
              onSubmit={handleLogin}
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
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone ?? "info"}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </>
    );
  }

  const openContext = (event: MouseEvent, items: MenuItem[]) => {
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY, items);
  };

  const sendMessage = async (body: string, attachments?: Attachment[]) => {
    const clientMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await messageService.sendMessage({
      communityId: activeCommunity.id,
      channelId: activeChannel.id,
      authorId: currentUser.userId,
      body,
      clientMessageId,
    });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    appendLocalMessage({
      id: result.data.id,
      clientMessageId,
      communityId: activeCommunity.id,
      channelId: activeChannel.id,
      authorId: result.data.authorId,
      body: result.data.body,
      createdAt: result.data.createdAt,
      attachments,
    });
  };

  const handleCreateCommunity = async (name: string, description?: string) => {
    const result = await communityService.createCommunity({ name, description });

    if (!result.ok) {
      pushToast(result.error.message, "error");
      return;
    }

    const community = addCommunity(createCommunityFromSummary(result.data));
    switchCommunity(community.id);
    setCreateCommunityOpen(false);
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
      position: result.data.position,
    });

    setActiveChannelId(channel.id);
    clearChannelUnread({ communityId: activeCommunity.id, channelId: channel.id });
    setCreateChannelCategoryId(null);
    pushToast(`#${channel.name} created.`, "success");
  };

  const openProfile = (event: MouseEvent, member: Member) => {
    showProfile(member, event.clientX + 10, event.clientY + 10);
  };

  return (
    <>
      <DesktopAppShell>
        <WindowTitleBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} onOpenSearch={openPalette} />
        <div className="desktop-frame">
          <ServerRail
            communities={communities}
            activeCommunityId={activeCommunityId}
            onSelectCommunity={switchCommunity}
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
          <CommunitySidebar
            community={displayedActiveCommunity}
            activeChannelId={activeChannel.id}
            currentUser={displayedCurrentUser}
            onSelectChannel={(channel) => {
              setActiveChannelId(channel.id);
              clearChannelUnread({ communityId: activeCommunity.id, channelId: channel.id });
            }}
            onCreateChannel={(categoryId) => setCreateChannelCategoryId(categoryId)}
            onOpenSettings={openSettings}
            onLogout={handleLogout}
            onChannelContextMenu={(event, channel) =>
              openContext(event, [
                {
                  label: "Copy channel ID",
                  onSelect: () => clipboardService.copyText(channel.id).then(() => pushToast("Channel ID copied.", "success")),
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
          <ChatMain
            community={displayedActiveCommunity}
            channel={activeChannel}
            messages={displayedActiveCommunity.messages}
            realtimeStatus={realtimeStatus}
            typingNames={typingBroadcast.typingNames}
            onTypingStart={typingBroadcast.sendTypingStart}
            onTypingStop={typingBroadcast.sendTypingStop}
            onSendMessage={sendMessage}
            membersVisible={membersVisible}
            onToggleMembers={toggleMembersVisible}
            onMessageContextMenu={(event, message) =>
              openContext(event, [
                { label: "Reply placeholder" },
                { label: "React placeholder" },
                {
                  label: "Copy message ID",
                  onSelect: () => clipboardService.copyText(message.id).then(() => pushToast("Message ID copied.", "success")),
                },
              ])
            }
            onOpenProfile={openProfile}
            onOpenImage={openPreview}
            pushToast={pushToast}
          />
          {membersVisible ? (
            <MemberSidebar
              community={displayedActiveCommunity}
              onOpenProfile={openProfile}
              onMemberContextMenu={(event, member) =>
                openContext(event, [
                  { label: `View ${member.displayName}` },
                  { label: "Message placeholder" },
                  { label: "Moderation placeholder", disabled: true },
                ])
              }
            />
          ) : null}
        </div>
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
      {settingsOpen ? <SettingsModal theme={theme} onThemeChange={setTheme} onClose={closeSettings} pushToast={pushToast} /> : null}
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
      {profile ? <UserProfilePopover member={profile.member} community={activeCommunity} x={profile.x} y={profile.y} onClose={closeProfile} /> : null}
      {preview ? <ImagePreviewModal image={preview} onClose={closePreview} /> : null}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone ?? "info"}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
