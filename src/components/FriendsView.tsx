import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "../utils/motionLite";
import type { FriendConnection, FriendRequest, FriendRequestCounts, FriendSuggestion, FriendViewTab } from "../types/friends";
import type { BlockedUserRecord } from "../services/userBlockingService";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";
import "./FriendsView.css";

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

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 440, damping: 32, mass: 0.75 } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 34 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function safeStatusText(friend: FriendConnection): string {
  if (friend.status === "offline") return "Offline";
  const value = friend.statusText.trim().replace(/\s+/g, " ").slice(0, 72);
  return value || (friend.status === "dnd" ? "Busy" : friend.status === "idle" ? "Idle" : "Online");
}

function FriendAvatar({ userId, name, status = "offline", avatarUrl }: { userId: string; name: string; status?: FriendConnection["status"]; avatarUrl?: string }) {
  return (
    <span className="friend-avatar-shell">
      <VerifiedAvatarFrame userId={userId} label={name} avatarUrl={avatarUrl} size="compact" avatarSize={46} verification={getUserVerificationSummary(userId)} />
      <i className={`friend-presence-dot status-${status}`} role="img" aria-label={`${name} is ${status === "dnd" ? "busy" : status}`} />
    </span>
  );
}

function EmptyState({ icon, title, copy }: { icon: "users" | "inbox" | "plus" | "lock"; title: string; copy: string }) {
  return (
    <div className="friend-empty-state">
      <AppIcon name={icon} size="xl" />
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function FriendCard({ friend, onOpenProfile, onOpenDirectMessage, onToggleFavorite, onRemoveFriend, onBlockFriend, reduceMotion }: {
  friend: FriendConnection;
  onOpenProfile: (userId: string) => void;
  onOpenDirectMessage: (userId: string) => void;
  onToggleFavorite: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlockFriend: (userId: string) => void;
  reduceMotion: boolean | null;
}) {
  const verification = getUserVerificationSummary(friend.userId);

  return (
    <motion.article
      className="friend-card"
      variants={listItemVariants}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      layout
    >
      <button type="button" className="friend-identity" onClick={() => onOpenProfile(friend.userId)} aria-label={`Open ${friend.displayName}'s profile`}>
        <FriendAvatar userId={friend.userId} name={friend.displayName} status={friend.status} avatarUrl={friend.avatarUrl} />
        <span className="friend-copy">
          <strong>
            <span>{friend.displayName}</span>
            <VerifiedBadge verification={verification} size="xs" />
          </strong>
          <small>@{friend.username} · {safeStatusText(friend)}</small>
          <span>{friend.mutualCommunityCount} shared communit{friend.mutualCommunityCount === 1 ? "y" : "ies"}</span>
        </span>
      </button>
      <div className="friend-actions">
        <button type="button" className="friend-action-primary" onClick={() => onOpenDirectMessage(friend.userId)}>
          <AppIcon name="send" size="xs" />
          Message
        </button>
        <button
          type="button"
          className={`friend-action-secondary${friend.favorite ? " is-active" : ""}`}
          aria-pressed={friend.favorite}
          onClick={() => onToggleFavorite(friend.userId)}
        >
          {friend.favorite ? "Starred" : "Star"}
        </button>
        <button type="button" className="friend-action-ghost" onClick={() => onRemoveFriend(friend.userId)}>Remove</button>
        <button type="button" className="friend-action-danger" onClick={() => onBlockFriend(friend.userId)}>Block</button>
      </div>
    </motion.article>
  );
}

function FriendPanelEmpty({ copy }: { copy: string }) {
  return <p className="friend-panel-empty">{copy}</p>;
}

function IncomingFriendRequestCard({ request, reduceMotion, onOpenProfile, onAccept, onDecline }: {
  request: FriendRequest;
  reduceMotion: boolean | null;
  onOpenProfile: (userId: string) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const verification = getUserVerificationSummary(request.userId);
  return (
    <motion.article
      className="friend-request-card incoming"
      variants={listItemVariants}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      layout
    >
      <button type="button" className="friend-request-identity" onClick={() => onOpenProfile(request.userId)} aria-label={`Open ${request.displayName}'s profile`}>
        <FriendAvatar userId={request.userId} name={request.displayName} />
        <span className="friend-copy">
          <strong>
            <span>{request.displayName}</span>
            <VerifiedBadge verification={verification} size="xs" />
          </strong>
          <small>@{request.username}</small>
          <span className="friend-request-time">{dateTimeService.formatRelativeTime(request.createdAt)}</span>
        </span>
      </button>
      {request.note ? <p className="friend-request-note">{request.note}</p> : null}
      <div className="friend-request-actions">
        <button type="button" className="friend-action-primary" onClick={onAccept}>
          <AppIcon name="plus" size="xs" />
          Accept
        </button>
        <button type="button" className="friend-action-ghost" onClick={onDecline}>Decline</button>
      </div>
    </motion.article>
  );
}

function OutgoingFriendRequestCard({ request, reduceMotion, onOpenProfile, onCancel }: {
  request: FriendRequest;
  reduceMotion: boolean | null;
  onOpenProfile: (userId: string) => void;
  onCancel: () => void;
}) {
  const verification = getUserVerificationSummary(request.userId);
  return (
    <motion.article
      className="friend-request-card outgoing"
      variants={listItemVariants}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      layout
    >
      <button type="button" className="friend-request-identity" onClick={() => onOpenProfile(request.userId)} aria-label={`Open ${request.displayName}'s profile`}>
        <FriendAvatar userId={request.userId} name={request.displayName} />
        <span className="friend-copy">
          <strong>
            <span>{request.displayName}</span>
            <VerifiedBadge verification={verification} size="xs" />
          </strong>
          <small>@{request.username}</small>
          <span className="friend-request-time">Sent {dateTimeService.formatRelativeTime(request.createdAt)}</span>
        </span>
      </button>
      <p className="friend-request-status">Awaiting a response</p>
      <div className="friend-request-actions">
        <button type="button" className="friend-action-secondary" onClick={onCancel}>Cancel request</button>
      </div>
    </motion.article>
  );
}

function FriendRequestsPanel({ title, icon, count, children }: { title: string; icon: "inbox" | "send"; count: number; children: ReactNode }) {
  return (
    <section className="friends-panel">
      <header className="friends-panel-title">
        <span className="friends-panel-heading">
          <AppIcon name={icon} size="sm" />
          <strong>{title}</strong>
        </span>
        <span>{count}</span>
      </header>
      <div className="friends-panel-body">{children}</div>
    </section>
  );
}

export function FriendsView(props: FriendsViewProps) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const incomingRequests = props.requests.filter((request) => request.direction === "incoming" && request.status === "pending");
  const outgoingRequests = props.requests.filter((request) => request.direction === "outgoing" && request.status === "pending");
  const onlineFriends = props.friends.filter((friend) => friend.status !== "offline");
  const matches = (name: string, username: string) => !normalizedQuery || `${name} ${username}`.toLocaleLowerCase().includes(normalizedQuery);
  const visibleFriends = (props.activeTab === "online" ? onlineFriends : props.friends).filter((friend) => matches(friend.displayName, friend.username));
  const visibleSuggestions = props.suggestions.filter((suggestion) => matches(suggestion.displayName, suggestion.username));
  const visibleIncoming = useMemo(
    () => incomingRequests.filter((request) => matches(request.displayName, request.username)),
    [incomingRequests, normalizedQuery],
  );
  const visibleOutgoing = useMemo(
    () => outgoingRequests.filter((request) => matches(request.displayName, request.username)),
    [outgoingRequests, normalizedQuery],
  );
  const visibleBlocked = props.blockedUsers.filter((user) => matches(user.displayName, user.username));
  const tabCounts = useMemo<Record<FriendViewTab, number>>(() => ({
    all: props.counts.friends,
    online: onlineFriends.length,
    pending: props.counts.pending,
    suggestions: props.suggestions.length,
    blocked: props.blockedUsers.length,
  }), [onlineFriends.length, props.blockedUsers.length, props.counts.friends, props.counts.pending, props.suggestions.length]);

  const activeTabLabel = tabs.find((tab) => tab.id === props.activeTab)?.label ?? "Friends";

  return (
    <section className="friends-view" aria-label="Friends">
      <header className="friends-header">
        <div className="friends-header-start">
          <button className="friends-back" type="button" aria-label="Go back" onClick={props.onBackToCommunity}>
            <AppIcon name="chevronRight" size="sm" />
          </button>
          <div className="friends-heading">
            <h2>Friends</h2>
            <p className="friends-header-summary" aria-live="polite">
              <span>{props.counts.friends} connected</span>
              {props.counts.incoming > 0 ? (
                <span className="friends-summary-pending">{props.counts.incoming} pending request{props.counts.incoming === 1 ? "" : "s"}</span>
              ) : null}
              {props.counts.outgoing > 0 ? <span>{props.counts.outgoing} sent</span> : null}
            </p>
          </div>
        </div>
        <label className="friends-search">
          <AppIcon name="search" size="sm" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search friends and requests" />
        </label>
      </header>

      <nav className="friends-tabs" role="tablist" aria-label="Friend sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={props.activeTab === tab.id}
            className={props.activeTab === tab.id ? "active" : ""}
            onClick={() => props.onTabChange(tab.id)}
          >
            <AppIcon name={tab.icon} size="sm" />
            <span>{tab.label}</span>
            <small>{tabCounts[tab.id]}</small>
          </button>
        ))}
      </nav>

      <div className="friends-content" role="tabpanel" aria-label={`${activeTabLabel} section`}>
        <AnimatePresence mode="wait" initial={false}>
          {(props.activeTab === "all" || props.activeTab === "online") ? (
            <motion.div
              key={props.activeTab}
              variants={panelVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
            >
              {visibleFriends.length ? (
                <motion.div
                  className="friend-list"
                  variants={listContainerVariants}
                  initial={reduceMotion ? false : "hidden"}
                  animate="visible"
                >
                  {visibleFriends.map((friend) => (
                    <FriendCard
                      key={friend.userId}
                      friend={friend}
                      reduceMotion={reduceMotion}
                      onOpenProfile={props.onOpenProfile}
                      onOpenDirectMessage={props.onOpenDirectMessage}
                      onToggleFavorite={props.onToggleFavorite}
                      onRemoveFriend={props.onRemoveFriend}
                      onBlockFriend={props.onBlockFriend}
                    />
                  ))}
                </motion.div>
              ) : (
                <EmptyState
                  icon="users"
                  title={props.activeTab === "online" ? "No friends online" : "No friends found"}
                  copy={normalizedQuery ? "Try another search." : "Friend connections will appear here."}
                />
              )}
            </motion.div>
          ) : null}

          {props.activeTab === "pending" ? (
            <motion.div key="pending" className="friend-pending-grid" variants={panelVariants} initial={reduceMotion ? false : "hidden"} animate="visible" exit="exit">
              <FriendRequestsPanel title="Incoming requests" icon="inbox" count={visibleIncoming.length}>
                {visibleIncoming.length ? (
                  <motion.div className="friend-request-list" variants={listContainerVariants} initial={reduceMotion ? false : "hidden"} animate="visible">
                    {visibleIncoming.map((request) => (
                      <IncomingFriendRequestCard
                        key={request.id}
                        request={request}
                        reduceMotion={reduceMotion}
                        onOpenProfile={props.onOpenProfile}
                        onAccept={() => props.onAcceptRequest(request.id)}
                        onDecline={() => props.onDismissRequest(request.id)}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <FriendPanelEmpty copy={normalizedQuery ? "No incoming requests match your search." : "New requests will appear here."} />
                )}
              </FriendRequestsPanel>
              <FriendRequestsPanel title="Sent requests" icon="send" count={visibleOutgoing.length}>
                {visibleOutgoing.length ? (
                  <motion.div className="friend-request-list" variants={listContainerVariants} initial={reduceMotion ? false : "hidden"} animate="visible">
                    {visibleOutgoing.map((request) => (
                      <OutgoingFriendRequestCard
                        key={request.id}
                        request={request}
                        reduceMotion={reduceMotion}
                        onOpenProfile={props.onOpenProfile}
                        onCancel={() => props.onCancelRequest(request.id)}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <FriendPanelEmpty copy={normalizedQuery ? "No sent requests match your search." : "Requests you send will appear here."} />
                )}
              </FriendRequestsPanel>
            </motion.div>
          ) : null}

          {props.activeTab === "suggestions" ? (
            <motion.div key="suggestions" variants={panelVariants} initial={reduceMotion ? false : "hidden"} animate="visible" exit="exit">
              {visibleSuggestions.length ? (
                <motion.div className="friend-list" variants={listContainerVariants} initial={reduceMotion ? false : "hidden"} animate="visible">
                  {visibleSuggestions.map((suggestion) => (
                  <motion.article key={suggestion.userId} className="friend-card suggestion" variants={listItemVariants} whileHover={reduceMotion ? undefined : { y: -1 }}>
                    <div className="friend-identity static">
                      <FriendAvatar userId={suggestion.userId} name={suggestion.displayName} avatarUrl={suggestion.avatarUrl} />
                      <span className="friend-copy">
                        <strong>{suggestion.displayName}</strong>
                        <small>@{suggestion.username}</small>
                        <span>{suggestion.reason}</span>
                        <span className="friend-suggestion-signals">
                          <em>{suggestion.mutualCommunityCount} mutual</em>
                          {suggestion.followedByCurrentUser ? <em>Following</em> : null}
                        </span>
                      </span>
                    </div>
                    <div className="friend-actions">
                      <button type="button" className="friend-action-primary" onClick={() => props.onSendRequest(suggestion.userId)}>
                        <AppIcon name="plus" size="xs" />
                        Add friend
                      </button>
                    </div>
                  </motion.article>
                  ))}
                </motion.div>
              ) : (
                <EmptyState icon="plus" title="No suggestions available" copy="Blocked, existing, and pending users are excluded." />
              )}
            </motion.div>
          ) : null}

          {props.activeTab === "blocked" ? (
            <motion.div key="blocked" variants={panelVariants} initial={reduceMotion ? false : "hidden"} animate="visible" exit="exit">
              {visibleBlocked.length ? (
                <motion.div className="friend-list" variants={listContainerVariants} initial={reduceMotion ? false : "hidden"} animate="visible">
                  {visibleBlocked.map((user) => (
                  <motion.article key={user.userId} className="friend-card blocked" variants={listItemVariants} whileHover={reduceMotion ? undefined : { y: -1 }}>
                    <div className="friend-identity static">
                      <FriendAvatar userId={user.userId} name={user.displayName} />
                      <span className="friend-copy">
                        <strong>{user.displayName}</strong>
                        <small>@{user.username}</small>
                        <span>Blocked {new Date(user.blockedAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <div className="friend-actions">
                      <button type="button" className="friend-action-secondary" onClick={() => props.onUnblockFriend(user.userId)}>Unblock</button>
                    </div>
                  </motion.article>
                  ))}
                </motion.div>
              ) : (
                <EmptyState icon="lock" title="No blocked users" copy="Users you block are managed here." />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
