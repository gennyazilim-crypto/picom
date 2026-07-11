import { useMemo, useState } from "react";
import type { FriendConnection, FriendRequest, FriendRequestCounts, FriendSuggestion, FriendViewTab } from "../types/friends";
import type { BlockedUserRecord } from "../services/userBlockingService";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";

type FriendsViewProps = {
  friends: FriendConnection[];
  requests: FriendRequest[];
  suggestions: FriendSuggestion[];
  counts: FriendRequestCounts;
  blockedUsers: BlockedUserRecord[];
  activeTab: FriendViewTab;
  onTabChange: (tab: FriendViewTab) => void;
  onBackToCommunity: () => void;
  onOpenDirectMessage: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onToggleFavorite: (userId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onDismissRequest: (requestId: string) => void;
  onCancelRequest: (requestId: string) => void;
  onSendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlockFriend: (userId: string) => void;
  onUnblockFriend: (userId: string) => void;
};

const tabs: ReadonlyArray<{ id: FriendViewTab; label: string; icon: "users" | "inbox" | "plus" | "lock" }> = [
  { id: "all", label: "All", icon: "users" },
  { id: "online", label: "Online", icon: "users" },
  { id: "pending", label: "Pending", icon: "inbox" },
  { id: "suggestions", label: "Suggestions", icon: "plus" },
  { id: "blocked", label: "Blocked", icon: "lock" },
];

function safeStatusText(friend: FriendConnection): string {
  if (friend.status === "offline") return "Offline";
  const value = friend.statusText.trim().replace(/\s+/g, " ").slice(0, 72);
  return value || (friend.status === "dnd" ? "Busy" : friend.status === "idle" ? "Idle" : "Online");
}

function FriendAvatar({ userId, name, status = "offline", avatarUrl }: { userId: string; name: string; status?: FriendConnection["status"]; avatarUrl?: string }) {
  return <span className="friend-avatar-shell"><VerifiedAvatarFrame userId={userId} label={name} avatarUrl={avatarUrl} size="compact" avatarSize={42} verification={getUserVerificationSummary(userId)} /><i className={`friend-presence-dot status-${status}`} role="img" aria-label={`${name} is ${status === "dnd" ? "busy" : status}`} /></span>;
}

function EmptyState({ icon, title, copy }: { icon: "users" | "inbox" | "plus" | "lock"; title: string; copy: string }) {
  return <div className="friend-empty-state"><AppIcon name={icon} size="xl" /><strong>{title}</strong><span>{copy}</span></div>;
}

export function FriendsView(props: FriendsViewProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const incomingRequests = props.requests.filter((request) => request.direction === "incoming" && request.status === "pending");
  const outgoingRequests = props.requests.filter((request) => request.direction === "outgoing" && request.status === "pending");
  const onlineFriends = props.friends.filter((friend) => friend.status !== "offline");
  const matches = (name: string, username: string) => !normalizedQuery || `${name} ${username}`.toLocaleLowerCase().includes(normalizedQuery);
  const visibleFriends = (props.activeTab === "online" ? onlineFriends : props.friends).filter((friend) => matches(friend.displayName, friend.username));
  const visibleSuggestions = props.suggestions.filter((suggestion) => matches(suggestion.displayName, suggestion.username));
  const visibleBlocked = props.blockedUsers.filter((user) => matches(user.displayName, user.username));
  const tabCounts = useMemo<Record<FriendViewTab, number>>(() => ({
    all: props.counts.friends,
    online: onlineFriends.length,
    pending: props.counts.pending,
    suggestions: props.suggestions.length,
    blocked: props.blockedUsers.length,
  }), [onlineFriends.length, props.blockedUsers.length, props.counts.friends, props.counts.pending, props.suggestions.length]);

  return <section className="friends-view" aria-label="Friends">
    <header className="friends-header">
      <button className="icon-button" type="button" aria-label="Back to community chat" onClick={props.onBackToCommunity}><AppIcon name="chevronRight" size="sm" /></button>
      <div className="friends-heading"><span className="eyebrow">People</span><h2>Friends</h2><p aria-live="polite">{props.counts.friends} friends, {props.counts.incoming} incoming and {props.counts.outgoing} sent requests</p></div>
      <label className="friends-search"><AppIcon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search friends and requests" /></label>
    </header>
    <nav className="friends-tabs" role="tablist" aria-label="Friend sections">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={props.activeTab === tab.id} className={props.activeTab === tab.id ? "active" : ""} onClick={() => props.onTabChange(tab.id)}><AppIcon name={tab.icon} size="sm" /><span>{tab.label}</span><small>{tabCounts[tab.id]}</small></button>)}
    </nav>
    <div className="friends-content" role="tabpanel" aria-label={`${tabs.find((tab) => tab.id === props.activeTab)?.label ?? "Friends"} section`}>
      {(props.activeTab === "all" || props.activeTab === "online") ? <div className="friend-list">
        {visibleFriends.map((friend) => <article key={friend.userId} className="friend-card">
          <button type="button" className="friend-identity" onClick={() => props.onOpenProfile(friend.userId)} aria-label={`Open ${friend.displayName}'s profile`}><FriendAvatar userId={friend.userId} name={friend.displayName} status={friend.status} avatarUrl={friend.avatarUrl} /><span className="friend-copy"><strong><span>{friend.displayName}</span><VerifiedBadge verification={getUserVerificationSummary(friend.userId)} size="xs" /></strong><small>@{friend.username} · {safeStatusText(friend)}</small><span>{friend.mutualCommunityCount} shared communities</span></span></button>
          <div className="friend-actions"><button type="button" onClick={() => props.onOpenDirectMessage(friend.userId)}><AppIcon name="send" size="xs" />Message</button><button type="button" onClick={() => props.onToggleFavorite(friend.userId)} aria-pressed={friend.favorite}>{friend.favorite ? "Starred" : "Star"}</button><button type="button" onClick={() => props.onRemoveFriend(friend.userId)}>Remove</button><button type="button" className="danger-button" onClick={() => props.onBlockFriend(friend.userId)}>Block</button></div>
        </article>)}
        {!visibleFriends.length ? <EmptyState icon="users" title={props.activeTab === "online" ? "No friends online" : "No friends found"} copy={normalizedQuery ? "Try another search." : "Friend connections will appear here."} /> : null}
      </div> : null}

      {props.activeTab === "pending" ? <div className="friend-pending-grid">
        <section className="friends-panel"><div className="friends-panel-title"><strong>Incoming requests</strong><span>{incomingRequests.length}</span></div>{incomingRequests.filter((request) => matches(request.displayName, request.username)).map((request) => <article key={request.id} className="friend-request-card"><FriendAvatar userId={request.userId} name={request.displayName} /><div className="friend-copy"><strong>{request.displayName}</strong><small>@{request.username}</small><span>{request.note}</span></div><div className="friend-request-actions"><button type="button" onClick={() => props.onAcceptRequest(request.id)}>Accept</button><button type="button" onClick={() => props.onDismissRequest(request.id)}>Decline</button></div></article>)}{!incomingRequests.length ? <EmptyState icon="inbox" title="No incoming requests" copy="New requests will appear here." /> : null}</section>
        <section className="friends-panel"><div className="friends-panel-title"><strong>Sent requests</strong><span>{outgoingRequests.length}</span></div>{outgoingRequests.filter((request) => matches(request.displayName, request.username)).map((request) => <article key={request.id} className="friend-request-card"><FriendAvatar userId={request.userId} name={request.displayName} /><div className="friend-copy"><strong>{request.displayName}</strong><small>@{request.username}</small><span>Awaiting a response</span></div><div className="friend-request-actions"><button type="button" onClick={() => props.onCancelRequest(request.id)}>Cancel request</button></div></article>)}{!outgoingRequests.length ? <EmptyState icon="inbox" title="No sent requests" copy="Requests you send will appear here." /> : null}</section>
      </div> : null}

      {props.activeTab === "suggestions" ? <div className="friend-list">{visibleSuggestions.map((suggestion) => <article key={suggestion.userId} className="friend-card suggestion"><div className="friend-identity static"><FriendAvatar userId={suggestion.userId} name={suggestion.displayName} avatarUrl={suggestion.avatarUrl} /><span className="friend-copy"><strong>{suggestion.displayName}</strong><small>@{suggestion.username}</small><span>{suggestion.reason}</span><span className="friend-suggestion-signals"><em>{suggestion.mutualCommunityCount} mutual</em>{suggestion.followedByCurrentUser ? <em>Following</em> : null}</span></span></div><div className="friend-actions"><button type="button" onClick={() => props.onSendRequest(suggestion.userId)}><AppIcon name="plus" size="xs" />Add friend</button></div></article>)}{!visibleSuggestions.length ? <EmptyState icon="plus" title="No suggestions available" copy="Blocked, existing, and pending users are excluded." /> : null}</div> : null}

      {props.activeTab === "blocked" ? <div className="friend-list">{visibleBlocked.map((user) => <article key={user.userId} className="friend-card blocked"><div className="friend-identity static"><FriendAvatar userId={user.userId} name={user.displayName} /><span className="friend-copy"><strong>{user.displayName}</strong><small>@{user.username}</small><span>Blocked {new Date(user.blockedAt).toLocaleDateString()}</span></span></div><div className="friend-actions"><button type="button" onClick={() => props.onUnblockFriend(user.userId)}>Unblock</button></div></article>)}{!visibleBlocked.length ? <EmptyState icon="lock" title="No blocked users" copy="Users you block are managed here." /> : null}</div> : null}
    </div>
  </section>;
}
