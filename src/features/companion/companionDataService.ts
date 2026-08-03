import { authService } from "../../services/authService";
import { channelService } from "../../services/channelService";
import { communityService } from "../../services/communityService";
import { directMessageService } from "../../services/directMessages/directMessageService";
import { directRealtimeService } from "../../services/directMessages/directRealtimeService";
import { dmCallService } from "../../services/directMessages/dmCallService";
import { friendPresenceService } from "../../services/friends/friendPresenceService";
import { friendRequestService } from "../../services/friends/friendRequestService";
import { liveKitService } from "../../services/livekit/livekitService";
import { messageService } from "../../services/messageService";
import { messageDraftService } from "../../services/messageDraftService";
import { profileService } from "../../services/profileService";
import { profileMediaResolver } from "../../services/profileMedia/profileMediaResolver";
import { voiceCallInviteService } from "../../services/voice/voiceCallInviteService";
import { voiceService, type VoiceServiceSnapshot, type VoiceTokenResponse } from "../../services/voiceService";
import type { DmCall, DmCallType } from "../../types/dmCalls";
import type { DirectConversation, DirectMessage, DirectMessageAttachment } from "../../types/directMessages";
import type { CommunitySummary } from "../../services/communityService";
import type { ChannelSummary } from "../../services/channelService";
import type { MessageSummary } from "../../services/messageService";
import type { CompanionCommunity, CompanionHomeSnapshot, CompanionPerson, CompanionVoiceRoom } from "./companionTypes";

type UnknownRecord = Record<string, unknown>;
type Community = CommunitySummary;
type Channel = ChannelSummary;
type CommunityMessage = MessageSummary;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function avatarUrl(value: unknown): string | undefined {
  const source = record(value);
  const avatar = record(source.avatar);
  const candidates = [
    source.avatarUrl,
    source.avatar_url,
    source.participantAvatarUrl,
    source.participant_avatar_url,
    source.friendAvatarUrl,
    source.friend_avatar_url,
    source.userAvatarUrl,
    source.user_avatar_url,
    avatar.thumbnailUrl,
    avatar.thumbnail_url,
    avatar.url,
    source.thumbnailUrl,
    source.thumbnail_url,
    source.url,
  ];
  const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof match === "string" ? match.trim() : undefined;
}

function identityKey(value: unknown): string {
  return text(value).toLowerCase();
}

