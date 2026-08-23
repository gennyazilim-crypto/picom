import { ProfileDisplayName, ProfileUsername, useProfileDisplayName } from "./ProfileDisplayName";
import { profileMediaStore } from "../services/profileMedia/profileMediaStore";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "../utils/motionLite";
import "./DirectMessagesView.css";
import type { Attachment } from "../types/community";
import type { DirectConversation, DirectMessage, DirectMessageAttachment } from "../types/directMessages";
import { getMessageSendReference } from "../services/messageSendObservability";
import type { DmCall, DmCallRuntimeState, DmCallType } from "../types/dmCalls";
import { dateTimeService } from "../services/dateTimeService";
import { messageDraftService } from "../services/messageDraftService";
import { clipboardService } from "../services/clipboardService";
import { externalLinkService } from "../services/externalLinkService";
import { fileService, type LocalAttachmentPreview } from "../services/fileService";
import { directAttachmentUploadService, isRenderableDirectAttachmentUrl } from "../services/directMessages/directAttachmentUploadService";
import { dmMessageChime } from "../services/directMessages/dmMessageChime";
import { getDirectMutedUntil } from "../services/directMessages/directSafetyService";
import { settingsService } from "../services/settingsService";
import type { DirectMuteDuration } from "../types/directMessageSafety";
import { directMuteDurationLabels } from "../types/directMessageSafety";
import { useDirectTypingBroadcast } from "../hooks/useDirectTypingBroadcast";
import { AppIcon } from "./AppIcon";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { EmojiPicker } from "./EmojiPicker";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { OverlayMenuItem } from "../state/useOverlayState";
import { useDmCallInformation } from "../hooks/useDmCallInformation";
import {
  DmCallHeaderControls,
  DmCallTimelineEvent,
  DmCallVideoStage,
  type DmCallPeer,
} from "./directMessages/DmCallInformation";
import { useTranslation } from "../i18n";
import type { TFunction } from "../i18n";

/** Presence codes are stored raw ("dnd", "idle", …); the UI never shows them untranslated. */
function statusLabelFor(t: TFunction, status: DirectConversation["participantStatus"]): string {
  if (status === "dnd") return t("status.busy");
  if (status === "idle") return t("status.idle");
  if (status === "offline") return t("status.offline");
  return t("status.online");
}