function bool(value: unknown): boolean {
  return value === true;
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function userRecord(value: unknown): UnknownRecord {
  const source = record(value);
  return record(source.friend ?? source.peer ?? source.profile ?? source.user ?? source.participant ?? source.otherParticipant ?? source);
}

function currentUserIdentity(value: unknown): CompanionHomeSnapshot["currentUser"] {
  const source = record(value);
  const metadata = record(source.user_metadata);
  const email = text(source.email);
  const userId = text(source.id);
  if (!userId) return null;
  const displayName = text(metadata.display_name ?? metadata.full_name ?? source.displayName, email.split("@")[0] || "Picom user");
  return Object.freeze({ userId, displayName, username: text(metadata.username ?? source.username, email ? `@${email.split("@")[0]}` : "@picom") });
}

function conversationPeer(conversation: unknown): UnknownRecord {
  const source = record(conversation);
  if (typeof source.participantUserId === "string") {
    return {
      id: source.participantUserId,
      displayName: source.participantName,
      username: source.participantUsername,
      avatarUrl: avatarUrl(source) ?? avatarUrl(source.otherParticipant ?? source.participant),
      status: source.participantStatus,
    };
  }
  return userRecord(source.otherParticipant ?? source.recipient ?? source.peer ?? source.participant ?? source.participants);
}

function conversationId(conversation: unknown): string | undefined {
  return text(record(conversation).id) || undefined;
}

function toCompanionStatus(value: unknown): CompanionPerson["status"] {
  const status = text(value, "offline").toLowerCase();
  if (status === "online" || status === "idle") return status;
  // friend_presence / UserStatus use "dnd"; CompanionPerson uses "busy".
  if (status === "busy" || status === "dnd") return "busy";
  return "offline";
}

function normalizePresence(value: unknown): ReadonlyMap<string, CompanionPerson["status"]> {
  const result = new Map<string, CompanionPerson["status"]>();
  const rank: Record<CompanionPerson["status"], number> = { offline: 0, idle: 1, busy: 2, online: 3 };
  const set = (id: string, rawStatus: unknown) => {
    const key = identityKey(id);
    if (!key) return;
    const next = toCompanionStatus(rawStatus);
    const current = result.get(key);
    if (!current || rank[next] >= rank[current]) result.set(key, next);
  };
  if (value instanceof Map) {
    value.forEach((presence, id) => set(String(id), record(presence).status ?? presence));
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((presence) => {
      const item = record(presence);
      const id = text(item.userId ?? item.user_id ?? item.id);
      if (id) set(id, item.status);
    });
    return result;
  }
  Object.entries(record(value)).forEach(([id, presence]) => set(id, record(presence).status ?? presence));
  return result;
}

function acceptedFriendItems(state: unknown): readonly unknown[] {
  const source = record(state);
  const candidates = [source.friends, source.connections, source.accepted, source.acceptedFriends];
  return candidates.find(Array.isArray) as readonly unknown[] | undefined ?? [];
}

function peopleFromState(state: unknown, conversations: readonly unknown[], presence: ReadonlyMap<string, CompanionPerson["status"]>): readonly CompanionPerson[] {
  const byUser = new Map<string, CompanionPerson>();
  const unreadByUser = new Map<string, number>();
  const activityByUser = new Map<string, string>();
  const previewByUser = new Map<string, string>();
  for (const conversation of conversations) {
    const source = record(conversation);
    const peer = conversationPeer(conversation);
    const userId = text(peer.id ?? peer.userId ?? peer.user_id ?? source.participantUserId);
    if (!userId) continue;
    const key = identityKey(userId);
    unreadByUser.set(key, Number(source.unreadCount ?? 0) || 0);
    const activity = text(source.participantStatusText ?? peer.statusText);
    if (activity) activityByUser.set(key, activity);
    const preview = text(source.lastMessagePreview);
    if (preview) previewByUser.set(key, preview);
  }
  for (const item of acceptedFriendItems(state)) {
    const source = record(item);
    const user = userRecord(item);
    const userId = text(user.userId ?? user.user_id ?? source.friendId ?? source.friend_id ?? source.userId ?? source.user_id ?? user.id);
    if (!userId) continue;
    const key = identityKey(userId);
    const friendStatus = toCompanionStatus(source.status ?? user.status);
    byUser.set(key, Object.freeze({
      userId,
      displayName: text(user.displayName ?? user.display_name ?? user.full_name ?? user.username, "Picom user"),
      username: text(user.username, `@${userId.slice(0, 8)}`),
      avatarUrl: avatarUrl(user) ?? avatarUrl(source),
      status: presence.get(key) ?? friendStatus,
      favorite: bool(source.favorite ?? source.isFavorite ?? source.is_favorite),
      unreadCount: unreadByUser.get(key) ?? 0,
      activityLabel: activityByUser.get(key),
      lastMessagePreview: previewByUser.get(key),
    }));
  }
  for (const conversation of conversations) {
    const source = record(conversation);
    const peer = conversationPeer(conversation);
    const userId = text(peer.id ?? peer.userId ?? peer.user_id);
    const id = conversationId(conversation);
    if (!userId || !id) continue;
    const key = identityKey(userId);
    const existing = byUser.get(key);
    const conversationStatus = toCompanionStatus(source.participantStatus ?? peer.status);
    byUser.set(key, Object.freeze({
      userId,
      displayName: existing?.displayName ?? text(peer.displayName ?? peer.display_name ?? peer.username, "Picom user"),
      username: existing?.username ?? text(peer.username, `@${userId.slice(0, 8)}`),
      avatarUrl: existing?.avatarUrl ?? avatarUrl(peer),
      // Live presence map wins; otherwise keep friend/DM inbox status (not forced offline).
      status: presence.get(key) ?? existing?.status ?? conversationStatus,
      favorite: existing?.favorite ?? false,
      conversationId: id,
      unreadCount: unreadByUser.get(key) ?? existing?.unreadCount ?? 0,
      activityLabel: activityByUser.get(key) ?? existing?.activityLabel,
      lastMessagePreview: previewByUser.get(key) ?? existing?.lastMessagePreview,
    }));
  }
  const statusOrder = { online: 0, idle: 1, busy: 2, offline: 3 } as const;
  const uniquePeople = new Map<string, CompanionPerson>();
  for (const person of byUser.values()) {
    const key = identityKey(person.username) || identityKey(person.userId);
    const existing = uniquePeople.get(key);
    if (!existing) {
      uniquePeople.set(key, person);
      continue;
    }
    const preferred = statusOrder[person.status] < statusOrder[existing.status] ? person : existing;
    uniquePeople.set(key, Object.freeze({
      ...preferred,
      avatarUrl: preferred.avatarUrl ?? existing.avatarUrl ?? person.avatarUrl,
      conversationId: preferred.conversationId ?? existing.conversationId,
      unreadCount: Math.max(preferred.unreadCount ?? 0, existing.unreadCount ?? 0),
      lastMessagePreview: preferred.lastMessagePreview ?? existing.lastMessagePreview,
    }));
  }
  return [...uniquePeople.values()].sort((left, right) => {
    return Number(right.favorite) - Number(left.favorite)
      || (right.unreadCount ?? 0) - (left.unreadCount ?? 0)
      || statusOrder[left.status] - statusOrder[right.status]
      || left.displayName.localeCompare(right.displayName);
  });
}

async function hydratePeopleProfiles(people: readonly CompanionPerson[]): Promise<readonly CompanionPerson[]> {
  const missingAvatar = people.filter((person) => !person.avatarUrl).slice(0, 32);
  if (!missingAvatar.length) return people;
  const resolved = await Promise.all(missingAvatar.map(async (person) => {
    try {
      const media = await profileMediaResolver.resolve(person.userId);
      const mediaAvatar = media?.avatar.thumbnailUrl ?? media?.avatar.url ?? media?.avatar.legacyUrl;
      if (mediaAvatar) return [identityKey(person.userId), mediaAvatar] as const;
      const result = await profileService.getProfileById(person.userId);
      return result.ok && result.data?.avatarUrl ? [identityKey(person.userId), result.data.avatarUrl] as const : null;
    } catch {
      return null;
    }
  }));
  const avatars = new Map(resolved.filter((item): item is readonly [string, string] => Boolean(item)));
  if (!avatars.size) return people;
  return people.map((person) => {
    const avatar = avatars.get(identityKey(person.userId));
    return avatar ? Object.freeze({ ...person, avatarUrl: avatar }) : person;
  });
}
function unwrapResult<T>(result: unknown): T {
  const source = record(result);
  if (source.ok === false) {
    const error = record(source.error);
    throw new Error(text(error.userMessage ?? error.message, "The requested Picom service is unavailable."));
  }
  return (source.data ?? source.value ?? result) as T;
}

const companionRequestPromises = new Map<string, Promise<unknown>>();

function shareCompanionRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = companionRequestPromises.get(key);
  if (existing) return existing as Promise<T>;

  let request: Promise<T>;
  request = load().finally(() => {
    if (companionRequestPromises.get(key) === request) companionRequestPromises.delete(key);
  });
  companionRequestPromises.set(key, request);
  return request;
}

function loadCurrentUser(): Promise<unknown> {
  return shareCompanionRequest("companion:current-user", async () => {
    return unwrapResult<unknown>(await authService.getCurrentUser());
  });
}

function loadJoinedCommunities(): Promise<readonly Community[]> {
  return shareCompanionRequest("companion:communities", async () => {
    return unwrapResult<Community[]>(await communityService.listCommunities());
  });
}

function loadCommunityChannels(communityId: string): Promise<readonly Channel[]> {
  return shareCompanionRequest(`companion:channels:${communityId}`, async () => {
    return unwrapResult<Channel[]>(await channelService.listChannels(communityId));
  });
}

function loadDirectConversations(): Promise<readonly DirectConversation[]> {
  return shareCompanionRequest("companion:direct-conversations", async () => {
    return unwrapResult<DirectConversation[]>(await directMessageService.getDirectConversations());
  });
}

function loadDirectMessages(conversationId: string): Promise<readonly DirectMessage[]> {
  return shareCompanionRequest(`companion:direct-messages:${conversationId}`, async () => {
    const page = unwrapResult<Readonly<{ items: readonly DirectMessage[] }>>(
      await directMessageService.getDirectMessagesPage(conversationId, { limit: 40 }),
    );
    return page.items;
  });
}

function loadCommunityMessages(communityId: string, channelId: string): Promise<readonly CommunityMessage[]> {
  return shareCompanionRequest(`companion:community-messages:${communityId}:${channelId}`, async () => {
    return unwrapResult<{ items: CommunityMessage[] }>(await messageService.listMessages({ communityId, channelId })).items;
  });
}