type NoticeKind = "info" | "success" | "error";
type SendDirectMessage = (conversationId: string, body: string, attachments?: readonly DirectMessageAttachment[], replyToMessageId?: string, retryClientMessageId?: string) => Promise<boolean>;
type DirectMessagesViewProps = {
  conversations: DirectConversation[];
  activeConversationId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  friendRequestCount: number;
  onSelectConversation: (conversationId: string) => void;
  onBackToCommunity: () => void;
  onOpenFriends: () => void;
  onOpenPendingFriends: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenCommunity: (communityId: string) => void;
  onSendMessage: SendDirectMessage;
  onEditMessage: (messageId: string, body: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<boolean>;
  onToggleReaction: (message: DirectMessage, emoji: string) => Promise<boolean>;
  onRemoveFailedMessage: (messageId: string) => void;
  onSetMuted: (conversationId: string, mutedUntil: string | null) => Promise<boolean>;
  onDeleteConversation: (conversationId: string) => Promise<boolean>;
  onBlockUser: (userId: string) => Promise<boolean>;
  onReportUser: (userId: string, conversationId: string) => void;
  onReportMessage: (message: DirectMessage, conversation: DirectConversation) => void;
  onNotice: (message: string, kind?: NoticeKind) => void;
  callRuntime: DmCallRuntimeState;
  activeDirectCall?: DmCall | null;
  onStartCall: (conversationId: string, peer: DmCallPeer, type: DmCallType, screenShare?: boolean) => void;
  onJoinCall: (call: DmCall, peer: DmCallPeer) => void;
  onToggleCallMute: () => void;
  onToggleCallCamera: () => void;
  onToggleCallScreenShare: () => void;
  onEndCall: (call: DmCall) => void;
};

type ConversationListProps = Pick<DirectMessagesViewProps, "conversations" | "activeConversationId" | "onSelectConversation" | "onDeleteConversation"> & Readonly<{ calls: readonly DmCall[] }>;
type DirectMessagesSidebarProps = ConversationListProps & Pick<DirectMessagesViewProps, "friendRequestCount" | "onOpenFriends" | "onOpenPendingFriends">;

function getConversationIdentity(conversation: DirectConversation) {
  const record = profileMediaStore.getSnapshot(conversation.participantUserId).record;
  return {
    displayName: record?.displayName?.trim() || conversation.participantName,
    username: (record?.username?.trim() || conversation.participantUsername).replace(/^@+/, ""),
    avatarUrl: record?.avatar.thumbnailUrl ?? record?.avatar.url ?? conversation.participantAvatarUrl,
  };
}

function DirectAvatar({ conversation, large = false, compact = false }: { conversation: DirectConversation; large?: boolean; compact?: boolean }) {
  const { t } = useTranslation("messaging");
  const verification = getUserVerificationSummary(conversation.participantUserId);
  const displayName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  return <span className={`direct-avatar-shell status-${conversation.participantStatus} ${large ? "large" : ""} ${compact ? "compact" : ""}`}><VerifiedAvatarFrame userId={conversation.participantUserId} label={displayName} avatarUrl={getConversationIdentity(conversation).avatarUrl} size={compact ? "compact" : "medium"} avatarSize={large ? 64 : compact ? 38 : 42} verification={verification} /><i className="direct-status-dot" role="img" aria-label={t("list.statusAria", { name: displayName, status: statusLabelFor(t, conversation.participantStatus) })} /></span>;
}

export function DirectConversationItem({ conversation, active, call, unreadCallCount = 0, onSelect, onDelete }: { conversation: DirectConversation; active: boolean; call?: DmCall; unreadCallCount?: number; onSelect: () => void; onDelete: () => void }) {
  const { t } = useTranslation("messaging");
  const verification = getUserVerificationSummary(conversation.participantUserId);
  const displayName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  const hasDraft = messageDraftService.hasDraft({ directConversationId: conversation.id });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const activeCall = call && (call.status === "ringing" || call.status === "active");
  const missedCall = call?.status === "missed" && call.unread;
  const preview = activeCall
    ? t(call.callType === "video" ? "preview.videoCallActive" : "preview.voiceCallActive")
    : missedCall
      ? t(call.callType === "video" ? "preview.missedVideoCall" : "preview.missedVoiceCall")
      : conversation.lastMessagePreview || t("preview.startConversation");
  const unreadCount = conversation.unreadCount + unreadCallCount;
  const menuItems: OverlayMenuItem[] = [
    { label: t("menu.openChat"), icon: "inbox", onSelect },
    { label: t("menu.deleteChat"), icon: "trash", tone: "danger", detail: t("menu.deleteChatDetail"), onSelect: () => setConfirmDelete(true) },
  ];
  const removeChat = async () => {
    if (deleting) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirmDelete(false);
  };
  return (
    <>
      <button
        type="button"
        className={`direct-conversation ${active ? "active" : ""}${conversation.unreadCount ? " has-unread" : ""}`}
        onClick={onSelect}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
        aria-current={active ? "page" : undefined}
      >
        <DirectAvatar conversation={conversation} />
        <span className="direct-copy">
          <span className="direct-copy-top">
            <strong><ProfileDisplayName userId={conversation.participantUserId} fallback={conversation.participantName} /><VerifiedBadge userId={conversation.participantUserId} verification={verification} size="xs" /></strong>
            <time dateTime={conversation.updatedAt}>{dateTimeService.formatMessageTime(conversation.updatedAt)}</time>
          </span>
          <span className="direct-copy-bottom">
            <small className={missedCall ? "direct-call-preview-missed" : activeCall ? "direct-call-preview-active" : ""}>{preview}</small>
            {unreadCount ? <em aria-label={t("list.unreadAria", { count: unreadCount })}>{unreadCount > 9 ? "9+" : unreadCount}</em> : activeCall ? <i className="direct-call-list-live">{t("list.live")}</i> : hasDraft ? <i className="direct-draft-indicator">{t("list.draft")}</i> : null}
          </span>
        </span>
      </button>
      {menu ? <DesktopContextMenu x={menu.x} y={menu.y} items={menuItems} ariaLabel={t("list.chatActionsAria", { name: displayName })} onClose={() => setMenu(null)} /> : null}
      {confirmDelete ? (
        <div className="direct-list-delete-confirm" role="alertdialog" aria-label={t("delete.confirmAria", { name: displayName })}>
          <strong>{t("delete.title")}</strong>
          <span>{t("delete.body")}</span>
          <div>
            <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>{t("action.cancel")}</button>
            <button type="button" className="danger" disabled={deleting} onClick={() => void removeChat()}>{deleting ? t("action.deleting") : t("action.delete")}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DirectConversationList({ conversations, calls, activeConversationId, onSelectConversation, onDeleteConversation }: ConversationListProps) {
  const { t } = useTranslation("messaging");
  if (!conversations.length) return <div className="direct-list-empty"><AppIcon name="inbox" size="xl" /><strong>{t("list.emptyTitle")}</strong><span>{t("list.emptyBody")}</span></div>;
  return <div className="direct-conversation-list" aria-label={t("list.recentAria")}>{conversations.map((conversation) => {
    const conversationCalls = calls.filter((call) => call.conversationId === conversation.id);
    return <DirectConversationItem key={conversation.id} conversation={conversation} call={conversationCalls[0]} unreadCallCount={conversationCalls.filter((call) => call.unread).length} active={conversation.id === activeConversationId} onSelect={() => onSelectConversation(conversation.id)} onDelete={() => void onDeleteConversation(conversation.id)} />;
  })}</div>;
}

export function DirectMessagesSidebar(props: DirectMessagesSidebarProps) {
  const { t } = useTranslation("messaging");
  const [query, setQuery] = useState("");
  const participantUserIds = useMemo(
    () => Array.from(new Set(props.conversations.map((conversation) => conversation.participantUserId))).sort(),
    [props.conversations],
  );
  const subscribeToIdentity = useCallback((listener: () => void) => {
    const cleanups = participantUserIds.map((userId) => profileMediaStore.subscribe(userId, listener));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [participantUserIds]);
  const getIdentityRevision = useCallback(() => participantUserIds.map((userId) => {
    const record = profileMediaStore.getSnapshot(userId).record;
    return [userId, record?.updatedAt ?? "", record?.displayName ?? "", record?.username ?? ""].join(":");
  }).join("|"), [participantUserIds]);
  const identityRevision = useSyncExternalStore(subscribeToIdentity, getIdentityRevision, getIdentityRevision);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return props.conversations;
    return props.conversations.filter((conversation) => {
      const identity = getConversationIdentity(conversation);
      return `${identity.displayName} ${identity.username} ${conversation.lastMessagePreview}`.toLowerCase().includes(value);
    });
  }, [identityRevision, props.conversations, query]);
  const pendingCount = props.friendRequestCount;

  return (
    <aside className="direct-list" aria-label={t("sidebar.aria")}>
      <header className="direct-list-header">
        <div className="direct-list-heading">
          <h2>{t("sidebar.title")}</h2>
          <button className="direct-list-compose icon-button" type="button" aria-label={t("sidebar.compose")} title={t("sidebar.compose")} onClick={props.onOpenFriends}>
            <AppIcon name="plus" size="sm" />
          </button>
        </div>
        <label className="direct-search">
          <AppIcon name="search" size="sm" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("sidebar.searchPlaceholder")} aria-label={t("sidebar.searchAria")} />
        </label>
      </header>
      <nav className="direct-shortcuts" aria-label={t("sidebar.sectionsAria")}>
        <button type="button" onClick={props.onOpenFriends}>
          <AppIcon name="users" size="sm" />
          <span>{t("sidebar.friends")}</span>
        </button>
        <button type="button" onClick={props.onOpenPendingFriends}>
          <AppIcon name="inbox" size="sm" />
          <span>{t("sidebar.pending")}</span>
          {pendingCount > 0 ? <small className="direct-shortcut-badge">{pendingCount > 9 ? "9+" : pendingCount}</small> : null}
        </button>
      </nav>
      <div className="direct-list-section">
        <span className="direct-list-section-label">{t("sidebar.chats")}</span>
        <span className="direct-list-section-count">{filtered.length}</span>
      </div>
      <DirectConversationList conversations={filtered} calls={props.calls} activeConversationId={props.activeConversationId} onSelectConversation={props.onSelectConversation} onDeleteConversation={props.onDeleteConversation} />
    </aside>
  );
}

export function DirectChatHeader({ conversation, call, callRuntime, searchOpen, searchQuery, detailsOpen, onSearchOpen, onSearchChange, onDetailsToggle, onBack, onOpenProfile, onStartCall, onJoinCall, onToggleCallMute, onToggleCallCamera, onToggleCallScreenShare, onEndCall, onDeleteConversation }: { conversation: DirectConversation; call?: DmCall; callRuntime: DmCallRuntimeState; searchOpen: boolean; searchQuery: string; detailsOpen: boolean; onSearchOpen: () => void; onSearchChange: (value: string) => void; onDetailsToggle: () => void; onBack: () => void; onOpenProfile: (userId: string) => void; onStartCall: (type: DmCallType, screenShare?: boolean) => void; onJoinCall: () => void; onToggleCallMute: () => void; onToggleCallCamera: () => void; onToggleCallScreenShare: () => void; onEndCall: () => void; onDeleteConversation?: () => Promise<boolean> }) {
  const { t } = useTranslation("messaging");
  const verification = getUserVerificationSummary(conversation.participantUserId);
  const displayName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const statusLabel = statusLabelFor(t, conversation.participantStatus);
  const removeChat = async () => {
    if (!onDeleteConversation || deleting) return;
    setDeleting(true);
    const deleted = await onDeleteConversation();
    setDeleting(false);
    if (deleted) setConfirmDelete(false);
  };
  return (
    <header className="direct-chat-header">
      <div className="direct-chat-header-inner">
        <button className="icon-button direct-back-button" aria-label={t("header.back")} title={t("header.backTitle")} onClick={onBack}>
          <AppIcon name="chevronRight" size="sm" />
        </button>

        <button
          type="button"
          className="direct-chat-identity"
          onClick={() => onOpenProfile(conversation.participantUserId)}
          aria-label={t("header.openProfile", { name: displayName })}
        >
          <DirectAvatar conversation={conversation} />
          <span className="direct-chat-identity__copy">
            <strong className="direct-chat-identity__name">
              <ProfileDisplayName userId={conversation.participantUserId} fallback={conversation.participantName} />
              <VerifiedBadge userId={conversation.participantUserId} verification={verification} size="sm" />
            </strong>
            <span className="direct-chat-identity__meta">
              <small className="direct-chat-identity__handle">
                @<ProfileUsername userId={conversation.participantUserId} fallback={conversation.participantUsername} />
              </small>
              <span className={`direct-chat-identity__status status-${conversation.participantStatus}`} aria-label={statusLabel}>
                <i aria-hidden="true" />
                {conversation.participantStatusText?.trim() || statusLabel}
              </span>
            </span>
          </span>
        </button>

        {searchOpen ? (
          <label className="direct-header-search">
            <AppIcon name="search" size="sm" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("header.searchPlaceholder")}
              aria-label={t("header.searchAria")}
            />
            <button type="button" className="direct-header-search__clear" aria-label={t("header.closeSearch")} onClick={onSearchOpen}>
              <AppIcon name="close" size="xs" />
            </button>
          </label>
        ) : <span className="direct-header-spacer" aria-hidden="true" />}

        <div className="direct-header-actions">
          <DmCallHeaderControls
            call={call}
            peer={{ id: conversation.participantUserId, name: displayName, avatarUrl: getConversationIdentity(conversation).avatarUrl }}
            runtime={callRuntime}
            onStart={onStartCall}
            onJoin={onJoinCall}
            onToggleMute={onToggleCallMute}
            onToggleCamera={onToggleCallCamera}
            onScreenShare={onToggleCallScreenShare}
            onEnd={onEndCall}
          />
          <span className="direct-header-actions__divider" aria-hidden="true" />
          <div className="direct-header-tools" role="group" aria-label={t("header.toolsAria")}>
            <button className={`icon-button ${searchOpen ? "active" : ""}`} type="button" aria-label={t("header.searchConversation")} title={t("header.searchTitle")} aria-pressed={searchOpen} onClick={onSearchOpen}>
              <AppIcon name="search" size="sm" />
            </button>
            <button className={`icon-button ${detailsOpen ? "active" : ""}`} type="button" aria-label={t("header.toggleDetails")} aria-expanded={detailsOpen} aria-pressed={detailsOpen} title={t("header.sharedMediaTitle")} onClick={onDetailsToggle}>
              <AppIcon name="image" size="sm" />
            </button>
            {onDeleteConversation ? (
              <button className="icon-button direct-header-delete" type="button" aria-label={t("header.deleteChat")} title={t("header.deleteChat")} onClick={() => setConfirmDelete(true)}>
                <AppIcon name="trash" size="sm" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {confirmDelete ? (
        <div className="direct-chat-delete-confirm" role="alertdialog" aria-label={t("header.deleteConfirmAria")}>
          <span>{t("header.deleteConfirmBody", { name: displayName })}</span>
          <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>{t("action.cancel")}</button>
          <button type="button" className="danger" disabled={deleting} onClick={() => void removeChat()}>{deleting ? t("action.deleting") : t("action.delete")}</button>
        </div>
      ) : null}
    </header>
  );
}

function toPreviewAttachment(attachment: DirectMessageAttachment): Attachment {
  return {
    id: attachment.id,
    type: "image",
    url: attachment.url,
    publicUrl: attachment.url,
    storagePath: attachment.storagePath,
    mimeType: attachment.mimeType,
    width: attachment.width,
    height: attachment.height,
    alt: attachment.name,
    // DM media is private to conversation participants and passes the upload
    // service's byte-signature validation. Older rows predate this UI field.
    scanStatus: attachment.scanStatus ?? "clean",
  };
}

function renderDirectMessageText(body: string, onOpenLink: (url: string) => void) {
  return body.split(/(https?:\/\/[^\s]+)/gi).filter(Boolean).map((part, index) => /^https?:\/\//i.test(part) ? <button type="button" className="direct-message-link" key={`${index}-${part}`} onClick={() => onOpenLink(part)}>{part}</button> : <span key={`${index}-text`}>{part}</span>);
}

function DirectAttachmentThumb({ attachment, onPreview }: { attachment: DirectMessageAttachment; onPreview: (attachment: Attachment) => void }) {
  const { t } = useTranslation("messaging");
  const [broken, setBroken] = useState(false);
  const canShow = isRenderableDirectAttachmentUrl(attachment.url) && !broken;

  if (attachment.type === "image") {
    return (
      <button type="button" aria-label={t("attachment.preview", { name: attachment.name })} onClick={() => canShow && onPreview(toPreviewAttachment(attachment))}>
        {canShow ? (
          <img src={attachment.url} alt={attachment.name} onError={() => setBroken(true)} />
        ) : (
          <span className="dm-shared-media-fallback" title={attachment.name}>
            <AppIcon name="image" size="sm" />
          </span>
        )}
      </button>
    );
  }

  if (attachment.type === "video") {
    return canShow ? (
      <div className="direct-attachment-video">
        <video src={attachment.url} controls preload="metadata" aria-label={attachment.name} />
      </div>
    ) : (
      <div className="dm-shared-media-fallback" title={attachment.name} aria-label={attachment.name}>
        <AppIcon name="image" size="sm" />
      </div>
    );
  }

  if (!canShow) {
    return (
      <span className="direct-attachment-file-fallback">
        <AppIcon name="paperclip" size="sm" />
        {attachment.name}
      </span>
    );
  }

  return (
    <a href={attachment.url} download={attachment.name}>
      <AppIcon name="paperclip" size="sm" />
      {attachment.name}
    </a>
  );
}

function DirectAttachmentGrid({ attachments, onPreview }: { attachments: readonly DirectMessageAttachment[]; onPreview: (attachment: Attachment) => void }) {
  const visible = attachments.slice(0, 4);
  return (
    <div className={`direct-attachment-grid count-${visible.length}`}>
      {visible.map((attachment) => (
        <DirectAttachmentThumb key={attachment.id} attachment={attachment} onPreview={onPreview} />
      ))}
    </div>
  );
}

type DirectMessageGroupModel = Readonly<{ id: string; authorId: string; messages: DirectMessage[] }>;
const directMessageGroupWindowMs = 5 * 60 * 1000;
function groupDirectMessages(messages: readonly DirectMessage[]): DirectMessageGroupModel[] { const groups: Array<{ id: string; authorId: string; messages: DirectMessage[] }> = []; for (const message of messages) { const current = groups[groups.length - 1]; const previous = current?.messages[current.messages.length - 1]; const gap = previous ? new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() : Number.POSITIVE_INFINITY; const contextBreak = Boolean(previous?.replyPreview || message.replyPreview || previous?.deletedAt || message.deletedAt); if (current && previous && current.authorId === message.authorId && gap >= 0 && gap <= directMessageGroupWindowMs && !contextBreak) current.messages.push(message); else groups.push({ id: message.id, authorId: message.authorId, messages: [message] }); } return groups; }

type MessageUnitProps = {
  message: DirectMessage;
  own: boolean;
  finalInGroup: boolean;
  onPreview: (attachment: Attachment) => void;
  onReply: (message: DirectMessage) => void;
  onJumpToReply: (messageId: string) => void;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  onToggleReaction: (message: DirectMessage, emoji: string) => Promise<boolean>;
  onReport: (message: DirectMessage) => void;
  onRetry: (message: DirectMessage) => Promise<boolean>;
  onRemoveFailed: (messageId: string) => void;
  onNotice: (message: string, kind?: NoticeKind) => void;
};

function DirectMessageUnit({ message, own, finalInGroup, onPreview, onReply, onJumpToReply, onEdit, onDelete, onToggleReaction, onReport, onRetry, onRemoveFailed, onNotice }: MessageUnitProps) {
  const { t } = useTranslation("messaging");
  const [actionsPinned, setActionsPinned] = useState(false); const [reactionPickerOpen, setReactionPickerOpen] = useState(false); const [editing, setEditing] = useState(false); const [editBody, setEditBody] = useState(message.body); const [confirmDelete, setConfirmDelete] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { setEditBody(message.body); }, [message.body]);
  const openLink = async (url: string) => { const result = await externalLinkService.openExternalUrl(url); if (!result.ok) onNotice(externalLinkService.getUserFriendlyError(result.reason), "error"); };
  const copy = async () => { const result = await clipboardService.copyText(message.body); onNotice(result.ok ? t("message.copied") : result.reason, result.ok ? "success" : "error"); };
  const saveEdit = async () => { const value = editBody.trim(); if (!value || value === message.body || busy) { if (value === message.body) setEditing(false); return; } setBusy(true); const saved = await onEdit(message.id, value); setBusy(false); if (saved) setEditing(false); };
  const remove = async () => { if (busy) return; setBusy(true); const deleted = await onDelete(message.id); setBusy(false); if (deleted) setConfirmDelete(false); };
  const deleted = Boolean(message.deletedAt);
  return <div id={`direct-message-${message.id}`} data-direct-message-id={message.id} className={`direct-message-unit ${actionsPinned ? "actions-pinned" : ""} status-${message.sendStatus ?? "sent"}`} onContextMenu={(event) => { event.preventDefault(); if (!deleted) setActionsPinned(true); }}>
    {message.replyPreview ? (
      <button
        type="button"
        className="direct-reply-preview"
        aria-label={t("message.replyJumpAria", { author: message.replyPreview.authorName, body: message.replyPreview.body || t("message.unavailable") })}
        onClick={() => onJumpToReply(message.replyPreview!.messageId)}
      >
        <strong>{message.replyPreview.authorName}</strong>
        <span>{message.replyPreview.body || t("message.unavailable")}</span>
      </button>
    ) : null}
    {editing ? <div className="direct-edit-form"><textarea autoFocus value={editBody} maxLength={4000} onChange={(event) => setEditBody(event.target.value)} onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Escape") { event.preventDefault(); setEditing(false); setEditBody(message.body); } else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveEdit(); } }} /><div><button type="button" disabled={busy} onClick={() => { setEditing(false); setEditBody(message.body); }}>{t("action.cancel")}</button><button type="button" disabled={busy || !editBody.trim()} onClick={() => void saveEdit()}>{t("action.save")}</button></div></div> : message.body || deleted ? <div className="direct-message-bubble">{deleted ? <em>{t("message.deleted")}</em> : renderDirectMessageText(message.body, (url) => void openLink(url))}</div> : null}
    {!deleted && message.attachments?.length ? <DirectAttachmentGrid attachments={message.attachments} onPreview={onPreview} /> : null}
    {!deleted && message.reactions?.length ? <div className="direct-reaction-row">{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" className={reaction.reactedByCurrentUser ? "active" : ""} aria-pressed={reaction.reactedByCurrentUser} aria-label={t("message.reactionAria", { emoji: reaction.emoji, count: reaction.count })} onClick={() => void onToggleReaction(message, reaction.emoji)}><span>{reaction.emoji}</span>{reaction.count}</button>)}</div> : null}
    {!deleted ? <div className="direct-message-actions"><button type="button" aria-label={t("messageAction.reply")} title={t("messageAction.replyTitle")} onClick={() => onReply(message)}><AppIcon name="reply" size="xs" /></button><button type="button" aria-label={t("messageAction.react")} title={t("messageAction.reactTitle")} onClick={() => setReactionPickerOpen((open) => !open)}><AppIcon name="smile" size="xs" /></button>{own && message.sendStatus !== "failed" ? <button type="button" aria-label={t("messageAction.edit")} title={t("messageAction.editTitle")} onClick={() => setEditing(true)}><AppIcon name="edit" size="xs" /></button> : null}<button type="button" aria-label={t("messageAction.copy")} title={t("messageAction.copyTitle")} onClick={() => void copy()}><span className="direct-copy-glyph" aria-hidden="true">⧉</span></button>{!own ? <button type="button" aria-label={t("messageAction.report")} title={t("messageAction.reportTitle")} onClick={() => onReport(message)}><AppIcon name="more" size="xs" /></button> : null}{own && message.sendStatus !== "failed" ? <button type="button" aria-label={t("messageAction.delete")} title={t("messageAction.deleteTitle")} onClick={() => setConfirmDelete(true)}><AppIcon name="trash" size="xs" /></button> : null}{actionsPinned ? <button type="button" aria-label={t("messageAction.close")} title={t("messageAction.closeTitle")} onClick={() => setActionsPinned(false)}><AppIcon name="close" size="xs" /></button> : null}</div> : null}
    {reactionPickerOpen ? <EmojiPicker className="direct-reaction-picker" label={t("messageAction.reactionPickerLabel")} mode="reaction" onClose={() => setReactionPickerOpen(false)} onSelect={(emoji) => { void onToggleReaction(message, emoji); setReactionPickerOpen(false); }} /> : null}
    {confirmDelete ? <div className="direct-delete-confirm" role="alert"><span>{t("message.deleteConfirm")}</span><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>{t("action.cancel")}</button><button type="button" disabled={busy} className="danger" onClick={() => void remove()}>{t("action.delete")}</button></div> : null}
    {message.sendStatus === "failed" || message.sendStatus === "retryable_failed" ? <div className="direct-message-recovery" role="alert"><span>{message.sendAttempt ? t("message.notSentRef", { reference: getMessageSendReference(message.sendAttempt.correlationId) }) : t("message.notSent")}</span>{message.sendStatus === "retryable_failed" ? <button type="button" onClick={() => void onRetry(message)}>{t("action.retry")}</button> : null}<button type="button" onClick={() => void copy()}>{t("action.copy")}</button><button type="button" onClick={() => onRemoveFailed(message.id)}>{t("action.remove")}</button></div> : null}
    {finalInGroup ? <small className="direct-message-meta"><time dateTime={message.createdAt}>{dateTimeService.formatMessageTime(message.createdAt)}</time>{message.editedAt && !deleted ? <span>{t("message.edited")}</span> : null}{own && !deleted && message.sendStatus && message.sendStatus !== "sent" ? <span>{message.sendStatus === "sending" ? t("message.sending") : t("message.failed")}</span> : null}</small> : null}
  </div>;
}

export function DirectMessageGroup({ group, conversation, currentUserId, onOpenProfile, onPreview, onReply, onJumpToReply, onEdit, onDelete, onToggleReaction, onReport, onRetry, onRemoveFailed, onNotice }: { group: DirectMessageGroupModel; conversation: DirectConversation; currentUserId: string; onOpenProfile?: (userId: string) => void; onPreview: (attachment: Attachment) => void; onReply: (message: DirectMessage) => void; onJumpToReply: (messageId: string) => void; onEdit: MessageUnitProps["onEdit"]; onDelete: MessageUnitProps["onDelete"]; onToggleReaction: MessageUnitProps["onToggleReaction"]; onReport: MessageUnitProps["onReport"]; onRetry: MessageUnitProps["onRetry"]; onRemoveFailed: MessageUnitProps["onRemoveFailed"]; onNotice: MessageUnitProps["onNotice"] }) {
  const { t } = useTranslation("messaging");
  const own = group.authorId === currentUserId; const verification = getUserVerificationSummary(conversation.participantUserId);
  const participantName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  return (
    <article className={`direct-message-group ${own ? "own" : "incoming"}`}>
      {!own ? (
        <button type="button" className="direct-message-group-avatar" aria-label={t("header.openProfile", { name: participantName })} onClick={() => onOpenProfile?.(conversation.participantUserId)} disabled={!onOpenProfile}>
          <DirectAvatar conversation={conversation} compact />
        </button>
      ) : null}
      <div className="direct-message-group-content">
        {!own ? (
          <header className="direct-message-author">
            <button type="button" className="direct-message-author-link" onClick={() => onOpenProfile?.(conversation.participantUserId)} disabled={!onOpenProfile}>
              <strong><ProfileDisplayName userId={conversation.participantUserId} fallback={conversation.participantName} /><VerifiedBadge userId={conversation.participantUserId} verification={verification} size="xs" /></strong>
            </button>
          </header>
        ) : null}
        {group.messages.map((message, index) => <DirectMessageUnit key={message.id} message={message} own={own} finalInGroup={index === group.messages.length - 1} onPreview={onPreview} onReply={onReply} onJumpToReply={onJumpToReply} onEdit={onEdit} onDelete={onDelete} onToggleReaction={onToggleReaction} onReport={onReport} onRetry={onRetry} onRemoveFailed={onRemoveFailed} onNotice={onNotice} />)}
      </div>
    </article>
  );
}

export function DirectMessageItem({ message, conversation, currentUserId }: { message: DirectMessage; conversation: DirectConversation; currentUserId: string }) { return <DirectMessageGroup group={{ id: message.id, authorId: message.authorId, messages: [message] }} conversation={conversation} currentUserId={currentUserId} onPreview={() => undefined} onReply={() => undefined} onJumpToReply={() => undefined} onEdit={async () => false} onDelete={async () => false} onToggleReaction={async () => false} onReport={() => undefined} onRetry={async () => false} onRemoveFailed={() => undefined} onNotice={() => undefined} />; }

type DirectTimelineItem =
  | Readonly<{ kind: "messages"; id: string; at: number; group: DirectMessageGroupModel }>
  | Readonly<{ kind: "call"; id: string; at: number; call: DmCall }>;

export function DirectMessageList({ conversation, currentUserId, query, typingNames, calls, activeCall, onOpenProfile, onPreview, onReply, onEdit, onDelete, onToggleReaction, onReport, onRetry, onRemoveFailed, onNotice, onStartCall, onMarkCallsRead, onDismissCall }: { conversation: DirectConversation; currentUserId: string; query: string; typingNames: string[]; calls: readonly DmCall[]; activeCall?: DmCall; onOpenProfile: (userId: string) => void; onPreview: (attachment: Attachment) => void; onReply: (message: DirectMessage) => void; onEdit: MessageUnitProps["onEdit"]; onDelete: MessageUnitProps["onDelete"]; onToggleReaction: MessageUnitProps["onToggleReaction"]; onReport: MessageUnitProps["onReport"]; onRetry: MessageUnitProps["onRetry"]; onRemoveFailed: MessageUnitProps["onRemoveFailed"]; onNotice: MessageUnitProps["onNotice"]; onStartCall: (type: DmCallType) => void; onMarkCallsRead: () => void; onDismissCall: (callId: string) => Promise<boolean> }) {
  const { t } = useTranslation("messaging");
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previousTailRef = useRef<{ conversationId: string; messageId: string; count: number } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const visible = useMemo(() => { const retained = conversation.messages.filter((message) => !message.deletedAt); const value = query.trim().toLowerCase(); return value ? retained.filter((message) => message.body.toLowerCase().includes(value)) : retained; }, [conversation.messages, query]);
  const groups = useMemo(() => groupDirectMessages(visible), [visible]);
  const participantName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  const peerAvatarUrl = getConversationIdentity(conversation).avatarUrl;
  const peer = useMemo<DmCallPeer>(() => ({ id: conversation.participantUserId, name: participantName, avatarUrl: peerAvatarUrl }), [conversation.participantUserId, participantName, peerAvatarUrl]);
  const timeline = useMemo<DirectTimelineItem[]>(() => {
    const value = query.trim().toLowerCase();
    const messageItems: DirectTimelineItem[] = groups.map((group) => ({ kind: "messages", id: `messages-${group.id}`, at: new Date(group.messages[0]?.createdAt ?? conversation.updatedAt).getTime(), group }));
    const callItems: DirectTimelineItem[] = calls
      .filter((call) => call.id !== activeCall?.id)
      .filter((call) => !value || `${call.callType} ${call.status} call ${participantName}`.toLowerCase().includes(value))
      .map((call) => ({ kind: "call", id: `call-${call.id}`, at: new Date(call.startedAt).getTime(), call }));
    return [...messageItems, ...callItems].sort((left, right) => left.at - right.at);
  }, [activeCall?.id, calls, participantName, conversation.updatedAt, groups, query]);
  const latestVisible = visible[visible.length - 1];
  const scrollToken = `${conversation.id}:${visible.length}:${latestVisible?.id ?? "empty"}:${activeCall?.id ?? ""}:${timeline.length}`;

  useEffect(() => {
    if (query) return;
    const previous = previousTailRef.current;
    const isSameConversation = previous?.conversationId === conversation.id;
    const isNewMessage = Boolean(
      latestVisible
      && isSameConversation
      && latestVisible.id !== previous?.messageId,
    );
    const isIncoming = Boolean(isNewMessage && latestVisible && latestVisible.authorId !== currentUserId);

    if (isIncoming && settingsService.getSettings().notificationSettings.soundEnabled !== false) {
      dmMessageChime.playIncoming();
    }

    previousTailRef.current = {
      conversationId: conversation.id,
      messageId: latestVisible?.id ?? "",
      count: visible.length,
    };

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const scrollArea = scrollRef.current;
        if (scrollArea) {
          if (isNewMessage) {
            scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
          } else {
            scrollArea.scrollTop = scrollArea.scrollHeight;
          }
          return;
        }
        endRef.current?.scrollIntoView({ block: "end", behavior: isNewMessage ? "smooth" : "auto" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeCall?.id, conversation.id, currentUserId, latestVisible, query, scrollToken, visible.length]);

  const jump = (messageId: string) => { const target = document.getElementById(`direct-message-${messageId}`); if (!target) { onNotice(t("message.replyOutOfPage"), "info"); return; } target.scrollIntoView({ behavior: "smooth", block: "center" }); setHighlightedId(messageId); window.setTimeout(() => setHighlightedId((current) => current === messageId ? null : current), 1800); };
  return <div ref={scrollRef} className="direct-message-list" aria-live="polite"><div className="direct-message-stack">
    {timeline.map((item, index) => {
      if (item.kind === "call") return <DmCallTimelineEvent key={item.id} call={item.call} currentUserId={currentUserId} peer={peer} onCallBack={onStartCall} onMarkRead={onMarkCallsRead} onDismiss={() => onDismissCall(item.call.id)} />;
      const previous = timeline[index - 1];
      const compactFollowUp = previous?.kind === "messages" && previous.group.authorId === item.group.authorId;
      return <div key={item.id} className={`${item.group.messages.some((message) => message.id === highlightedId) ? "direct-message-highlight" : ""}${compactFollowUp ? " direct-message-turn-compact" : ""}`.trim()}><DirectMessageGroup group={item.group} conversation={conversation} currentUserId={currentUserId} onOpenProfile={onOpenProfile} onPreview={onPreview} onReply={onReply} onJumpToReply={jump} onEdit={onEdit} onDelete={onDelete} onToggleReaction={onToggleReaction} onReport={onReport} onRetry={onRetry} onRemoveFailed={onRemoveFailed} onNotice={onNotice} /></div>;
    })}
    {typingNames.length ? <div className="direct-typing-indicator" role="status"><span aria-hidden="true"><i /><i /><i /></span>{typingNames.length === 1 ? t("typing.one", { name: typingNames[0] }) : t("typing.many", { names: typingNames.join(", ") })}</div> : null}<div ref={endRef} />
  </div></div>;
}

type UploadPreview = LocalAttachmentPreview & { status: "pending" | "uploading" | "uploaded" | "failed" | "canceled"; progress: number; error?: string; attachment?: DirectMessageAttachment };

export function DirectMessageComposer({ conversation, replyTo, onCancelReply, onSendMessage, onTypingStart, onTypingStop, onNotice }: { conversation: DirectConversation; replyTo?: DirectMessage; onCancelReply: () => void; onSendMessage: SendDirectMessage; onTypingStart: () => void; onTypingStop: () => void; onNotice: (message: string, kind?: NoticeKind) => void }) {
  const { t } = useTranslation("messaging");
  const participantName = useProfileDisplayName(conversation.participantUserId, conversation.participantName);
  const [body, setBody] = useState(() => messageDraftService.getDraft({ directConversationId: conversation.id })?.text ?? ""); const [previews, setPreviews] = useState<UploadPreview[]>([]); const [sending, setSending] = useState(false); const [error, setError] = useState<string | null>(null); const [emojiOpen, setEmojiOpen] = useState(false); const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewsRef = useRef<UploadPreview[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingRef = useRef(0);
  const replacePreviews = (next: UploadPreview[]) => { previewsRef.current = next; setPreviews(next); }; const patchPreview = (id: string, patch: Partial<UploadPreview>) => replacePreviews(previewsRef.current.map((preview) => preview.id === id ? { ...preview, ...patch } : preview));
  const stopTyping = () => { if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); typingTimerRef.current = null; lastTypingRef.current = 0; onTypingStop(); };
  const notifyTyping = (value: string) => { if (!value.trim()) { stopTyping(); return; } const now = Date.now(); if (now - lastTypingRef.current > 1400) { onTypingStart(); lastTypingRef.current = now; } if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); typingTimerRef.current = window.setTimeout(stopTyping, 2400); };
  const focusComposer = () => {
    const node = textareaRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      const cursor = node.value.length;
      try { node.setSelectionRange(cursor, cursor); } catch { /* some browsers reject selection on empty */ }
    });
  };
  useEffect(() => { controllersRef.current.forEach((controller) => controller.abort()); controllersRef.current.clear(); previewsRef.current.forEach((preview) => { if (preview.attachment) void directAttachmentUploadService.removePending(preview.attachment); fileService.revoke(preview); }); replacePreviews([]); stopTyping(); setBody(messageDraftService.getDraft({ directConversationId: conversation.id })?.text ?? ""); setEmojiOpen(false); setError(null); onCancelReply(); focusComposer(); }, [conversation.id]);
  useEffect(() => () => { controllersRef.current.forEach((controller) => controller.abort()); previewsRef.current.forEach((preview) => fileService.revoke(preview)); stopTyping(); }, []);
  const updateBody = (value: string) => { setBody(value); setError(null); messageDraftService.setDraft({ directConversationId: conversation.id }, value); notifyTyping(value); };
  const addFiles = (files: FileList | File[]) => { const available = Math.max(0, 4 - previewsRef.current.length); if (!available) { onNotice(t("composer.tooManyFiles"), "error"); return; } const added: UploadPreview[] = []; for (const file of Array.from(files).slice(0, available)) { const validation = directAttachmentUploadService.validateFile(file); if (!validation.ok) { onNotice(validation.reason, "error"); continue; } added.push({ ...fileService.createPreview(file), status: "pending", progress: 0 }); } replacePreviews([...previewsRef.current, ...added]); };
  const upload = async (preview: UploadPreview): Promise<DirectMessageAttachment | null> => { if (preview.status === "uploaded" && preview.attachment) return preview.attachment; const controller = new AbortController(); controllersRef.current.set(preview.id, controller); patchPreview(preview.id, { status: "uploading", progress: 5, error: undefined }); const result = await directAttachmentUploadService.upload({ conversationId: conversation.id, file: preview.file, previewUrl: preview.url, signal: controller.signal, onProgress: ({ percent }) => patchPreview(preview.id, { status: "uploading", progress: percent }) }); controllersRef.current.delete(preview.id); if (!result.ok) { patchPreview(preview.id, { status: result.error.code === "UPLOAD_CANCELED" ? "canceled" : "failed", progress: 0, error: result.error.message }); return null; } patchPreview(preview.id, { status: "uploaded", progress: 100, attachment: result.data, error: undefined }); return result.data; };
  const removePreview = async (preview: UploadPreview) => { controllersRef.current.get(preview.id)?.abort(); controllersRef.current.delete(preview.id); if (preview.attachment) await directAttachmentUploadService.removePending(preview.attachment); fileService.revoke(preview); replacePreviews(previewsRef.current.filter((item) => item.id !== preview.id)); };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending || (!body.trim() && !previewsRef.current.length)) return;
    setSending(true);
    setError(null);
    const attachments: DirectMessageAttachment[] = [];
    for (const preview of previewsRef.current) {
      const attachment = await upload(preview);
      if (!attachment) {
        setSending(false);
        setError(t("composer.fixUpload"));
        focusComposer();
        return;
      }
      attachments.push(attachment);
    }
    const value = body.trim() || t("composer.sharedMedia", { count: attachments.length });
    const sent = await onSendMessage(conversation.id, value, attachments, replyTo?.id);
    setSending(false);
    if (!sent) {
      setError(t("composer.sendFailed"));
      focusComposer();
      return;
    }
    messageDraftService.clearDraft({ directConversationId: conversation.id });
    stopTyping();
    onCancelReply();
    previewsRef.current.forEach((preview) => fileService.revoke(preview));
    replacePreviews([]);
    setBody("");
    setEmojiOpen(false);
    focusComposer();
  };
  return <form className={`direct-composer ${dragging ? "dragging" : ""}`} onSubmit={(event) => void submit(event)} aria-busy={sending} onDragOver={(event) => { if (!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
    {replyTo ? (
      <div className="direct-composer-reply">
        <span className="direct-composer-reply-label">{t("composer.replyingTo", { name: replyTo.authorId === conversation.participantUserId ? participantName : t("composer.yourself") })}</span>
        <span className="direct-composer-reply-body">{replyTo.deletedAt ? t("message.deleted") : replyTo.body || t("composer.attachment")}</span>
        <button type="button" aria-label={t("composer.cancelReply")} onClick={onCancelReply}><AppIcon name="close" size="xs" /></button>
      </div>
    ) : null}
    {previews.length ? <div className="direct-upload-previews">{previews.map((preview) => <div key={preview.id} className={`direct-upload-preview status-${preview.status}`}>{preview.file.type.startsWith("video/") ? <video src={preview.url} muted preload="metadata" aria-label={preview.name} /> : <img src={preview.url} alt={preview.name} />}<div><strong>{preview.name}</strong><progress max={100} value={preview.progress} /><small>{preview.error ?? (preview.status === "uploaded" ? t("composer.uploadReady") : preview.status === "uploading" ? t("composer.uploading", { percent: preview.progress }) : preview.status)}</small></div>{preview.status === "uploading" ? <button type="button" onClick={() => { controllersRef.current.get(preview.id)?.abort(); patchPreview(preview.id, { status: "canceled", progress: 0, error: t("composer.uploadCanceled") }); }}>{t("composer.cancelUpload")}</button> : preview.status === "failed" || preview.status === "canceled" ? <><button type="button" onClick={() => void upload({ ...preview, status: "pending", progress: 0 })}>{t("action.retry")}</button><button type="button" aria-label={t("attachment.remove", { name: preview.name })} onClick={() => void removePreview(preview)}><AppIcon name="trash" size="xs" /></button></> : <button type="button" aria-label={t("attachment.remove", { name: preview.name })} onClick={() => void removePreview(preview)}><AppIcon name="close" size="xs" /></button>}</div>)}</div> : null}
    <div className="direct-composer-bar">
      <input ref={fileInputRef} className="direct-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={(event) => { if (event.target.files?.length) addFiles(event.target.files); event.target.value = ""; }} />
      <button type="button" className="direct-composer-tool" aria-label={t("composer.attach")} title={t("composer.attach")} disabled={sending} onClick={() => fileInputRef.current?.click()}><AppIcon name="paperclip" size="sm" /></button>
      <textarea
        ref={textareaRef}
        value={body}
        readOnly={sending}
        onChange={(event) => updateBody(event.target.value)}
        onBlur={stopTyping}
        onPaste={(event) => {
          if (sending) return;
          const files = Array.from(event.clipboardData.files);
          if (!files.length) return;
          event.preventDefault();
          addFiles(files);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={t("composer.placeholder", { name: participantName })}
        rows={1}
        maxLength={4000}
        aria-label={t("composer.placeholder", { name: participantName })}
      />
      <div className="direct-composer-tools">
        <button type="button" className="direct-composer-tool" aria-label={t("composer.emoji")} title={t("composer.emoji")} disabled={sending} onClick={() => setEmojiOpen((open) => !open)}><AppIcon name="smile" size="sm" /></button>
        <button type="submit" className="direct-send" aria-label={t("composer.send")} disabled={sending || (!body.trim() && !previews.length)}><AppIcon name="send" size="sm" /></button>
      </div>
    </div>
    {emojiOpen ? <EmojiPicker className="direct-composer-emoji-picker" label={t("composer.emojiPickerLabel")} mode="composer" onClose={() => setEmojiOpen(false)} onSelect={(emoji) => { updateBody(`${body}${emoji}`); setEmojiOpen(false); focusComposer(); }} /> : null}
    {dragging ? <span className="direct-drop-hint"><AppIcon name="image" size="sm" />{t("composer.dropHint")}</span> : null}
    {error ? <span className="direct-composer-error" role="alert">{error}</span> : null}
  </form>;
}

export function DirectChatMain({ conversation, currentUserId, typingNames, calls, activeCall, callRuntime, detailsOpen, onDetailsToggle, onBack, onOpenProfile, onPreview, onSendMessage, onEditMessage, onDeleteMessage, onToggleReaction, onReportMessage, onRemoveFailedMessage, onTypingStart, onTypingStop, onNotice, onStartCall, onJoinCall, onToggleCallMute, onToggleCallCamera, onToggleCallScreenShare, onEndCall, onMarkCallsRead, onDismissCall, onDeleteConversation }: { conversation?: DirectConversation; currentUserId: string; typingNames: string[]; calls: readonly DmCall[]; activeCall?: DmCall; callRuntime: DmCallRuntimeState; detailsOpen: boolean; onDetailsToggle: () => void; onBack: () => void; onOpenProfile: (userId: string) => void; onPreview: (attachment: Attachment) => void; onSendMessage: SendDirectMessage; onEditMessage: DirectMessagesViewProps["onEditMessage"]; onDeleteMessage: DirectMessagesViewProps["onDeleteMessage"]; onToggleReaction: DirectMessagesViewProps["onToggleReaction"]; onReportMessage: DirectMessagesViewProps["onReportMessage"]; onRemoveFailedMessage: DirectMessagesViewProps["onRemoveFailedMessage"]; onTypingStart: () => void; onTypingStop: () => void; onNotice: DirectMessagesViewProps["onNotice"]; onStartCall: DirectMessagesViewProps["onStartCall"]; onJoinCall: DirectMessagesViewProps["onJoinCall"]; onToggleCallMute: DirectMessagesViewProps["onToggleCallMute"]; onToggleCallCamera: DirectMessagesViewProps["onToggleCallCamera"]; onToggleCallScreenShare: DirectMessagesViewProps["onToggleCallScreenShare"]; onEndCall: DirectMessagesViewProps["onEndCall"]; onMarkCallsRead: () => void; onDismissCall: (callId: string) => Promise<boolean>; onDeleteConversation: DirectMessagesViewProps["onDeleteConversation"] }) {
  const { t } = useTranslation("messaging");
  const [searchOpen, setSearchOpen] = useState(false); const [searchQuery, setSearchQuery] = useState(""); const [replyTo, setReplyTo] = useState<DirectMessage | undefined>();
  useEffect(() => { setSearchOpen(false); setSearchQuery(""); setReplyTo(undefined); }, [conversation?.id]);
  if (!conversation) return <main className="direct-chat-panel"><div className="direct-chat-empty"><AppIcon name="inbox" size="xl" /><strong>{t("chat.emptyTitle")}</strong><p>{t("chat.emptyBody")}</p></div></main>;
  const peerIdentity = getConversationIdentity(conversation);
  const peer: DmCallPeer = { id: conversation.participantUserId, name: peerIdentity.displayName, avatarUrl: peerIdentity.avatarUrl };
  const startCall = (type: DmCallType, screenShare?: boolean) => onStartCall(conversation.id, peer, type, screenShare);
  return <main className={`direct-chat-panel${activeCall?.callType === "video" && callRuntime.connected ? " is-video-call" : ""}`}>
    <DirectChatHeader conversation={conversation} call={activeCall} callRuntime={callRuntime} searchOpen={searchOpen} searchQuery={searchQuery} detailsOpen={detailsOpen} onSearchOpen={() => { setSearchOpen((open) => !open); if (searchOpen) setSearchQuery(""); }} onSearchChange={setSearchQuery} onDetailsToggle={onDetailsToggle} onBack={onBack} onOpenProfile={onOpenProfile} onStartCall={startCall} onJoinCall={() => activeCall && onJoinCall(activeCall, peer)} onToggleCallMute={onToggleCallMute} onToggleCallCamera={onToggleCallCamera} onToggleCallScreenShare={onToggleCallScreenShare} onEndCall={() => activeCall && onEndCall(activeCall)} onDeleteConversation={() => onDeleteConversation(conversation.id)} />
    {activeCall?.callType === "video" && callRuntime.connected ? <section className="direct-chat-video-pane" aria-label={t("chat.videoPaneAria", { name: peer.name })}><DmCallVideoStage currentUserId={currentUserId} peer={peer} runtime={callRuntime} /></section> : null}
    <div className="direct-chat-body"><DirectMessageList conversation={conversation} currentUserId={currentUserId} query={searchQuery} typingNames={typingNames} calls={calls} activeCall={activeCall} onOpenProfile={onOpenProfile} onPreview={onPreview} onReply={setReplyTo} onEdit={onEditMessage} onDelete={onDeleteMessage} onToggleReaction={onToggleReaction} onReport={(message) => onReportMessage(message, conversation)} onRetry={(message) => onSendMessage(conversation.id, message.body, message.attachments, message.replyToMessageId, message.clientMessageId)} onRemoveFailed={onRemoveFailedMessage} onNotice={onNotice} onStartCall={(type) => startCall(type)} onMarkCallsRead={onMarkCallsRead} onDismissCall={onDismissCall} /></div>
    <div className="direct-chat-footer"><DirectMessageComposer conversation={conversation} replyTo={replyTo} onCancelReply={() => setReplyTo(undefined)} onSendMessage={onSendMessage} onTypingStart={onTypingStart} onTypingStop={onTypingStop} onNotice={onNotice} /></div>
  </main>;
}

const dmDetailsContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};

const dmDetailsItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32, mass: 0.75 } },
};

const dmMuteDurations: DirectMuteDuration[] = ["one_hour", "eight_hours", "one_day", "until_changed"];

function SharedMediaThumb({ media, index, reduceMotion, onPreview }: {
  media: DirectMessageAttachment;
  index: number;
  reduceMotion: boolean | null;
  onPreview: (attachment: Attachment) => void;
}) {
  const { t } = useTranslation("messaging");
  const [broken, setBroken] = useState(false);
  const canShowImage = media.type === "image" && !broken && isRenderableDirectAttachmentUrl(media.url);

  if (media.type === "video") {
    if (!isRenderableDirectAttachmentUrl(media.url)) {
      return (
        <div key={media.id} className="dm-shared-media-fallback" title={media.name} aria-label={media.name}>
          <AppIcon name="image" size="sm" />
        </div>
      );
    }
    return <video key={media.id} src={media.url} controls preload="metadata" aria-label={media.name} />;
  }

  if (media.type !== "image") return null;

  return (
    <motion.button
      key={media.id}
      type="button"
      aria-label={t("attachment.preview", { name: media.name })}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: reduceMotion ? 0 : 0.04 * index, type: "spring", stiffness: 460, damping: 30 }}
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={() => onPreview(toPreviewAttachment(media))}
    >
      {canShowImage ? (
        <img src={media.url} alt={media.name} onError={() => setBroken(true)} />
      ) : (
        <span className="dm-shared-media-fallback" title={media.name}>
          <AppIcon name="image" size="sm" />
        </span>
      )}
    </motion.button>
  );
}

export function DMDetailsPanel({ conversation, open, onOpenProfile, onOpenCommunity, onPreview, onClose, onSetMuted, onDeleteConversation, onBlockUser, onReportUser, onNotice }: { conversation?: DirectConversation; open?: boolean; onOpenProfile: (userId: string) => void; onOpenCommunity: (communityId: string) => void; onPreview: (attachment: Attachment) => void; onClose: () => void; onSetMuted: DirectMessagesViewProps["onSetMuted"]; onDeleteConversation: DirectMessagesViewProps["onDeleteConversation"]; onBlockUser: DirectMessagesViewProps["onBlockUser"]; onReportUser: DirectMessagesViewProps["onReportUser"]; onNotice: DirectMessagesViewProps["onNotice"] }) {
  const { t } = useTranslation("messaging");
  const reduceMotion = useReducedMotion();
  const participantName = useProfileDisplayName(conversation?.participantUserId, conversation?.participantName ?? t("details.thisUser"));
  const [muted, setMuted] = useState(Boolean(conversation?.muted));
  const [muteDuration, setMuteDuration] = useState<DirectMuteDuration>("one_hour");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMuted(Boolean(conversation?.muted)); setConfirmBlock(false); setConfirmDelete(false); }, [conversation?.id, conversation?.muted]);

  if (!conversation) {
    return (
      <aside className="dm-details-panel dm-details-panel--empty" aria-label={t("details.aria")}>
        <div className="direct-list-empty">
          <AppIcon name="user" size="xl" />
          <strong>{t("details.emptyTitle")}</strong>
          <span>{t("details.emptyBody")}</span>
        </div>
      </aside>
    );
  }

  const verification = getUserVerificationSummary(conversation.participantUserId);
  const mutualCount = conversation.mutualCommunities?.length ?? 0;
  const mediaCount = conversation.sharedMedia?.length ?? 0;
  const sharedMedia = conversation.sharedMedia?.slice(0, 6) ?? [];

  const saveMute = async (mutedUntil: string | null) => {
    setSaving(true);
    const saved = await onSetMuted(conversation.id, mutedUntil);
    setSaving(false);
    if (saved) {
      const nextMuted = Boolean(mutedUntil);
      setMuted(nextMuted);
      onNotice(nextMuted ? t("details.mutedNotice") : t("details.unmutedNotice"), "success");
    }
  };

  const block = async () => {
    setSaving(true);
    const saved = await onBlockUser(conversation.participantUserId);
    setSaving(false);
    if (saved) setConfirmBlock(false);
  };

  const deleteChat = async () => {
    setSaving(true);
    const saved = await onDeleteConversation(conversation.id);
    setSaving(false);
    if (saved) setConfirmDelete(false);
  };

  return (
    <motion.aside
      className="dm-details-panel"
      aria-label={t("details.aria")}
      aria-hidden={open === false ? true : undefined}
      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
    >
      <button type="button" className="dm-details-close icon-button" aria-label={t("details.close")} onClick={onClose}>
        <AppIcon name="close" size="sm" />
      </button>

      <motion.div
        key={conversation.id}
        className="dm-details-scroll"
        variants={dmDetailsContainerVariants}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <motion.section className="dm-profile-hero" variants={dmDetailsItemVariants}>
          <button type="button" className="dm-profile-hero-main" onClick={() => onOpenProfile(conversation.participantUserId)}>
            <DirectAvatar conversation={conversation} compact />
            <div className="dm-profile-hero-copy">
              <h2 className="dm-profile-name">
                <ProfileDisplayName userId={conversation.participantUserId} fallback={conversation.participantName} />
                <VerifiedBadge userId={conversation.participantUserId} verification={verification} size="sm" />
              </h2>
              <span className="dm-profile-handle">@<ProfileUsername userId={conversation.participantUserId} fallback={conversation.participantUsername} /></span>
            </div>
            <AppIcon name="chevronRight" size="sm" aria-hidden="true" />
          </button>
        </motion.section>

        <motion.section className="dm-detail-card" variants={dmDetailsItemVariants} aria-labelledby="dm-mutual-heading">
          <header className="dm-detail-card-header">
            <span className="dm-detail-card-title" id="dm-mutual-heading">
              <AppIcon name="users" size="sm" />
              {t("details.mutualCommunities")}
            </span>
            <span className="dm-detail-count">{mutualCount}</span>
          </header>
          {mutualCount ? (
            <div className="dm-mutual-list">
              {conversation.mutualCommunities!.map((community) => (
                <motion.button
                  key={community.id}
                  type="button"
                  whileHover={reduceMotion ? undefined : { x: 2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                  onClick={() => onOpenCommunity(community.id)}
                >
                  <span className="dm-mutual-avatar">{community.name.slice(0, 1)}</span>
                  <strong>{community.name}</strong>
                  <AppIcon name="chevronRight" size="xs" />
                </motion.button>
              ))}
            </div>
          ) : (
            <p className="dm-detail-empty">{t("details.noMutual")}</p>
          )}
        </motion.section>

        <motion.section className="dm-detail-card" variants={dmDetailsItemVariants} aria-labelledby="dm-media-heading">
          <header className="dm-detail-card-header">
            <span className="dm-detail-card-title" id="dm-media-heading">
              <AppIcon name="image" size="sm" />
              {t("details.sharedMedia")}
            </span>
            <span className="dm-detail-count">{mediaCount}</span>
          </header>
          {mediaCount ? (
            <div className="dm-shared-media">
              {sharedMedia.map((media, index) => (
                <SharedMediaThumb
                  key={media.id}
                  media={media}
                  index={index}
                  reduceMotion={reduceMotion}
                  onPreview={onPreview}
                />
              ))}
            </div>
          ) : (
            <p className="dm-detail-empty">{t("details.noMedia")}</p>
          )}
        </motion.section>

        <motion.section className="dm-detail-card dm-privacy-card" variants={dmDetailsItemVariants} aria-labelledby="dm-privacy-heading">
          <header className="dm-detail-card-header">
            <span className="dm-detail-card-title" id="dm-privacy-heading">
              <AppIcon name="lock" size="sm" />
              {t("details.privacySafety")}
            </span>
          </header>

          {muted ? (
            <button type="button" className="dm-action-row active" disabled={saving} onClick={() => void saveMute(null)}>
              <span className="dm-action-icon"><AppIcon name="bell" size="sm" /></span>
              <span className="dm-action-copy"><strong>{t("details.unmute")}</strong><small>{t("details.unmuteHint")}</small></span>
            </button>
          ) : (
            <div className="dm-mute-panel">
              <span className="dm-mute-label">{t("details.mute")}</span>
              <div className="dm-mute-options" role="group" aria-label={t("details.muteDurationAria")}>
                {dmMuteDurations.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    className={muteDuration === duration ? "selected" : ""}
                    aria-pressed={muteDuration === duration}
                    onClick={() => setMuteDuration(duration)}
                  >
                    {directMuteDurationLabels[duration]}
                  </button>
                ))}
              </div>
              <button type="button" className="dm-mute-apply" disabled={saving} onClick={() => void saveMute(getDirectMutedUntil(muteDuration))}>
                <AppIcon name="bell" size="sm" />
                {t("details.applyMute")}
              </button>
            </div>
          )}

          <div className="dm-action-list">
            <AnimatePresence initial={false}>
              {confirmDelete ? (
                <motion.div
                  className="dm-block-confirm"
                  role="alertdialog"
                  aria-label={t("details.deleteChatAria", { name: participantName })}
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <strong>{t("details.deleteChatTitle", { name: participantName })}</strong>
                  <p>{t("details.deleteChatBody")}</p>
                  <div>
                    <button type="button" disabled={saving} onClick={() => setConfirmDelete(false)}>{t("action.cancel")}</button>
                    <button type="button" disabled={saving} className="danger" onClick={() => void deleteChat()}>{t("details.deleteChat")}</button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="delete-chat"
                  type="button"
                  className="dm-action-row danger"
                  disabled={saving}
                  initial={false}
                  animate={{ opacity: 1 }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <span className="dm-action-icon"><AppIcon name="trash" size="sm" /></span>
                  <span className="dm-action-copy"><strong>{t("details.deleteChat")}</strong><small>{t("details.deleteChatHint")}</small></span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {confirmBlock ? (
                <motion.div
                  className="dm-block-confirm"
                  role="alertdialog"
                  aria-label={t("details.blockAria", { name: participantName })}
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <strong>{t("details.blockTitle", { name: participantName })}</strong>
                  <p>{t("details.blockBody")}</p>
                  <div>
                    <button type="button" disabled={saving} onClick={() => setConfirmBlock(false)}>{t("action.cancel")}</button>
                    <button type="button" disabled={saving} className="danger" onClick={() => void block()}>{t("details.confirmBlock")}</button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="block"
                  type="button"
                  className="dm-action-row"
                  disabled={saving}
                  initial={false}
                  animate={{ opacity: 1 }}
                  onClick={() => setConfirmBlock(true)}
                >
                  <span className="dm-action-icon"><AppIcon name="lock" size="sm" /></span>
                  <span className="dm-action-copy"><strong>{t("details.blockUser")}</strong><small>{t("details.blockUserHint")}</small></span>
                </motion.button>
              )}
            </AnimatePresence>

            <button type="button" className="dm-action-row danger" onClick={() => onReportUser(conversation.participantUserId, conversation.id)}>
              <span className="dm-action-icon"><AppIcon name="more" size="sm" /></span>
              <span className="dm-action-copy"><strong>{t("details.reportUser")}</strong><small>{t("details.reportUserHint")}</small></span>
            </button>
          </div>
        </motion.section>
      </motion.div>
    </motion.aside>
  );
}

export function DirectMessagesView(props: DirectMessagesViewProps) {
  const { t } = useTranslation("messaging");
  const activeConversation = props.conversations.find((conversation) => conversation.id === props.activeConversationId); const [detailsOpen, setDetailsOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1321px)").matches); const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const callInformation = useDmCallInformation(props.currentUserId, Boolean(props.currentUserId), props.activeConversationId);
  const typing = useDirectTypingBroadcast({ enabled: Boolean(activeConversation), conversationId: activeConversation?.id ?? "", currentUserId: props.currentUserId, displayName: props.currentUserDisplayName });
  const conversationCalls = useMemo(() => {
    const base = callInformation.calls.filter((call) => call.conversationId === activeConversation?.id);
    const live = props.activeDirectCall;
    if (!live || live.conversationId !== activeConversation?.id) return base;
    if (live.status !== "ringing" && live.status !== "active") return base;
    return [live, ...base.filter((call) => call.id !== live.id)]
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  }, [activeConversation?.id, callInformation.calls, props.activeDirectCall]);
  const activeCall = conversationCalls.find((call) => call.status === "ringing" || call.status === "active");
  const sidebarCalls = useMemo(() => {
    const live = props.activeDirectCall;
    if (!live || (live.status !== "ringing" && live.status !== "active")) return callInformation.calls;
    return [live, ...callInformation.calls.filter((call) => call.id !== live.id)];
  }, [callInformation.calls, props.activeDirectCall]);
  useEffect(() => { if (typeof window === "undefined") return; const media = window.matchMedia("(min-width: 1321px)"); const sync = () => setDetailsOpen(media.matches); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  useEffect(() => { if (typeof window !== "undefined") setDetailsOpen(window.matchMedia("(min-width: 1321px)").matches); }, [props.activeConversationId]);
  useEffect(() => { if (activeConversation?.id) void callInformation.markConversationRead(activeConversation.id); }, [activeConversation?.id, callInformation.markConversationRead]);
  return <><section className={`direct-messages-view ${detailsOpen ? "details-open" : ""}`} aria-label={t("view.aria")}>
    <DirectMessagesSidebar conversations={props.conversations} calls={sidebarCalls} activeConversationId={props.activeConversationId} friendRequestCount={props.friendRequestCount} onSelectConversation={props.onSelectConversation} onOpenFriends={props.onOpenFriends} onOpenPendingFriends={props.onOpenPendingFriends} onDeleteConversation={props.onDeleteConversation} />
    <DirectChatMain conversation={activeConversation} currentUserId={props.currentUserId} typingNames={typing.typingNames} calls={conversationCalls} activeCall={activeCall} callRuntime={props.callRuntime} detailsOpen={detailsOpen} onDetailsToggle={() => setDetailsOpen((open) => !open)} onBack={props.onBackToCommunity} onOpenProfile={props.onOpenProfile} onPreview={setPreviewAttachment} onSendMessage={props.onSendMessage} onEditMessage={props.onEditMessage} onDeleteMessage={props.onDeleteMessage} onToggleReaction={props.onToggleReaction} onReportMessage={props.onReportMessage} onRemoveFailedMessage={props.onRemoveFailedMessage} onTypingStart={typing.sendTypingStart} onTypingStop={typing.sendTypingStop} onNotice={props.onNotice} onStartCall={props.onStartCall} onJoinCall={props.onJoinCall} onToggleCallMute={props.onToggleCallMute} onToggleCallCamera={props.onToggleCallCamera} onToggleCallScreenShare={props.onToggleCallScreenShare} onEndCall={props.onEndCall} onMarkCallsRead={() => activeConversation?.id && void callInformation.markConversationRead(activeConversation.id)} onDismissCall={async (callId) => { const error = await callInformation.dismissCall(callId); if (error) { props.onNotice(error, "error"); return false; } props.onNotice(t("view.callRemoved"), "success"); return true; }} onDeleteConversation={props.onDeleteConversation} />
    <DMDetailsPanel conversation={activeConversation} open={detailsOpen} onOpenProfile={props.onOpenProfile} onOpenCommunity={props.onOpenCommunity} onPreview={setPreviewAttachment} onClose={() => setDetailsOpen(false)} onSetMuted={props.onSetMuted} onDeleteConversation={props.onDeleteConversation} onBlockUser={props.onBlockUser} onReportUser={props.onReportUser} onNotice={props.onNotice} />
  </section>{previewAttachment ? <ImagePreviewModal image={previewAttachment} onClose={() => setPreviewAttachment(null)} /> : null}</>;
}