async function loadCompanionCommunityOverview(): Promise<Readonly<{
  communities: readonly CompanionCommunity[];
  voiceRooms: readonly CompanionVoiceRoom[];
}>> {
  try {
    const joined = await loadJoinedCommunities();
    const communities = Object.freeze(joined.map((community) => Object.freeze({
      id: community.id,
      name: community.name,
      description: community.description ?? undefined,
      iconUrl: community.iconUrl ?? undefined,
    })));
    const roomGroups = await Promise.all(joined.slice(0, 12).map(async (community) => {
      const channels = await loadCommunityChannels(community.id);
      return channels.filter((item) => item.type === "voice").slice(0, 3).map((channel) => Object.freeze({
        id: channel.id,
        communityId: community.id,
        name: channel.name,
        communityName: community.name || "Topluluk",
        participantCount: Number(record(channel).memberCount ?? record(channel).participantCount ?? 0) || 0,
      }));
    }));
    return Object.freeze({ communities, voiceRooms: Object.freeze(roomGroups.flat().slice(0, 6)) });
  } catch {
    return Object.freeze({ communities: Object.freeze([]), voiceRooms: Object.freeze([]) });
  }
}

let connectedCallId: string | null = null;
let connectingCall: Readonly<{ key: string; promise: Promise<VoiceServiceSnapshot> }> | null = null;
let callLifecycleGeneration = 0;
const directCallTokenRequests = new Map<string, Promise<VoiceTokenResponse>>();

function directCallTokenKey(conversationId: string, callId: string, callType: DmCallType): string {
  return `${conversationId}:${callId}:${callType}`;
}

function prefetchDirectCallToken(conversationId: string, callId: string, callType: DmCallType): Promise<VoiceTokenResponse> {
  const key = directCallTokenKey(conversationId, callId, callType);
  const existing = directCallTokenRequests.get(key);
  if (existing) return existing;

  const request = liveKitService.fetchDirectToken({ conversationId, callId, intent: callType })
    .then((result) => unwrapResult<VoiceTokenResponse>(result))
    .catch((error: unknown) => {
      if (directCallTokenRequests.get(key) === request) directCallTokenRequests.delete(key);
      throw error;
    });
  directCallTokenRequests.set(key, request);
  globalThis.setTimeout(() => {
    if (directCallTokenRequests.get(key) === request) directCallTokenRequests.delete(key);
  }, 15_000);
  return request;
}

type CompanionMessageListener = (messages: readonly DirectMessage[]) => void;
type CompanionMessageSubscription = {
  listeners: Set<CompanionMessageListener>;
  messages: readonly DirectMessage[];
  realtimeCleanup?: () => void;
  refreshPromise: Promise<void> | null;
  refreshQueued: boolean;
  closed: boolean;
};
const companionMessageSubscriptions = new Map<string, CompanionMessageSubscription>();

export const companionDataService = Object.freeze({
  async listCommunities(): Promise<readonly CompanionCommunity[]> {
    return (await loadCompanionCommunityOverview()).communities;
  },

  async listVoiceRooms(): Promise<readonly CompanionVoiceRoom[]> {
    return (await loadCompanionCommunityOverview()).voiceRooms;
  },

  async loadHome(presenceValue?: unknown): Promise<CompanionHomeSnapshot> {
    const [user, friendStateResult, conversations, communityOverview] = await Promise.all([
      loadCurrentUser(),
      friendRequestService.getFriendState(),
      loadDirectConversations(),
      loadCompanionCommunityOverview(),
    ]);
    const friendState = unwrapResult<unknown>(friendStateResult);
    const presence = normalizePresence(presenceValue);
    const people = await hydratePeopleProfiles(peopleFromState(friendState, conversations as readonly unknown[], presence));
    const totalUnread = conversations.reduce((sum, conversation) => sum + (Number(conversation.unreadCount) || 0), 0);
    return Object.freeze({
      currentUser: currentUserIdentity(user),
      people,
      communities: communityOverview.communities,
      conversations,
      voiceRooms: communityOverview.voiceRooms,
      totalUnread,
      updatedAt: new Date().toISOString(),
    });
  },

  async subscribeHome(listener: (snapshot: CompanionHomeSnapshot) => void): Promise<() => void> {
    let stopped = false;
    let friendPresenceSnapshot: Record<string, unknown> = {};
    let directPresenceSnapshot: Record<string, unknown> = {};
    let friendPresenceCleanup: (() => void) | undefined;
    let directPresenceCleanup: (() => void) | undefined;
    let friendPresenceKey = "";
    let directPresenceKey = "";
    let refreshPromise: Promise<void> | null = null;
    let refreshQueued = false;
    let refresh: () => Promise<void> = async () => undefined;
    const mergedPresence = () => [
      ...Object.entries(friendPresenceSnapshot).map(([userId, value]) => ({ userId, status: record(value).status ?? value })),
      ...Object.entries(directPresenceSnapshot).map(([userId, value]) => ({ userId, status: record(value).status ?? value })),
    ];
    const bindPresence = async (snapshot: CompanionHomeSnapshot) => {
      // Match main app: every companion person is eligible for friend presence.
      // Previously only people WITHOUT a DM were subscribed here, so friends who
      // already had a conversation never hit list_friend_presence and could stay
      // stuck offline when DM presence lagged or filtered them out.
      const friendIds = [...new Set(snapshot.people.map((person) => person.userId).filter(Boolean))].sort();
      const directIds = [...new Set(snapshot.people.filter((person) => Boolean(person.conversationId)).map((person) => person.userId).filter(Boolean))].sort();
      const nextFriendKey = friendIds.join(",");
      const nextDirectKey = directIds.join(",");
      if (nextFriendKey !== friendPresenceKey) {
        friendPresenceKey = nextFriendKey;
        friendPresenceCleanup?.();
        friendPresenceCleanup = undefined;
        friendPresenceSnapshot = {};
        if (friendIds.length) {
          friendPresenceCleanup = await friendPresenceService.subscribe(friendIds, (next) => {
            friendPresenceSnapshot = next;
            void refresh();
          });
        }
      }
      if (nextDirectKey !== directPresenceKey) {
        directPresenceKey = nextDirectKey;
        directPresenceCleanup?.();
        directPresenceCleanup = undefined;
        directPresenceSnapshot = {};
        if (directIds.length) {
          directPresenceCleanup = await friendPresenceService.subscribeDirectPeers(directIds, (next) => {
            directPresenceSnapshot = next;
            void refresh();
          });
        }
      }
    };

    refresh = async () => {
      if (stopped) return;
      if (refreshPromise) {
        refreshQueued = true;
        return refreshPromise;
      }
      refreshPromise = (async () => {
        do {
          refreshQueued = false;
          const next = await this.loadHome(mergedPresence());
          if (stopped) return;
          listener(next);
          await bindPresence(next);
        } while (refreshQueued && !stopped);
      })().finally(() => {
        refreshPromise = null;
      });
      return refreshPromise;
    };

    const initial = await this.loadHome();
    listener(initial);
    await bindPresence(initial);
    const currentUser = await loadCurrentUser();
    const currentUserId = text(record(currentUser).id);
    let directCleanup: (() => void) | undefined;
    if (currentUserId) {
      try {
        directCleanup = directRealtimeService.subscribeList({
          currentUserId,
          onEvent: () => void refresh(),
          onStatus: () => undefined,
        });
      } catch (reason) {
        console.warn("Companion DM list realtime could not start.", reason);
      }
    }
    let friendCleanup = () => undefined;
    try {
      friendCleanup = await friendRequestService.subscribeToFriendState(() => void refresh());
    } catch (reason) {
      console.warn("Companion friend realtime could not start.", reason);
    }
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      friendPresenceCleanup?.();
      directPresenceCleanup?.();
      directCleanup?.();
      friendCleanup();
    };
  },

  async getConversations(): Promise<readonly DirectConversation[]> {
    return loadDirectConversations();
  },

  async getCurrentUserIdentity(): Promise<CompanionHomeSnapshot["currentUser"]> {
    return currentUserIdentity(await loadCurrentUser());
  },

  async createOrOpenConversation(userId: string): Promise<string> {
    return unwrapResult<string>(await directMessageService.createOrOpenDirectConversation(userId));
  },

  async getCallHistory(limit = 80): Promise<readonly DmCall[]> {
    return unwrapResult<DmCall[]>(await dmCallService.listCalls(undefined, limit));
  },
  async getMessages(conversationId: string): Promise<readonly DirectMessage[]> {
    const messages = await loadDirectMessages(conversationId);
    const latest = messages[messages.length - 1];
    void directMessageService.markDirectConversationRead(conversationId, latest?.id).catch(() => false);
    return messages;
  },

  async sendMessage(
    conversationId: string,
    body: string,
    attachments: readonly DirectMessageAttachment[] = [],
    replyToMessageId?: string,
  ): Promise<DirectMessage> {
    const message = unwrapResult<DirectMessage>(await directMessageService.sendDirectMessage(conversationId, body, attachments, replyToMessageId));
    messageDraftService.clearDraft({ directConversationId: conversationId });
    void directMessageService.markDirectConversationRead(conversationId, message.id).catch(() => false);
    return message;
  },

  getDraft(conversationId: string): string {
    return messageDraftService.getDraft({ directConversationId: conversationId })?.text ?? "";
  },

  saveDraft(conversationId: string, body: string): void {
    messageDraftService.saveDraft({ directConversationId: conversationId }, body);
  },

  clearDraft(conversationId: string): void {
    messageDraftService.clearDraft({ directConversationId: conversationId });
  },

  async markConversationRead(conversationId: string, throughMessageId?: string): Promise<boolean> {
    return directMessageService.markDirectConversationRead(conversationId, throughMessageId);
  },

  async editMessage(messageId: string, body: string): Promise<DirectMessage> {
    return unwrapResult<DirectMessage>(await directMessageService.editDirectMessage(messageId, body));
  },

  async deleteMessage(messageId: string): Promise<DirectMessage> {
    return unwrapResult<DirectMessage>(await directMessageService.deleteDirectMessage(messageId));
  },

  async addReaction(messageId: string, emoji: string): Promise<boolean> {
    return unwrapResult<boolean>(await directMessageService.addDirectReaction(messageId, emoji));
  },

  async removeReaction(messageId: string, emoji: string): Promise<boolean> {
    return unwrapResult<boolean>(await directMessageService.removeDirectReaction(messageId, emoji));
  },

  async getPeerReadState(conversationId: string, peerUserId: string): Promise<Readonly<{ lastReadAt?: string; lastReadMessageId?: string }>> {
    return unwrapResult(await directMessageService.getPeerDirectReadState(conversationId, peerUserId));
  },

  async subscribeMessages(conversationId: string, listener: (messages: readonly DirectMessage[]) => void): Promise<() => void> {
    const existing = companionMessageSubscriptions.get(conversationId);
    if (existing && !existing.closed) {
      existing.listeners.add(listener);
      if (existing.messages.length) listener(existing.messages);
      return () => {
        existing.listeners.delete(listener);
        if (!existing.listeners.size) {
          existing.closed = true;
          existing.realtimeCleanup?.();
          if (companionMessageSubscriptions.get(conversationId) === existing) companionMessageSubscriptions.delete(conversationId);
        }
      };
    }

    const currentUserPromise = loadCurrentUser();
    const raced = companionMessageSubscriptions.get(conversationId);
    if (raced && !raced.closed) {
      raced.listeners.add(listener);
      if (raced.messages.length) listener(raced.messages);
      return () => {
        raced.listeners.delete(listener);
        if (!raced.listeners.size) {
          raced.closed = true;
          raced.realtimeCleanup?.();
          if (companionMessageSubscriptions.get(conversationId) === raced) companionMessageSubscriptions.delete(conversationId);
        }
      };
    }

    const subscription: CompanionMessageSubscription = {
      listeners: new Set([listener]),
      messages: [],
      refreshPromise: null,
      refreshQueued: false,
      closed: false,
    };
    companionMessageSubscriptions.set(conversationId, subscription);
    const refreshMessages = async (): Promise<void> => {
      if (subscription.closed) return;
      if (subscription.refreshPromise) {
        subscription.refreshQueued = true;
        return subscription.refreshPromise;
      }
      subscription.refreshPromise = (async () => {
        do {
          subscription.refreshQueued = false;
          const messages = await loadDirectMessages(conversationId);
          if (subscription.closed) return;
          subscription.messages = messages;
          for (const current of subscription.listeners) current(messages);
          const latest = messages[messages.length - 1];
          void directMessageService.markDirectConversationRead(conversationId, latest?.id).catch(() => false);
        } while (subscription.refreshQueued && !subscription.closed);
      })().finally(() => {
        subscription.refreshPromise = null;
      });
      return subscription.refreshPromise;
    };
    await refreshMessages();
    const currentUser = await currentUserPromise;
    const currentUserId = text(record(currentUser).id);
    if (currentUserId && !subscription.closed) {
      subscription.realtimeCleanup = directRealtimeService.subscribeActive({
        conversationId,
        currentUserId,
        onEvent: () => void refreshMessages(),
        onStatus: () => undefined,
      });
    }
    return () => {
      subscription.listeners.delete(listener);
      if (!subscription.listeners.size) {
        subscription.closed = true;
        subscription.realtimeCleanup?.();
        if (companionMessageSubscriptions.get(conversationId) === subscription) companionMessageSubscriptions.delete(conversationId);
      }
    };
  },

  async getCommunity(communityId: string): Promise<Readonly<{ community: Community; channels: readonly Channel[]; activeChannel?: Channel; messages: readonly CommunityMessage[] }>> {
    const [communities, channels] = await Promise.all([
      loadJoinedCommunities(),
      loadCommunityChannels(communityId),
    ]);
    const community = communities.find((item) => item.id === communityId);
    if (!community) throw new Error("This community is not available to the signed-in account.");
    const activeChannel = channels.find((item) => item.type === "text") ?? channels[0];
    const messages = activeChannel ? await loadCommunityMessages(communityId, activeChannel.id) : [];
    return Object.freeze({ community, channels, activeChannel, messages });
  },

  async getCommunityMessages(communityId: string, channelId: string): Promise<readonly CommunityMessage[]> {
    return loadCommunityMessages(communityId, channelId);
  },

  async sendCommunityMessage(communityId: string, channelId: string, body: string): Promise<CommunityMessage> {
    return unwrapResult<CommunityMessage>(await messageService.sendMessage({ communityId, channelId, body }));
  },

  async startDirectCall(conversationId: string, target: CompanionPerson, callType: DmCallType): Promise<DmCall> {
    const activeResult = await dmCallService.getCurrentActiveCall();
    const active = unwrapResult<DmCall | null>(activeResult);
    const reusableCall = active?.conversationId === conversationId ? active : null;
    const call = reusableCall
      ? reusableCall
      : unwrapResult<DmCall>(await dmCallService.startCall(conversationId, target.userId, callType));
    if (!reusableCall) {
      void prefetchDirectCallToken(conversationId, call.id, callType).catch(() => undefined);
      await voiceCallInviteService.invite(
        { id: target.userId, name: target.displayName, username: target.username, avatarUrl: target.avatarUrl },
        {
          kind: "direct",
          conversationId,
          callId: call.id,
          callType,
          startedAt: call.startedAt,
          livekitRoomName: call.livekitRoomName,
          peerName: target.displayName,
        },
      );
    }
    return call;
  },

  async connectDirectCall(conversationId: string, callId: string, callType: DmCallType): Promise<VoiceServiceSnapshot> {
    if (connectedCallId === callId) return voiceService.getSnapshot();
    const key = directCallTokenKey(conversationId, callId, callType);
    if (connectingCall?.key === key) return connectingCall.promise;
    const generation = ++callLifecycleGeneration;
    const promise = (async () => {
      const token = await prefetchDirectCallToken(conversationId, callId, callType);
      directCallTokenRequests.delete(key);
      const result = await voiceService.connectAuthorizedToken(token, {
        communityId: `direct:${conversationId}`,
        communityName: "Direct call",
        channelId: callId,
        channelName: callType === "video" ? "Video call" : "Voice call",
      }, { cameraEnabled: callType === "video" });
      const snapshot = unwrapResult<VoiceServiceSnapshot>(result);
      if (generation !== callLifecycleGeneration) {
        await voiceService.leave();
        throw new Error("This call was canceled before the media connection completed.");
      }
      connectedCallId = callId;
      return snapshot;
    })().finally(() => {
      if (connectingCall?.key === key) connectingCall = null;
    });
    connectingCall = Object.freeze({ key, promise });
    return promise;
  },

  async joinCommunityVoiceRoom(input: Readonly<{
    communityId: string;
    communityName: string;
    channelId: string;
    channelName: string;
    participantName: string;
  }>): Promise<VoiceServiceSnapshot> {
    const snapshot = voiceService.getSnapshot();
    const alreadyConnected = (snapshot.status === "connected" || snapshot.status === "reconnecting")
      && snapshot.roomContext?.communityId === input.communityId
      && snapshot.roomContext?.channelId === input.channelId;
    if (alreadyConnected) return snapshot;

    connectedCallId = null;
    const result = await voiceService.join({
      communityId: input.communityId,
      communityName: input.communityName,
      channelId: input.channelId,
      channelName: input.channelName,
      participantName: input.participantName,
      intent: "voice",
    });
    return unwrapResult<VoiceServiceSnapshot>(result);
  },

  async leaveVoiceRoom(): Promise<void> {
    connectedCallId = null;
    directCallTokenRequests.clear();
    await voiceService.leave();
  },

  subscribeVoice(listener: (snapshot: VoiceServiceSnapshot) => void): () => void {
    return voiceService.subscribe(listener);
  },

  async setMuted(muted: boolean): Promise<VoiceServiceSnapshot> {
    return unwrapResult(await voiceService.setMuted(muted));
  },

  async setCamera(enabled: boolean): Promise<VoiceServiceSnapshot> {
    return unwrapResult(await voiceService.setCameraEnabled(enabled));
  },

  setDeafened(deafened: boolean): VoiceServiceSnapshot {
    return unwrapResult(voiceService.setDeafened(deafened));
  },

  setRemoteParticipantVolume(participantIdentity: string, volume: number): boolean {
    return voiceService.setRemoteParticipantVolume(participantIdentity, volume);
  },

  getOutputVolume(): number {
    return voiceService.getMasterOutputVolume();
  },

  setOutputVolume(volume: number): number {
    return voiceService.setMasterOutputVolume(volume);
  },

  startScreenShare(sourceId: string, preset: "presentation" | "balanced" | "performance" = "balanced", sourceLabel?: string): Promise<unknown> {
    return voiceService.startScreenShare(sourceId, preset, sourceLabel);
  },

  stopScreenShare(): Promise<unknown> {
    return voiceService.stopScreenShare();
  },

  async leaveCall(callId: string): Promise<void> {
    callLifecycleGeneration += 1;
    connectingCall = null;
    await voiceService.leave();
    connectedCallId = null;
    unwrapResult<DmCall>(await dmCallService.finishCall(callId, "completed"));
  },
});

export type { DirectConversation, DirectMessage, Community, Channel, CommunityMessage, DmCall };
